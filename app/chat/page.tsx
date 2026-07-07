'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Settings,
  Paperclip,
  BookOpen,
  Send,
  MessageSquare,
  Lightbulb,
  HelpCircle,
  Search as SearchIcon,
  BarChart3,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  Bot,
  StopCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/lib/store/chat-store';
import { useSessionStore } from '@/lib/store/session-store';
import { useSettingsStoreV2 } from '@/lib/store/settings-store';
import { useKnowledgeStore } from '@/lib/store/knowledge-store';
import { useTurnStream, type ToolCallInfo } from '@/lib/hooks/use-turn-stream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Capability = 'chat' | 'solve' | 'quiz' | 'research' | 'visualize';

const capabilities: {
  id: Capability;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  capabilityName: string;
}[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, capabilityName: 'chat' },
  { id: 'solve', label: 'Solve', icon: Lightbulb, capabilityName: 'deep_solve' },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle, capabilityName: 'mastery_path' },
  { id: 'research', label: 'Research', icon: SearchIcon, capabilityName: 'deep_research' },
  { id: 'visualize', label: 'Visualize', icon: BarChart3, capabilityName: 'visualize' },
];

// ---------------------------------------------------------------------------
// Chat Page
// ---------------------------------------------------------------------------

export default function ChatPage() {
  // Store selectors
  const messages = useChatStore((s) => s.messages);
  const isStreamingStore = useChatStore((s) => s.isStreaming);
  const activeCapability = useChatStore((s) => s.currentCapability);
  const setCapability = useChatStore((s) => s.setCapability);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  const settings = useSettingsStoreV2();
  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);

  // Turn stream
  const stream = useTurnStream();

  // Local UI state
  const [messageInput, setMessageInput] = useState('');
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [toolCallsExpanded, setToolCallsExpanded] = useState(true);
  const [selectedKBs, setSelectedKBs] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, stream.getStreamingContent()]);

  // Ensure there's an active session
  useEffect(() => {
    if (!activeSessionId) {
      const newSession = {
        id: `session-${Date.now()}`,
        title: 'New Chat',
        mode: 'chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active' as const,
      };
      addSession(newSession);
      setActiveSession(newSession.id);
    }
  }, [activeSessionId, addSession, setActiveSession]);

  // Handle send
  const handleSend = useCallback(async () => {
    const text = messageInput.trim();
    if (!text || stream.isStreaming) return;

    setMessageInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Build conversation history from store messages (last 20)
    const history = messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const cap = capabilities.find((c) => c.id === activeCapability);

    await stream.send({
      sessionId: activeSessionId ?? `session-${Date.now()}`,
      message: text,
      capability: cap?.capabilityName,
      knowledgeBases: selectedKBs.length > 0 ? selectedKBs : undefined,
      language: settings.language,
      providerId: settings.smartlearnProviderId || undefined,
      modelId: settings.smartlearnModelId || undefined,
      apiKey: settings.smartlearnApiKey || undefined,
      baseUrl: settings.smartlearnBaseUrl || undefined,
      conversationHistory: history,
    });
  }, [
    messageInput,
    stream,
    messages,
    activeCapability,
    activeSessionId,
    selectedKBs,
    settings,
  ]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Get current streaming content for live display
  const streamingContent = stream.getStreamingContent();

  // Active session info
  const currentSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[var(--foreground)]">
              {currentSession?.title ?? 'Chat'}
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
              {capabilities.find((c) => c.id === activeCapability)?.label ?? 'Chat'}
            </span>
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <Search className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <Settings className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && !stream.isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-10 w-10 text-[var(--muted-foreground)] mb-4 opacity-40" />
              <h2 className="text-[16px] font-medium text-[var(--foreground)] mb-2">
                Start a conversation
              </h2>
              <p className="text-[13px] text-[var(--muted-foreground)] max-w-sm">
                Ask questions, solve problems, or explore topics. Select a capability below to change the interaction mode.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[70%] bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded-2xl rounded-tr-sm px-4 py-3">
                    <p className="text-[13.5px] leading-relaxed">{msg.content}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            }

            // Assistant message
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-4 w-4 text-[var(--primary)]" />
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      Assistant
                    </span>
                  </div>

                  {/* Thinking block */}
                  {msg.thinking && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-2">
                      <button
                        onClick={() => setThinkingExpanded(!thinkingExpanded)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--muted)] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-3.5 w-3.5 text-[var(--primary)]" />
                          <span className="text-[12px] font-medium text-[var(--foreground)]">
                            Thinking process
                          </span>
                        </div>
                        {thinkingExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                        )}
                      </button>
                      {thinkingExpanded && (
                        <div className="px-4 pb-3 border-t border-[var(--border)] pt-3">
                          <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed whitespace-pre-wrap">
                            {msg.thinking}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool calls inline */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.toolCalls.map((tc, idx) => (
                        <div
                          key={idx}
                          className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="h-3 w-3 text-[var(--success)]" />
                          <span className="text-[11px] text-[var(--muted-foreground)]">
                            {tc.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message content */}
                  <div className="prose prose-sm max-w-none text-[var(--foreground)]">
                    <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Live streaming indicator + content */}
          {stream.isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    Assistant
                  </span>
                  {stream.stage && (
                    <span className="text-[10px] text-[var(--primary)] font-medium bg-[var(--primary)]/10 px-1.5 py-0.5 rounded">
                      {stream.stage}
                    </span>
                  )}
                </div>

                {/* Live thinking */}
                {stream.thinking && (
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden mb-2">
                    <button
                      onClick={() => setThinkingExpanded(!thinkingExpanded)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--muted)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-[var(--primary)] animate-pulse" />
                        <span className="text-[12px] font-medium text-[var(--foreground)]">
                          Thinking...
                        </span>
                      </div>
                      {thinkingExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                    {thinkingExpanded && (
                      <div className="px-4 pb-3 border-t border-[var(--border)] pt-3">
                        <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed whitespace-pre-wrap">
                          {stream.thinking}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Live tool calls */}
                {stream.toolCalls.length > 0 && toolCallsExpanded && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {stream.toolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                      >
                        {tc.status === 'running' ? (
                          <Loader2 className="h-3 w-3 text-[var(--primary)] animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-[var(--success)]" />
                        )}
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          {tc.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Live streaming content */}
                {streamingContent ? (
                  <div className="prose prose-sm max-w-none text-[var(--foreground)]">
                    <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      {streamingContent}
                      <span className="inline-block w-1.5 h-4 bg-[var(--primary)] animate-pulse ml-0.5 align-middle" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-1">
                    <div className="flex gap-1">
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ask_user prompt */}
          {stream.waitForInput && (
            <div className="flex justify-start">
              <div className="bg-[var(--card)] border-2 border-[var(--primary)]/30 rounded-xl p-4 max-w-[70%]">
                <p className="text-[13px] text-[var(--foreground)] mb-3">
                  {stream.waitForInput.prompt || 'The assistant needs your input:'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[var(--primary)]"
                    placeholder="Your answer..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        stream.submitInput(e.currentTarget.value.trim());
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                      if (input?.value?.trim()) {
                        stream.submitInput(input.value.trim());
                        input.value = '';
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[13px] font-medium hover:opacity-90"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {stream.error && (
            <div className="flex justify-start">
              <div className="bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-xl px-4 py-3 max-w-[70%]">
                <p className="text-[13px] text-[var(--destructive)]">{stream.error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Capability Tabs */}
        <div className="border-t border-[var(--border)] px-6 py-3">
          <div className="flex gap-2">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <button
                  key={cap.id}
                  onClick={() => setCapability(cap.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all',
                    activeCapability === cap.id
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cap.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-[var(--border)] px-6 py-4">
          <div className="flex gap-2 items-end">
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <Paperclip className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
            <button className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
              <BookOpen className="h-[18px] w-[18px] text-[var(--muted-foreground)]" />
            </button>
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={messageInput}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] resize-none min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={stream.isStreaming}
              />
            </div>
            {stream.isStreaming ? (
              <button
                onClick={stream.cancel}
                className="px-4 py-2.5 rounded-lg bg-[var(--destructive)] text-white hover:opacity-90 transition-opacity"
              >
                <StopCircle className="h-[18px] w-[18px]" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!messageInput.trim()}
                className={cn(
                  'px-4 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity',
                  !messageInput.trim() && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Send className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-2 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Right Activity Panel */}
      <div className="w-80 border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Agent Status */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
              Agent Status
            </h3>
            <div className="bg-[var(--background)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">Status</span>
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    stream.isStreaming
                      ? 'text-[var(--primary)]'
                      : stream.error
                        ? 'text-[var(--destructive)]'
                        : 'text-[var(--success)]',
                  )}
                >
                  {stream.isStreaming
                    ? 'Running'
                    : stream.error
                      ? 'Error'
                      : 'Ready'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--foreground)]">
                  Active tools
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {stream.toolCalls.filter((tc) => tc.status === 'running').length}
                </span>
              </div>
              {stream.stage && (
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-[var(--foreground)]">Stage</span>
                  <span className="text-[11px] text-[var(--primary)] font-medium">
                    {stream.stage}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tool Calls */}
          {stream.toolCalls.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
                className="flex items-center gap-1 w-full"
              >
                <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  Tool Calls ({stream.toolCalls.length})
                </h3>
                {toolCallsExpanded ? (
                  <ChevronUp className="h-3 w-3 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
                )}
              </button>
              {toolCallsExpanded && (
                <div className="space-y-1.5">
                  {stream.toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="bg-[var(--background)] rounded-lg p-2.5 flex items-center justify-between"
                    >
                      <span className="text-[12px] text-[var(--foreground)]">
                        {tc.name}
                      </span>
                      {tc.status === 'running' ? (
                        <Loader2 className="h-3.5 w-3.5 text-[var(--primary)] animate-spin" />
                      ) : tc.status === 'completed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-[var(--destructive)]" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Knowledge Bases */}
          {knowledgeBases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                Knowledge Bases
              </h3>
              <div className="space-y-1.5">
                {knowledgeBases.map((kb) => {
                  const isSelected = selectedKBs.includes(kb.id);
                  return (
                    <button
                      key={kb.id}
                      onClick={() =>
                        setSelectedKBs((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== kb.id)
                            : [...prev, kb.id],
                        )
                      }
                      className={cn(
                        'w-full bg-[var(--background)] rounded-lg p-2.5 flex items-center justify-between transition-colors',
                        isSelected && 'ring-1 ring-[var(--primary)]',
                      )}
                    >
                      <div className="text-left min-w-0 flex-1">
                        <span className="text-[12px] text-[var(--foreground)] block truncate">
                          {kb.name}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {kb.documentCount} docs · {kb.blockCount} blocks
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-medium ml-2 shrink-0',
                          kb.indexStatus === 'ready'
                            ? 'text-[var(--success)]'
                            : 'text-[var(--warning)]',
                        )}
                      >
                        {kb.indexStatus === 'ready' ? 'Ready' : kb.indexStatus}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sources */}
          {stream.sources.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                Sources
              </h3>
              <div className="space-y-1.5">
                {stream.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--background)] rounded-lg p-2.5"
                  >
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-[var(--primary)] hover:underline block truncate"
                      >
                        {source.name}
                      </a>
                    ) : (
                      <span className="text-[12px] text-[var(--foreground)] block truncate">
                        {source.name}
                      </span>
                    )}
                    {source.kind && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {source.kind}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
