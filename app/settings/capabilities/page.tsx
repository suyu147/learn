'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { Zap, MessageSquare, Lightbulb, Target, BookOpen, HelpCircle, BarChart3 } from 'lucide-react'

interface ToggleFieldProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleField({ label, description, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4 bg-[var(--card)]">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-[12px] text-[var(--muted-foreground)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

interface CapabilityConfig {
  id: string
  name: string
  description: string
  icon: React.ElementType
  modelOverride: string
  temperature: number
  maxTokens: number
  enabled: boolean
}

const DEFAULT_CAPABILITIES: CapabilityConfig[] = [
  {
    id: 'chat',
    name: 'Chat',
    description: 'General conversation and Q&A responses',
    icon: MessageSquare,
    modelOverride: '',
    temperature: 0.7,
    maxTokens: 4096,
    enabled: true,
  },
  {
    id: 'deep_solve',
    name: 'Deep Solve',
    description: 'Complex multi-step problem solving with chain-of-thought',
    icon: Lightbulb,
    modelOverride: '',
    temperature: 0.3,
    maxTokens: 8192,
    enabled: true,
  },
  {
    id: 'mastery_path',
    name: 'Mastery Path',
    description: 'Personalized learning path generation and curriculum design',
    icon: Target,
    modelOverride: '',
    temperature: 0.5,
    maxTokens: 6144,
    enabled: true,
  },
  {
    id: 'deep_research',
    name: 'Deep Research',
    description: 'In-depth research synthesis across multiple sources',
    icon: BookOpen,
    modelOverride: '',
    temperature: 0.4,
    maxTokens: 16384,
    enabled: true,
  },
  {
    id: 'deep_question',
    name: 'Deep Question',
    description: 'Socratic questioning and probing for deeper understanding',
    icon: HelpCircle,
    modelOverride: '',
    temperature: 0.6,
    maxTokens: 4096,
    enabled: false,
  },
  {
    id: 'visualize',
    name: 'Visualize',
    description: 'Diagram generation, chart creation, and visual explanations',
    icon: BarChart3,
    modelOverride: '',
    temperature: 0.2,
    maxTokens: 4096,
    enabled: true,
  },
]

const MODEL_OPTIONS = [
  'Default (system model)',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3.5-sonnet',
  'claude-3-haiku',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]

export default function CapabilitiesSettingsPage() {
  const { t } = useI18n()
  const [capabilities, setCapabilities] = useState<CapabilityConfig[]>(DEFAULT_CAPABILITIES)
  const [expandedId, setExpandedId] = useState<string | null>('chat')

  const updateCapability = (id: string, updates: Partial<CapabilityConfig>) => {
    setCapabilities((caps) =>
      caps.map((cap) => (cap.id === id ? { ...cap, ...updates } : cap))
    )
  }

  const enabledCount = capabilities.filter((c) => c.enabled).length

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <Zap className="inline h-5 w-5 mr-2 -mt-0.5" />
          Capability Configuration
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Override model and generation parameters for each AI capability. Leave model as &quot;Default&quot; to use the system-wide LLM. ({enabledCount}/{capabilities.length} enabled)
        </p>
      </div>

      <div className="space-y-3">
        {capabilities.map((cap) => {
          const Icon = cap.icon
          const isExpanded = expandedId === cap.id
          return (
            <div
              key={cap.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : cap.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <Icon className="h-4 w-4 text-[var(--primary)]" />
                  <div>
                    <p className="text-[13px] font-medium text-[var(--foreground)]">{cap.name}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{cap.description}</p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateCapability(cap.id, { enabled: !cap.enabled })}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors',
                      cap.enabled ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                        cap.enabled && 'translate-x-5'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Expanded Settings */}
              {isExpanded && cap.enabled && (
                <div className="border-t border-[var(--border)] p-4 space-y-4 bg-[var(--muted)]/30">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-[var(--foreground)]">Model Override</label>
                    <select
                      value={cap.modelOverride}
                      onChange={(e) => updateCapability(cap.id, { modelOverride: e.target.value })}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    >
                      {MODEL_OPTIONS.map((model) => (
                        <option key={model} value={model === 'Default (system model)' ? '' : model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-[var(--foreground)]">
                        Temperature: {cap.temperature}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        value={cap.temperature}
                        onChange={(e) =>
                          updateCapability(cap.id, { temperature: Number(e.target.value) })
                        }
                        className="w-full accent-[var(--primary)]"
                      />
                      <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
                        <span>Precise</span>
                        <span>Creative</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-[var(--foreground)]">Max Tokens</label>
                      <input
                        type="number"
                        value={cap.maxTokens}
                        onChange={(e) =>
                          updateCapability(cap.id, { maxTokens: Number(e.target.value) })
                        }
                        min={256}
                        max={32768}
                        step={256}
                        className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
        <button
          onClick={() => setCapabilities(DEFAULT_CAPABILITIES)}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Reset All
        </button>
      </div>
    </div>
  )
}
