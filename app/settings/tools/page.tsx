'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tool Toggle Component
// ---------------------------------------------------------------------------

interface ToolToggleProps {
  name: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function ToolToggle({ name, description, enabled, onToggle }: ToolToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4 bg-[var(--card)]">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)]">{name}</p>
        <p className="text-[12px] text-[var(--muted-foreground)]">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          enabled ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            enabled && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools Settings Page
// ---------------------------------------------------------------------------

const DEFAULT_TOOLS = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Allow the agent to search the internet for up-to-date information',
    enabled: true,
  },
  {
    id: 'code_execution',
    name: 'Code Execution',
    description: 'Allow the agent to run Python code for computation and validation',
    enabled: true,
  },
  {
    id: 'reason',
    name: 'Reasoning Chain',
    description: 'Enable step-by-step reasoning with full thought process',
    enabled: true,
  },
  {
    id: 'rag',
    name: 'Knowledge Retrieval',
    description: 'Retrieve relevant document fragments from indexed knowledge bases',
    enabled: true,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Generate multiple creative ideas and directions',
    enabled: true,
  },
  {
    id: 'paper_search',
    name: 'Paper Search',
    description: 'Search academic papers and research publications',
    enabled: false,
  },
];

export default function ToolsPage() {
  const [tools, setTools] = useState(DEFAULT_TOOLS);

  const toggleTool = (id: string) => {
    setTools(tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const enabledCount = tools.filter((t) => t.enabled).length;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          Tools
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Manage external tools available to the agent ({enabledCount}/{tools.length} enabled)
        </p>
      </div>

      <div className="space-y-3">
        {tools.map((tool) => (
          <ToolToggle
            key={tool.id}
            name={tool.name}
            description={tool.description}
            enabled={tool.enabled}
            onToggle={() => toggleTool(tool.id)}
          />
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setTools(tools.map((t) => ({ ...t, enabled: true })))}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Enable All
        </button>
        <button
          onClick={() => setTools(tools.map((t) => ({ ...t, enabled: false })))}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Disable All
        </button>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <p className="text-[12px] text-[var(--muted-foreground)]">
          Tool settings apply to new conversations. The enabled tool set is sent with each turn request.
        </p>
      </div>
    </div>
  );
}
