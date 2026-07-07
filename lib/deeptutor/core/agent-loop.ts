/**
 * AgentLoop Subgraph — LangGraph StateGraph for the core LLM → Tool → LLM loop
 *
 * TypeScript equivalent of DeepTutor's `run_agentic_loop` + `run_labeled_step`
 * + `dispatch_tool_calls`, adapted for Vercel AI SDK v5 + LangGraph JS.
 *
 * Key design decisions:
 * - Uses Vercel AI SDK `streamText` / `generateText` for LLM calls with native tool support
 * - Uses LangGraph JS `StateGraph` for the loop structure (agent ↔ tools conditional edges)
 * - No label protocol — uses AI SDK's native tool calling instead.
 *   "FINISH" = no tool calls; "TOOL" = has tool calls.
 * - Streaming through StreamBus — each LLM text chunk forwarded for SSE delivery
 *
 * Migrated from: deeptutor/core/agentic/loop.py
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { streamText, generateText } from 'ai';
import type { LanguageModel, ToolSet, ModelMessage, Tool } from 'ai';
import { z } from 'zod';

import { ToolRegistry } from '@/lib/deeptutor/tools/registry';
import { StreamBusImpl } from '@/lib/deeptutor/core/stream-bus';
import type { StreamEvent } from '@/lib/deeptutor/core/types';
import { InputHandler, getInputHandler } from '@/lib/deeptutor/core/input-handler';
import type { ToolDefinition, ToolParameter, ToolResult } from '@/lib/deeptutor/core/tool-protocol';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AgentLoop');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ITERATIONS = 20;
const DEFAULT_TEMPERATURE = 0.1;
/** Context window budget in tokens (conservative default) */
const DEFAULT_CONTEXT_WINDOW = 65536;
/** Snip threshold — start trimming when usage exceeds this fraction */
const CONTEXT_SNIP_RATIO = 0.9;
/** Placeholder text inserted when old tool results are snipped */
const SNIPPED_PLACEHOLDER =
  '[Earlier tool results have been trimmed to fit the context window.]';

// ---------------------------------------------------------------------------
// State definition
// ---------------------------------------------------------------------------

const AgentLoopState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev: BaseMessage[], update: BaseMessage[]) => [...prev, ...update],
    default: () => [],
  }),
  iterationCount: Annotation<number>({
    reducer: (_prev: number, update: number) => update,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (_prev: number, update: number) => update,
    default: () => DEFAULT_MAX_ITERATIONS,
  }),
  /** Whether a tool requested the turn be terminated */
  terminateTurn: Annotation<boolean>({
    reducer: (_prev: boolean, update: boolean) => update,
    default: () => false,
  }),
  /** Metadata — session / turn IDs for event correlation */
  sessionId: Annotation<string>({
    reducer: (_prev: string, update: string) => update,
    default: () => '',
  }),
  turnId: Annotation<string>({
    reducer: (_prev: string, update: string) => update,
    default: () => '',
  }),
});

type AgentLoopStateType = typeof AgentLoopState.State;

// ---------------------------------------------------------------------------
// Public config interface
// ---------------------------------------------------------------------------

export interface AgentLoopConfig {
  /** The language model to use for LLM calls */
  model: LanguageModel;
  /** AI SDK–format tools (pre-built with zod schemas & execute functions) */
  tools: ToolSet;
  /** Our internal ToolRegistry for executing tools by name */
  toolRegistry: ToolRegistry;
  /** Maximum agent iterations before forced final response (default 20) */
  maxIterations?: number;
  /** Temperature for LLM calls (default 0.1) */
  temperature?: number;
  /** Context window token budget for the context guard (default 65536) */
  contextWindowTokens?: number;
  /** Optional callback that receives every StreamEvent */
  streamCallback?: (event: StreamEvent) => void;
  /** Session ID for event correlation */
  sessionId?: string;
  /** Turn ID for event correlation */
  turnId?: string;
  /** Optional InputHandler override (defaults to the global singleton) */
  inputHandler?: InputHandler;
  /** Optional system prompt override */
  systemPrompt?: string;
}

// ---------------------------------------------------------------------------
// Tool format conversion helpers
// ---------------------------------------------------------------------------

/**
 * Build a Zod schema object from an array of ToolParameter descriptors.
 *
 * Handles: string, integer, boolean, number, array, object.
 * Falls back to `z.any()` for unrecognised types.
 */
function parametersToZodSchema(parameters: ToolParameter[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of parameters) {
    let fieldSchema: z.ZodTypeAny;

    switch (param.type) {
      case 'string':
        if (param.enum && param.enum.length > 0) {
          const [first, ...rest] = param.enum;
          fieldSchema = z.enum([first, ...rest] as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;

      case 'integer':
        fieldSchema = z.number().int();
        break;

      case 'number':
        fieldSchema = z.number();
        break;

      case 'boolean':
        fieldSchema = z.boolean();
        break;

      case 'array':
        if (param.items) {
          const itemType = (param.items as Record<string, unknown>).type;
          if (itemType === 'string') {
            fieldSchema = z.array(z.string());
          } else if (itemType === 'integer' || itemType === 'number') {
            fieldSchema = z.array(z.number());
          } else if (itemType === 'boolean') {
            fieldSchema = z.array(z.boolean());
          } else {
            fieldSchema = z.array(z.any());
          }
        } else {
          fieldSchema = z.array(z.string());
        }
        break;

      case 'object':
        fieldSchema = z.record(z.string(), z.any());
        break;

      default:
        fieldSchema = z.any();
        break;
    }

    // Apply optionality
    if (!param.required) {
      fieldSchema = fieldSchema.optional();
      if (param.default !== null && param.default !== undefined) {
        fieldSchema = fieldSchema.default(param.default as z.input<typeof fieldSchema>);
      }
    }

    // Apply description
    if (param.description) {
      fieldSchema = fieldSchema.describe(param.description);
    }

    shape[param.name] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * Convert an array of our `ToolDefinition` to AI SDK's `ToolSet` format.
 *
 * Each entry gets a zod parameter schema and a stub `execute` function.
 * The real execution happens in our tool node via ToolRegistry.
 */
export function toAISDKTools(definitions: ToolDefinition[]): ToolSet {
  const result: Record<string, Tool<unknown, unknown>> = {};

  for (const def of definitions) {
    const zodParams = parametersToZodSchema(def.parameters);

    result[def.name] = {
      description: def.description,
      // AI SDK v5 uses `inputSchema` (FlexibleSchema) instead of `parameters`
      inputSchema: zodParams as unknown as Tool<unknown, unknown>['inputSchema'],
      // Stub execute — real dispatch goes through ToolRegistry in the tool_node.
      // The stub satisfies ToolSet's requirement that `execute` be present.
      execute: async () => ({}) as unknown,
      onInputAvailable: () => {},
      onInputStart: () => {},
      onInputDelta: () => {},
    };
  }

  return result as ToolSet;
}

// ---------------------------------------------------------------------------
// Message conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert LangChain BaseMessage[] to AI SDK ModelMessage[] for the LLM call.
 *
 * Mapping:
 * - SystemMessage → { role: 'system', content }
 * - HumanMessage  → { role: 'user', content }
 * - AIMessage     → { role: 'assistant', content, toolCalls? }
 * - ToolMessage   → { role: 'tool', content }
 */
function toModelMessages(messages: BaseMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const msg of messages) {
    const content =
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

    if (msg instanceof SystemMessage) {
      result.push({ role: 'system', content });
    } else if (msg instanceof HumanMessage) {
      result.push({ role: 'user', content });
    } else if (msg instanceof AIMessage) {
      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length > 0) {
        // Build assistant message with tool call parts
        const parts: Array<
          | { type: 'text'; text: string }
          | {
              type: 'tool-invocation';
              toolInvocation: {
                toolCallId: string;
                toolName: string;
                args: Record<string, unknown>;
                state: 'call';
              };
            }
        > = [];

        if (content) {
          parts.push({ type: 'text', text: content });
        }
        for (const tc of toolCalls) {
          parts.push({
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: tc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
              toolName: tc.name,
              args: tc.args as Record<string, unknown>,
              state: 'call',
            },
          });
        }

        result.push({
          role: 'assistant',
          content: parts,
        } as ModelMessage);
      } else {
        result.push({ role: 'assistant', content });
      }
    } else if (msg instanceof ToolMessage) {
      // AI SDK tool messages carry results as tool-result parts
      // ToolResultPart uses `output` (not `result`) with a typed structure
      const toolCallId =
        msg.tool_call_id ?? `call_${Math.random().toString(36).slice(2, 10)}`;
      result.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result' as const,
            toolCallId,
            toolName: msg.name ?? 'unknown',
            output: { type: 'text' as const, value: content },
          },
        ],
      } satisfies ModelMessage);
    } else {
      // Fallback: treat as user message
      result.push({ role: 'user', content });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Context window guard
// ---------------------------------------------------------------------------

/**
 * Rough token estimator. Counts ~4 chars per token for English / code
 * and ~2 chars per token for CJK-heavy text. This is intentionally
 * conservative — it's a safety net, not a billing instrument.
 */
function estimateTokens(messages: BaseMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    totalChars += content.length;
  }
  // Blend: assume ~3 chars per token on average
  return Math.ceil(totalChars / 3);
}

/**
 * If the conversation exceeds CONTEXT_SNIP_RATIO of the budget, replace
 * the oldest ToolMessage contents with a placeholder. Returns the
 * trimmed message array (does not mutate the input).
 */
function snipOldToolResults(
  messages: BaseMessage[],
  contextWindowTokens: number,
): BaseMessage[] {
  const estimated = estimateTokens(messages);
  const threshold = Math.floor(contextWindowTokens * CONTEXT_SNIP_RATIO);

  if (estimated <= threshold) {
    return messages;
  }

  logger.info(
    `Context guard triggered: ~${estimated} tokens > ${threshold} threshold. ` +
      'Snipping old tool results.',
  );

  // Find tool messages from the oldest end and replace content until we're under budget
  const result = [...messages];
  let snipped = false;

  for (let i = 0; i < result.length; i++) {
    if (result[i] instanceof ToolMessage) {
      const original = result[i] as ToolMessage;
      const originalContent =
        typeof original.content === 'string'
          ? original.content
          : JSON.stringify(original.content);

      // Only snip if the content is substantial
      if (originalContent.length > 200) {
        result[i] = new ToolMessage({
          content: SNIPPED_PLACEHOLDER,
          tool_call_id: original.tool_call_id,
          name: original.name,
        });
        snipped = true;
      }
    }

    // Re-check if we're under budget
    if (snipped && estimateTokens(result) <= threshold) {
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

/** Result of executing a single tool call */
interface ToolCallResult {
  /** The ToolMessage to append to the conversation */
  message: ToolMessage;
  /** The ToolResult from the registry (for pauseForUser / terminateTurn checks) */
  result: ToolResult;
}

/**
 * Execute tool calls sequentially via the ToolRegistry.
 * Each tool call is wrapped in try/catch — errors become error tool messages.
 */
async function dispatchToolCalls(
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
  registry: ToolRegistry,
  streamBus: StreamBusImpl | null,
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];

  for (const tc of toolCalls) {
    const callId = tc.id || `call_${Math.random().toString(36).slice(2, 10)}`;

    logger.debug(`Dispatching tool call: ${tc.name} (id=${callId})`);

    // Emit tool_call event
    if (streamBus) {
      streamBus.emitToolCall(tc.name, tc.args);
    }

    let toolResult: ToolResult;

    try {
      if (!registry.has(tc.name)) {
        throw new Error(
          `Tool "${tc.name}" not found in registry. ` +
            'Analyze the error and try a different approach.',
        );
      }
      toolResult = await registry.execute(tc.name, tc.args);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`Tool "${tc.name}" failed: ${errorMsg}`);

      // Return error as a tool result so the LLM can recover
      toolResult = {
        content: `Error executing tool "${tc.name}": ${errorMsg}\n[Analyze the error above and try a different approach.]`,
        sources: [],
        metadata: { error: true },
        success: false,
        terminateTurn: false,
        pauseForUser: null,
      };
    }

    // Emit tool_result event
    if (streamBus) {
      streamBus.emitToolResult(tc.name, toolResult.content);
    }

    const toolMsg = new ToolMessage({
      content: toolResult.content,
      tool_call_id: callId,
      name: tc.name,
      status: toolResult.success ? 'success' : 'error',
    });

    results.push({ message: toolMsg, result: toolResult });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Agent node
// ---------------------------------------------------------------------------

/**
 * The agent node calls the LLM via AI SDK's `streamText`, collects the full
 * result (text + tool calls), and streams text deltas through the callback.
 *
 * Returns updated messages with the AI response appended and iterationCount + 1.
 */
function createAgentNode(config: AgentLoopConfig) {
  return async function agentNode(
    state: AgentLoopStateType,
  ): Promise<Partial<AgentLoopStateType>> {
    const iteration = (state.iterationCount ?? 0) + 1;
    const maxIter = state.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const sessionId = state.sessionId || config.sessionId || '';
    const turnId = state.turnId || config.turnId || '';

    logger.debug(`agent_node: iteration ${iteration}/${maxIter}`);

    // Create StreamBus for this node invocation
    const streamBus = config.streamCallback
      ? new StreamBusImpl(config.streamCallback, sessionId, turnId)
      : null;

    // Context window guard — trim old tool results if needed
    const contextBudget = config.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW;
    const safeMessages = snipOldToolResults(state.messages, contextBudget);

    // Convert messages for AI SDK
    const modelMessages = toModelMessages(safeMessages);

    // Check if we should force a no-tools final call (max iterations exhausted)
    const forceNoTools = iteration > maxIter;

    try {
      if (forceNoTools) {
        logger.info(
          `Max iterations (${maxIter}) reached. Forcing final response without tools.`,
        );

        // Force a final response without tools
        const finalResult = await generateText({
          model: config.model,
          messages: modelMessages,
          temperature: config.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: 4096,
        });

        const finalText = finalResult.text;

        if (streamBus) {
          streamBus.emitContent(finalText);
        }

        const aiMessage = new AIMessage({
          content: finalText,
        });

        return {
          messages: [aiMessage],
          iterationCount: iteration,
        };
      }

      // Normal LLM call with streaming
      const result = streamText({
        model: config.model,
        messages: modelMessages,
        tools: config.tools,
        temperature: config.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: 4096,
      });

      // Collect text deltas and stream them
      let fullText = '';

      // Iterate text stream for real-time streaming
      for await (const textDelta of result.textStream) {
        fullText += textDelta;
        if (streamBus) {
          streamBus.emitContent(textDelta);
        }
      }

      // After stream completes, extract tool calls and usage
      const toolCalls = await result.toolCalls;
      const usage = await result.usage;

      logger.debug(
        `LLM call complete: ${fullText.length} chars, ` +
          `${toolCalls.length} tool call(s), ` +
          `usage: ${usage.inputTokens ?? 0}p/${usage.outputTokens ?? 0}c`,
      );

      if (toolCalls.length > 0) {
        // Build an AIMessage with tool_calls in the LangChain format
        const langChainToolCalls = toolCalls.map((tc) => ({
          name: tc.toolName,
          args: tc.input as Record<string, unknown>,
          id: tc.toolCallId,
          type: 'tool_call' as const,
        }));

        const aiMessage = new AIMessage({
          content: fullText || '',
          tool_calls: langChainToolCalls,
        });

        return {
          messages: [aiMessage],
          iterationCount: iteration,
        };
      }

      // No tool calls — this is the final response
      const aiMessage = new AIMessage({
        content: fullText,
      });

      return {
        messages: [aiMessage],
        iterationCount: iteration,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`agent_node LLM call failed: ${errorMsg}`);

      if (streamBus) {
        streamBus.emitError(`LLM call failed: ${errorMsg}`);
      }

      // Return an error message so the graph can terminate gracefully
      const aiMessage = new AIMessage({
        content: `I encountered an error during processing: ${errorMsg}. Please try again.`,
      });

      return {
        messages: [aiMessage],
        iterationCount: iteration,
      };
    }
  };
}

// ---------------------------------------------------------------------------
// Tool node
// ---------------------------------------------------------------------------

/**
 * The tool node reads the last AIMessage's tool_calls, dispatches each through
 * the ToolRegistry, and handles pauseForUser / terminateTurn signals.
 */
function createToolNode(config: AgentLoopConfig) {
  return async function toolNode(
    state: AgentLoopStateType,
  ): Promise<Partial<AgentLoopStateType>> {
    const sessionId = state.sessionId || config.sessionId || '';
    const turnId = state.turnId || config.turnId || '';

    // Create StreamBus
    const streamBus = config.streamCallback
      ? new StreamBusImpl(config.streamCallback, sessionId, turnId)
      : null;

    // Extract tool calls from the last AI message
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage || !(lastMessage instanceof AIMessage)) {
      logger.warn('tool_node: last message is not an AIMessage, skipping');
      return { messages: [] };
    }

    const toolCalls = lastMessage.tool_calls ?? [];

    if (toolCalls.length === 0) {
      logger.warn('tool_node: no tool_calls found on last AIMessage, skipping');
      return { messages: [] };
    }

    logger.debug(`tool_node: dispatching ${toolCalls.length} tool call(s)`);

    // Prepare tool calls for dispatch
    const preparedCalls = toolCalls.map((tc) => ({
      id: tc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
      name: tc.name,
      args: (tc.args ?? {}) as Record<string, unknown>,
    }));

    // Execute sequentially
    const results = await dispatchToolCalls(
      preparedCalls,
      config.toolRegistry,
      streamBus,
    );

    // Collect tool messages and check for special signals
    const toolMessages: BaseMessage[] = [];
    let shouldTerminate = false;

    for (const { message, result: toolResult } of results) {
      toolMessages.push(message);

      // Handle pauseForUser — emit wait_for_input and await user reply
      if (toolResult.pauseForUser) {
        const inputHandler = config.inputHandler ?? getInputHandler();
        const prompt =
          (toolResult.pauseForUser.prompt as string) ??
          toolResult.content ??
          'Please provide more information.';

        logger.info(`Tool requested pauseForUser: ${prompt}`);

        if (streamBus) {
          streamBus.emitWaitForInput(turnId, prompt);
        }

        try {
          const userReply = await inputHandler.waitForInput(turnId);

          logger.info(`Received user reply during pauseForUser: ${userReply.slice(0, 100)}...`);

          // Append user reply as a HumanMessage so the LLM sees it
          toolMessages.push(new HumanMessage(userReply));
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`pauseForUser failed: ${errorMsg}`);

          // Append a system-level note about the timeout
          toolMessages.push(
            new HumanMessage(
              '[The user did not respond within the timeout period. Please proceed with available information.]',
            ),
          );
        }
      }

      // Handle terminateTurn
      if (toolResult.terminateTurn) {
        logger.info(`Tool "${message.name}" requested turn termination`);
        shouldTerminate = true;
      }

      // Emit sources if the tool produced any
      if (toolResult.sources && toolResult.sources.length > 0 && streamBus) {
        streamBus.emitSources(
          toolResult.sources.map((s: Record<string, unknown>) => ({
            name: (s.name as string) ?? (s.title as string) ?? 'Source',
            url: s.url as string | undefined,
            kind: s.kind as string | undefined,
          })),
        );
      }
    }

    return {
      messages: toolMessages,
      terminateTurn: shouldTerminate,
    };
  };
}

// ---------------------------------------------------------------------------
// Conditional edge
// ---------------------------------------------------------------------------

/**
 * Decide whether to continue to tools or end the loop.
 *
 * Routes to 'tools' when:
 * - The last message is an AIMessage with tool_calls
 * - iterationCount < maxIterations
 * - terminateTurn is not set
 *
 * Routes to END otherwise.
 */
function shouldContinue(state: AgentLoopStateType): string {
  // Check terminateTurn flag (set by tools)
  if (state.terminateTurn) {
    logger.debug('shouldContinue: terminateTurn is set → END');
    return END;
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage) {
    return END;
  }

  // Check if the last message has tool calls
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    const maxIter = state.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const iteration = state.iterationCount ?? 0;

    if (iteration >= maxIter) {
      logger.warn(
        `shouldContinue: max iterations (${maxIter}) reached, forcing END`,
      );
      return END;
    }

    logger.debug(
      `shouldContinue: ${lastMessage.tool_calls.length} tool call(s) → tools`,
    );
    return 'tools';
  }

  logger.debug('shouldContinue: no tool calls → END');
  return END;
}

// ---------------------------------------------------------------------------
// Graph compilation
// ---------------------------------------------------------------------------

/**
 * Compile the agent loop as a LangGraph StateGraph.
 *
 * Graph structure:
 * ```
 *   START → agent ──conditional──→ tools → agent (loop)
 *                 ╲
 *                  └──→ END
 * ```
 */
export function compileAgentLoop(
  config: AgentLoopConfig,
) {
  const agentNodeFn = createAgentNode(config);
  const toolNodeFn = createToolNode(config);

  const graph = new StateGraph(AgentLoopState)
    .addNode('agent', agentNodeFn)
    .addNode('tools', toolNodeFn)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue as never, {
      tools: 'tools',
      [END]: END,
    })
    .addEdge('tools', 'agent');

  return graph.compile();
}

// ---------------------------------------------------------------------------
// High-level runner
// ---------------------------------------------------------------------------

/** Result returned by `runAgentLoop` */
export interface AgentLoopResult {
  /** Full message history after the loop */
  messages: BaseMessage[];
  /** The text content of the final AI response */
  text: string;
  /** Number of LLM iterations executed */
  iterationCount: number;
}

/**
 * Run the complete agent loop from initial messages to completion.
 *
 * This is the primary entry point for executing a turn. It compiles the
 * graph, invokes it with the provided messages, and extracts the final
 * text response.
 *
 * @param config          — AgentLoop configuration (model, tools, registry, etc.)
 * @param initialMessages — Starting messages (typically system + user)
 * @returns The final messages, extracted text, and iteration count
 */
export async function runAgentLoop(
  config: AgentLoopConfig,
  initialMessages: BaseMessage[],
): Promise<AgentLoopResult> {
  const sessionId = config.sessionId ?? '';
  const turnId = config.turnId ?? '';
  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  logger.info(
    `Starting agent loop: session=${sessionId}, turn=${turnId}, ` +
      `maxIterations=${maxIterations}, initialMessages=${initialMessages.length}`,
  );

  const graph = compileAgentLoop(config);

  // Invoke the compiled graph
  const result = await graph.invoke({
    messages: initialMessages,
    iterationCount: 0,
    maxIterations,
    terminateTurn: false,
    sessionId,
    turnId,
  });

  // Extract the final text from the last AI message
  const finalMessages = result.messages as BaseMessage[];
  let finalText = '';

  // Walk backwards to find the last AIMessage with content
  for (let i = finalMessages.length - 1; i >= 0; i--) {
    const msg = finalMessages[i];
    if (msg instanceof AIMessage) {
      const content =
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (content) {
        finalText = content;
        break;
      }
    }
  }

  const iterationCount = (result.iterationCount as number) ?? 0;

  logger.info(
    `Agent loop complete: iterations=${iterationCount}, ` +
      `messages=${finalMessages.length}, text=${finalText.length} chars`,
  );

  return {
    messages: finalMessages,
    text: finalText,
    iterationCount,
  };
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { AgentLoopState, type AgentLoopStateType };
export type { ToolCallResult };
