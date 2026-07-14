'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { Settings2, SlidersHorizontal, FileText, Download, Upload, AlertTriangle } from 'lucide-react'

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

export default function AdvancedSettingsPage() {
  const { t } = useI18n()
  const [contextThreshold, setContextThreshold] = useState(0.8)
  const [logLevel, setLogLevel] = useState('info')
  const [chatImportFormat, setChatImportFormat] = useState('json')
  const [autoTrimHistory, setAutoTrimHistory] = useState(true)
  const [debugMode, setDebugMode] = useState(false)
  const [telemetry, setTelemetry] = useState(false)
  const [experimentalFeatures, setExperimentalFeatures] = useState(false)
  const [streamingEnabled, setStreamingEnabled] = useState(true)
  const [maxRetries, setMaxRetries] = useState(3)

  const handleExportData = () => {
    // Placeholder for data export
  }

  const handleImportData = () => {
    // Placeholder for data import
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <Settings2 className="inline h-5 w-5 mr-2 -mt-0.5" />
          Advanced Settings
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Fine-tune system behavior, logging, data management, and experimental features.
        </p>
      </div>

      <div className="space-y-4">
        {/* Context Window Protection */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Context Window Protection
          </h3>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)]">
              Protection Threshold: {contextThreshold.toFixed(1)}
            </label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={contextThreshold}
              onChange={(e) => setContextThreshold(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
              <span>0.1 (Aggressive trimming)</span>
              <span>0.5</span>
              <span>1.0 (Full context)</span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Controls when the system starts compressing conversation history to stay within the model&apos;s context window. Lower values trigger earlier compression.
            </p>
          </div>

          <ToggleField
            checked={autoTrimHistory}
            onChange={setAutoTrimHistory}
            label="Auto-Trim Conversation History"
            description="Automatically summarize older messages when approaching the context limit"
          />
        </div>

        {/* Logging */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Logging Level
          </label>
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="debug">Debug - Verbose output for development</option>
            <option value="info">Info - General operational messages</option>
            <option value="warn">Warn - Potential issues and deprecations</option>
            <option value="error">Error - Critical failures only</option>
          </select>
        </div>

        {/* API Retry */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Max API Retries: {maxRetries}
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={maxRetries}
            onChange={(e) => setMaxRetries(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
            <span>0 (no retry)</span>
            <span>3</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Chat Import */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Chat Import Settings
          </h3>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)]">Import Format</label>
            <select
              value={chatImportFormat}
              onChange={(e) => setChatImportFormat(e.target.value)}
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            >
              <option value="json">JSON (SmartLearn format)</option>
              <option value="openai">OpenAI Chat Export</option>
              <option value="chatgpt">ChatGPT Shared Link</option>
              <option value="markdown">Markdown transcript</option>
            </select>
          </div>

          <p className="text-[11px] text-[var(--muted-foreground)]">
            Select the source format for importing chat histories from other platforms.
          </p>
        </div>

        {/* Data Management */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Data Management
          </h3>

          <div className="flex gap-3">
            <button
              onClick={handleExportData}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <Download className="h-4 w-4" />
              Export All Data
            </button>
            <button
              onClick={handleImportData}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import Data
            </button>
          </div>

          <p className="text-[11px] text-[var(--muted-foreground)]">
            Export includes all conversations, notebooks, knowledge bases, and settings. Import will merge with existing data.
          </p>
        </div>

        {/* Toggle Options */}
        <div className="space-y-3 pt-2">
          <ToggleField
            checked={streamingEnabled}
            onChange={setStreamingEnabled}
            label="Streaming Responses"
            description="Stream LLM responses token-by-token for faster perceived latency"
          />
          <ToggleField
            checked={debugMode}
            onChange={setDebugMode}
            label="Debug Mode"
            description="Show raw API requests, token counts, and model metadata in the UI"
          />
          <ToggleField
            checked={telemetry}
            onChange={setTelemetry}
            label="Anonymous Usage Telemetry"
            description="Send anonymous usage statistics to help improve the platform"
          />
          <ToggleField
            checked={experimentalFeatures}
            onChange={setExperimentalFeatures}
            label="Experimental Features"
            description="Enable unstable features under development. May cause unexpected behavior."
          />
        </div>
      </div>

      {experimentalFeatures && (
        <div className="mt-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-yellow-600">Experimental Features Enabled</p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                You have opted into experimental features. These may be unstable and could change without notice between updates.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
        <button
          onClick={() => {
            setContextThreshold(0.8)
            setLogLevel('info')
            setChatImportFormat('json')
            setAutoTrimHistory(true)
            setDebugMode(false)
            setTelemetry(false)
            setExperimentalFeatures(false)
            setStreamingEnabled(true)
            setMaxRetries(3)
          }}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
