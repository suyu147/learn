/**
 * DeepTutor Bootstrap — Initialize registries and capabilities
 *
 * Single-module initialization point for the DeepTutor migration.
 * Called once at first request (lazy singleton pattern).
 */

import { ToolRegistry } from '@/lib/deeptutor/tools/registry';
import { CapabilityRegistry } from '@/lib/deeptutor/capabilities/registry';
import { registerSimpleTools } from '@/lib/deeptutor/tools/register-simple';
import { ChatCapability } from '@/lib/deeptutor/capabilities/chat/chat-capability';
import { ChatOrchestrator } from '@/lib/deeptutor/core/orchestrator';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import type { ProviderId } from '@/lib/types/provider';
import { createLogger } from '@/lib/logger';
// Phase 2b — RAG + read_source
import { RAGTool, setRAGToolContext } from '@/lib/deeptutor/tools/rag';
import { ReadSourceTool } from '@/lib/deeptutor/tools/read-source';
import { createEmbeddingService } from '@/lib/deeptutor/services/embedding';
import { RAGServiceImpl } from '@/lib/deeptutor/services/rag';
import { KBSeedService } from '@/lib/deeptutor/services/kb-seed';
// Phase 2c — Sandbox + Memory + Notebook + Deferred loader
import { SandboxServiceImpl } from '@/lib/deeptutor/services/sandbox';
import { MemoryServiceImpl } from '@/lib/deeptutor/services/memory';
import { NotebookServiceImpl } from '@/lib/deeptutor/services/notebook';
import { CodeExecutionTool, setSandboxToolContext } from '@/lib/deeptutor/tools/code-execution';
import { ReadMemoryTool, setReadMemoryContext } from '@/lib/deeptutor/tools/read-memory';
import { WriteMemoryTool, setWriteMemoryContext } from '@/lib/deeptutor/tools/write-memory';
import { ListNotebookTool, setListNotebookContext } from '@/lib/deeptutor/tools/list-notebook';
import { WriteNoteTool, setWriteNoteContext } from '@/lib/deeptutor/tools/write-note';
import { PaperSearchTool } from '@/lib/deeptutor/tools/paper-search';
import { LoadToolsTool } from '@/lib/deeptutor/tools/deferred-loader';
// Phase 2d — SmartLearn GraphCapability
import { SmartLearnCapability } from '@/lib/deeptutor/capabilities/smartlearn';
// Phase 3a — Services
import { PersonaServiceImpl } from '@/lib/deeptutor/services/persona';
import { SkillServiceImpl } from '@/lib/deeptutor/services/skill';
import { LearningServiceImpl } from '@/lib/deeptutor/services/learning';
// Phase 3a — Tools
import { GithubTool, setGithubToolContext } from '@/lib/deeptutor/tools/github';
import { ReadSkillTool, setReadSkillContext } from '@/lib/deeptutor/tools/read-skill';
import { SolvePlanTool, setSolvePlanContext } from '@/lib/deeptutor/tools/solve-plan';
import { SolveFinishStepTool } from '@/lib/deeptutor/tools/solve-finish-step';
import { SolveReplanTool } from '@/lib/deeptutor/tools/solve-replan';
import {
  MasteryStatusTool,
  MasteryQuizTool,
  MasteryGradeTool,
  MasteryAssessTool,
  MasteryBuildTool,
  setMasteryToolsContext,
} from '@/lib/deeptutor/tools/mastery';
// Phase 3a — Capabilities
import { DeepSolveCapability } from '@/lib/deeptutor/capabilities/solve';
import { MasteryPathCapability } from '@/lib/deeptutor/capabilities/mastery';
import { ExploreContextCapability } from '@/lib/deeptutor/capabilities/explore';
// Phase 3b — Capabilities + MCP
import { DeepQuestionCapability } from '@/lib/deeptutor/capabilities/question';
import { DeepResearchCapability } from '@/lib/deeptutor/capabilities/research';
import { VisualizeCapability } from '@/lib/deeptutor/capabilities/visualize';
import { MCPService } from '@/lib/deeptutor/services/mcp';

const log = createLogger('Bootstrap');

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let _toolRegistry: ToolRegistry | null = null;
let _capabilityRegistry: CapabilityRegistry | null = null;
let _orchestrator: ChatOrchestrator | null = null;
// Phase 2b services
let _embeddingService: ReturnType<typeof createEmbeddingService> | null = null;
let _ragService: RAGServiceImpl | null = null;
let _kbSeedService: KBSeedService | null = null;
// Phase 2c services
let _sandboxService: SandboxServiceImpl | null = null;
let _memoryService: MemoryServiceImpl | null = null;
let _notebookService: NotebookServiceImpl | null = null;
// Phase 3a services
let _personaService: PersonaServiceImpl | null = null;
let _skillService: SkillServiceImpl | null = null;
let _learningService: LearningServiceImpl | null = null;
// Phase 3b services
let _mcpService: MCPService | null = null;

/** Create an LLM call function for tools (brainstorm, reason) */
function createToolLLMCall() {
  return async (params: {
    system: string;
    prompt: string;
    temperature: number;
    maxTokens: number;
  }): Promise<string> => {
    // Default to OpenAI gpt-4o-mini for tool LLM calls
    const providerId = (process.env.DT_TOOL_PROVIDER ?? 'openai') as ProviderId;
    const modelId = process.env.DT_TOOL_MODEL ?? 'gpt-4o-mini';
    const apiKey = process.env.DT_TOOL_API_KEY ?? process.env.OPENAI_API_KEY ?? '';

    if (!apiKey) {
      log.warn('No API key configured for tool LLM calls, returning placeholder');
      return '[LLM not configured — set DT_TOOL_API_KEY or OPENAI_API_KEY]';
    }

    try {
      const { model } = getModel({
        providerId,
        modelId,
        apiKey,
      });

      const result = await callLLM(
        {
          model,
          system: params.system,
          prompt: params.prompt,
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
        },
        'tool-llm',
      );

      return result.text;
    } catch (err) {
      log.error('Tool LLM call failed:', err);
      return `[LLM error: ${err instanceof Error ? err.message : String(err)}]`;
    }
  };
}

/** Initialize all registries and capabilities */
function bootstrap(): {
  toolRegistry: ToolRegistry;
  capabilityRegistry: CapabilityRegistry;
  orchestrator: ChatOrchestrator;
  embeddingService: ReturnType<typeof createEmbeddingService>;
  ragService: RAGServiceImpl;
  kbSeedService: KBSeedService;
  sandboxService: SandboxServiceImpl;
  memoryService: MemoryServiceImpl;
  notebookService: NotebookServiceImpl;
  personaService: PersonaServiceImpl;
  skillService: SkillServiceImpl;
  learningService: LearningServiceImpl;
  mcpService: MCPService;
} {
  if (_orchestrator) {
    return {
      toolRegistry: _toolRegistry!,
      capabilityRegistry: _capabilityRegistry!,
      orchestrator: _orchestrator,
      embeddingService: _embeddingService!,
      ragService: _ragService!,
      kbSeedService: _kbSeedService!,
      sandboxService: _sandboxService!,
      memoryService: _memoryService!,
      notebookService: _notebookService!,
      personaService: _personaService!,
      skillService: _skillService!,
      learningService: _learningService!,
      mcpService: _mcpService!,
    };
  }

  log.info('Bootstrapping DeepTutor services...');

  // -----------------------------------------------------------------------
  // 1. Create tool registry and register simple tools
  // -----------------------------------------------------------------------
  const toolRegistry = new ToolRegistry();
  const llmCall = createToolLLMCall();
  registerSimpleTools(toolRegistry, { llmCall });
  log.info(`Registered ${toolRegistry.getAll().length} simple tools`);

  // -----------------------------------------------------------------------
  // 1b. Phase 2b — RAG + read_source + KB seed
  // -----------------------------------------------------------------------
  const embeddingService = createEmbeddingService();
  const ragService = new RAGServiceImpl(embeddingService);
  const kbSeedService = new KBSeedService(ragService);

  setRAGToolContext(ragService, 'anonymous');

  const ragTool = new RAGTool();
  const readSourceTool = new ReadSourceTool();
  toolRegistry.register(ragTool);
  toolRegistry.register(readSourceTool);

  log.info(`Phase 2b: registered RAG + read_source tools`);

  // -----------------------------------------------------------------------
  // 1c. Phase 2c — Sandbox + Memory + Notebook + Deferred tools
  // -----------------------------------------------------------------------
  const sandboxService = new SandboxServiceImpl();
  const memoryService = new MemoryServiceImpl();
  const notebookService = new NotebookServiceImpl();

  // Set tool contexts (user defaults to 'anonymous' — overridden per-turn by agent loop)
  const defaultUserId = 'anonymous';
  setSandboxToolContext(sandboxService);
  setReadMemoryContext(memoryService, defaultUserId);
  setWriteMemoryContext(memoryService, defaultUserId);
  setListNotebookContext(notebookService, defaultUserId);
  setWriteNoteContext(notebookService, defaultUserId);

  // Register Phase 2c tools
  const codeExecutionTool = new CodeExecutionTool();
  const readMemoryTool = new ReadMemoryTool();
  const writeMemoryTool = new WriteMemoryTool();
  const listNotebookTool = new ListNotebookTool();
  const writeNoteTool = new WriteNoteTool();
  const paperSearchTool = new PaperSearchTool();
  const loadToolsTool = new LoadToolsTool(toolRegistry);

  toolRegistry.register(codeExecutionTool);
  toolRegistry.register(readMemoryTool);
  toolRegistry.register(writeMemoryTool);
  toolRegistry.register(listNotebookTool);
  toolRegistry.register(writeNoteTool);
  toolRegistry.register(paperSearchTool);
  toolRegistry.register(loadToolsTool);

  log.info(`Phase 2c: registered code_execution, read/write_memory, list_notebook, write_note, paper_search, load_tools`);
  log.info(`Total registered tools: ${toolRegistry.getAll().length}`);

  // -----------------------------------------------------------------------
  // 1d. Phase 3a — Persona + Skill + Learning services + tools
  // -----------------------------------------------------------------------
  const personaService = new PersonaServiceImpl();
  const skillService = new SkillServiceImpl();
  const learningService = new LearningServiceImpl();

  // Set tool contexts
  setGithubToolContext();
  setReadSkillContext(skillService);
  setSolvePlanContext(llmCall);
  setMasteryToolsContext(learningService, defaultUserId, llmCall);

  // Register Phase 3a tools
  const githubTool = new GithubTool();
  const readSkillTool = new ReadSkillTool();
  const solvePlanTool = new SolvePlanTool();
  const solveFinishStepTool = new SolveFinishStepTool();
  const solveReplanTool = new SolveReplanTool();
  const masteryStatusTool = new MasteryStatusTool();
  const masteryQuizTool = new MasteryQuizTool();
  const masteryGradeTool = new MasteryGradeTool();
  const masteryAssessTool = new MasteryAssessTool();
  const masteryBuildTool = new MasteryBuildTool();

  toolRegistry.register(githubTool);
  toolRegistry.register(readSkillTool);
  toolRegistry.register(solvePlanTool);
  toolRegistry.register(solveFinishStepTool);
  toolRegistry.register(solveReplanTool);
  toolRegistry.register(masteryStatusTool);
  toolRegistry.register(masteryQuizTool);
  toolRegistry.register(masteryGradeTool);
  toolRegistry.register(masteryAssessTool);
  toolRegistry.register(masteryBuildTool);

  log.info(`Phase 3a: registered github, read_skill, solve_plan/finish_step/replan, 5 mastery tools`);
  log.info(`Total registered tools: ${toolRegistry.getAll().length}`);

  // -----------------------------------------------------------------------
  // 2. Create capability registry and register capabilities
  // -----------------------------------------------------------------------
  const capabilityRegistry = new CapabilityRegistry();
  const chatCapability = new ChatCapability(toolRegistry);
  capabilityRegistry.register(chatCapability);

  // Phase 2d: SmartLearn GraphCapability
  const smartLearnCapability = new SmartLearnCapability();
  capabilityRegistry.register(smartLearnCapability);

  // Phase 3a: Loop Capabilities
  const deepSolveCapability = new DeepSolveCapability(toolRegistry);
  capabilityRegistry.register(deepSolveCapability);

  const masteryPathCapability = new MasteryPathCapability(toolRegistry);
  capabilityRegistry.register(masteryPathCapability);

  const exploreContextCapability = new ExploreContextCapability(toolRegistry);
  capabilityRegistry.register(exploreContextCapability);

  // Phase 3b: Agent Capabilities
  const deepQuestionCapability = new DeepQuestionCapability(toolRegistry);
  capabilityRegistry.register(deepQuestionCapability);

  const deepResearchCapability = new DeepResearchCapability(toolRegistry);
  capabilityRegistry.register(deepResearchCapability);

  const visualizeCapability = new VisualizeCapability();
  capabilityRegistry.register(visualizeCapability);

  log.info(`Registered ${capabilityRegistry.getAll().length} capabilities (chat, smartlearn, deep_solve, mastery_path, explore_context, deep_question, deep_research, visualize)`);

  // -----------------------------------------------------------------------
  // 3. Create orchestrator
  // -----------------------------------------------------------------------
  const orchestrator = new ChatOrchestrator({
    capabilityRegistry,
    toolRegistry,
  });

  // -----------------------------------------------------------------------
  // 4. Phase 3b — MCP Service
  // -----------------------------------------------------------------------
  const mcpService = new MCPService();

  // Connect any pre-configured MCP servers from environment
  const mcpServersEnv = process.env.DT_MCP_SERVERS;
  if (mcpServersEnv) {
    try {
      const serverConfigs = JSON.parse(mcpServersEnv);
      if (Array.isArray(serverConfigs)) {
        for (const config of serverConfigs) {
          mcpService.addServer(config);
        }
        log.info(`Configured ${serverConfigs.length} MCP server(s) from DT_MCP_SERVERS`);
      }
    } catch (err) {
      log.error('Failed to parse DT_MCP_SERVERS env var:', err);
    }
  }

  // Persist singleton state
  _toolRegistry = toolRegistry;
  _capabilityRegistry = capabilityRegistry;
  _orchestrator = orchestrator;
  _embeddingService = embeddingService;
  _ragService = ragService;
  _kbSeedService = kbSeedService;
  _sandboxService = sandboxService;
  _memoryService = memoryService;
  _notebookService = notebookService;
  _personaService = personaService;
  _skillService = skillService;
  _learningService = learningService;
  _mcpService = mcpService;

  log.info('DeepTutor bootstrap complete (Phase 3b)');
  return {
    toolRegistry, capabilityRegistry, orchestrator,
    embeddingService, ragService, kbSeedService,
    sandboxService, memoryService, notebookService,
    personaService, skillService, learningService,
    mcpService,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getToolRegistry(): ToolRegistry {
  return bootstrap().toolRegistry;
}

export function getCapabilityRegistry(): CapabilityRegistry {
  return bootstrap().capabilityRegistry;
}

export function getOrchestrator(): ChatOrchestrator {
  return bootstrap().orchestrator;
}

export function getEmbeddingService() {
  return bootstrap().embeddingService;
}

export function getRAGService() {
  return bootstrap().ragService;
}

export function getKBSeedService() {
  return bootstrap().kbSeedService;
}

// Phase 2c service accessors
export function getSandboxService() {
  return bootstrap().sandboxService;
}

export function getMemoryService() {
  return bootstrap().memoryService;
}

export function getNotebookService() {
  return bootstrap().notebookService;
}

// Phase 3a service accessors
export function getPersonaService() {
  return bootstrap().personaService;
}

export function getSkillService() {
  return bootstrap().skillService;
}

export function getLearningService() {
  return bootstrap().learningService;
}

// Phase 3b service accessors
export function getMCPService() {
  return bootstrap().mcpService;
}
