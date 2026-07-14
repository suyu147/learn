'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { BookMarked, FileDown, Save, Layout } from 'lucide-react'

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

export default function NotebookSettingsPage() {
  const { t } = useI18n()
  const [defaultFormat, setDefaultFormat] = useState('markdown')
  const [autoSave, setAutoSave] = useState(true)
  const [autoSaveInterval, setAutoSaveInterval] = useState('30')
  const [maxNotesPerNotebook, setMaxNotesPerNotebook] = useState(100)
  const [exportFormat, setExportFormat] = useState('pdf')
  const [includeTimestamps, setIncludeTimestamps] = useState(true)
  const [includeSources, setIncludeSources] = useState(true)
  const [smartOrganize, setSmartOrganize] = useState(false)
  const [defaultTemplate, setDefaultTemplate] = useState('blank')

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <BookMarked className="inline h-5 w-5 mr-2 -mt-0.5" />
          Notebook Settings
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Configure default notebook behavior, auto-save, and export preferences.
        </p>
      </div>

      <div className="space-y-4">
        {/* Format Settings */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <Layout className="h-3.5 w-3.5" />
            Default Notebook Format
          </label>
          <select
            value={defaultFormat}
            onChange={(e) => setDefaultFormat(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="markdown">Markdown</option>
            <option value="richtext">Rich Text (WYSIWYG)</option>
            <option value="plaintext">Plain Text</option>
            <option value="ipynb">Jupyter Notebook (.ipynb)</option>
          </select>
        </div>

        {/* Default Template */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">Default Template</label>
          <select
            value={defaultTemplate}
            onChange={(e) => setDefaultTemplate(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="blank">Blank Notebook</option>
            <option value="study_notes">Study Notes Template</option>
            <option value="research_log">Research Log Template</option>
            <option value="meeting_notes">Meeting Notes Template</option>
            <option value="project_plan">Project Plan Template</option>
          </select>
        </div>

        {/* Auto-save Settings */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Auto-Save Configuration
          </h3>

          <ToggleField
            checked={autoSave}
            onChange={setAutoSave}
            label="Enable Auto-Save"
            description="Automatically save notebook changes at a regular interval"
          />

          {autoSave && (
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[var(--foreground)]">
                Auto-Save Interval
              </label>
              <select
                value={autoSaveInterval}
                onChange={(e) => setAutoSaveInterval(e.target.value)}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              >
                <option value="10">Every 10 seconds</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 1 minute</option>
                <option value="300">Every 5 minutes</option>
              </select>
            </div>
          )}
        </div>

        {/* Max Notes */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Max Notes Per Notebook
          </label>
          <input
            type="number"
            value={maxNotesPerNotebook}
            onChange={(e) => setMaxNotesPerNotebook(Number(e.target.value))}
            min={10}
            max={1000}
            step={10}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Maximum number of individual notes allowed in a single notebook.
          </p>
        </div>

        {/* Export Format */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <FileDown className="h-3.5 w-3.5" />
            Export Preferences
          </h3>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)]">Default Export Format</label>
            <div className="grid grid-cols-4 gap-2">
              {['pdf', 'markdown', 'docx', 'html'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={cn(
                    'rounded-lg border p-2.5 text-center transition-colors',
                    exportFormat === fmt
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]'
                  )}
                >
                  <p className="text-[12px] font-medium text-[var(--foreground)] uppercase">{fmt}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <ToggleField
              checked={includeTimestamps}
              onChange={setIncludeTimestamps}
              label="Include Timestamps"
              description="Add creation and modification dates to exported notes"
            />
            <ToggleField
              checked={includeSources}
              onChange={setIncludeSources}
              label="Include Source References"
              description="Append cited sources and references at the end of exports"
            />
          </div>
        </div>

        {/* Smart Organize */}
        <ToggleField
          checked={smartOrganize}
          onChange={setSmartOrganize}
          label="Smart Organization"
          description="Automatically suggest notebook organization and tags based on content"
        />
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
        <button
          onClick={() => {
            setDefaultFormat('markdown')
            setAutoSave(true)
            setAutoSaveInterval('30')
            setMaxNotesPerNotebook(100)
            setExportFormat('pdf')
            setIncludeTimestamps(true)
            setIncludeSources(true)
            setSmartOrganize(false)
            setDefaultTemplate('blank')
          }}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
