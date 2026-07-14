'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { UserCircle, Type, Globe, Volume2 } from 'lucide-react'

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

export default function PersonaSettingsPage() {
  const { t } = useI18n()
  const [personaName, setPersonaName] = useState('SmartLearn Assistant')
  const [personaDescription, setPersonaDescription] = useState(
    'A knowledgeable and patient learning companion that adapts to your learning style and pace.'
  )
  const [communicationStyle, setCommunicationStyle] = useState('friendly')
  const [language, setLanguage] = useState('auto')
  const [verbosity, setVerbosity] = useState('balanced')
  const [useEmoji, setUseEmoji] = useState(false)
  const [showReasoning, setShowReasoning] = useState(true)
  const [proactiveTips, setProactiveTips] = useState(true)

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <UserCircle className="inline h-5 w-5 mr-2 -mt-0.5" />
          Persona & Style Settings
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Customize the assistant&apos;s personality, tone, and communication preferences.
        </p>
      </div>

      <div className="space-y-4">
        {/* Persona Identity */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <UserCircle className="h-3.5 w-3.5" />
            Persona Name
          </label>
          <input
            type="text"
            value={personaName}
            onChange={(e) => setPersonaName(e.target.value)}
            placeholder="e.g., Alex, Study Buddy"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">Persona Description</label>
          <textarea
            value={personaDescription}
            onChange={(e) => setPersonaDescription(e.target.value)}
            rows={3}
            placeholder="Describe the assistant's personality, expertise, and behavior..."
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] resize-none placeholder:text-[var(--muted-foreground)]"
          />
          <p className="text-[11px] text-[var(--muted-foreground)]">
            This description is injected into the system prompt to guide the assistant&apos;s behavior.
          </p>
        </div>

        {/* Communication Style */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <Type className="h-3.5 w-3.5" />
            Communication Style
          </label>
          <select
            value={communicationStyle}
            onChange={(e) => setCommunicationStyle(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="formal">Formal - Professional and structured language</option>
            <option value="casual">Casual - Relaxed and conversational tone</option>
            <option value="academic">Academic - Scholarly with citations and rigor</option>
            <option value="friendly">Friendly - Warm and encouraging approach</option>
          </select>
        </div>

        {/* Language Preference */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Language Preference
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="auto">Auto-detect (match user&apos;s language)</option>
            <option value="en">English</option>
            <option value="zh-CN">Chinese (Simplified)</option>
            <option value="zh-TW">Chinese (Traditional)</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        {/* Response Verbosity */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5" />
            Response Verbosity
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'concise', label: 'Concise', desc: 'Short, to-the-point answers' },
              { value: 'balanced', label: 'Balanced', desc: 'Moderate detail with context' },
              { value: 'detailed', label: 'Detailed', desc: 'Thorough, comprehensive answers' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVerbosity(opt.value)}
                className={cn(
                  'rounded-lg border p-3 text-center transition-colors',
                  verbosity === opt.value
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]'
                )}
              >
                <p className="text-[13px] font-medium text-[var(--foreground)]">{opt.label}</p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2">
          <ToggleField
            checked={useEmoji}
            onChange={setUseEmoji}
            label="Use Emoji in Responses"
            description="Add relevant emoji to make responses more visually engaging"
          />
          <ToggleField
            checked={showReasoning}
            onChange={setShowReasoning}
            label="Show Reasoning Process"
            description="Display the step-by-step thinking process before giving answers"
          />
          <ToggleField
            checked={proactiveTips}
            onChange={setProactiveTips}
            label="Proactive Learning Tips"
            description="Suggest related topics and follow-up questions to deepen understanding"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
        <button
          onClick={() => {
            setPersonaName('SmartLearn Assistant')
            setPersonaDescription('A knowledgeable and patient learning companion that adapts to your learning style and pace.')
            setCommunicationStyle('friendly')
            setLanguage('auto')
            setVerbosity('balanced')
            setUseEmoji(false)
            setShowReasoning(true)
            setProactiveTips(true)
          }}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
