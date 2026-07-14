'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { Search, Key, Shield, SlidersHorizontal } from 'lucide-react'

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

const SEARCH_PROVIDERS = [
  { id: 'tavily', name: 'Tavily', description: 'AI-optimized search engine with structured results' },
  { id: 'brave', name: 'Brave Search', description: 'Privacy-first independent search index' },
  { id: 'duckduckgo', name: 'DuckDuckGo', description: 'Free privacy-focused search (no API key required)' },
  { id: 'serper', name: 'Serper', description: 'Google Search API with fast, reliable results' },
  { id: 'searxng', name: 'SearXNG', description: 'Self-hosted metasearch engine aggregator' },
]

export default function SearchSettingsPage() {
  const { t } = useI18n()
  const [activeProvider, setActiveProvider] = useState('tavily')
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    tavily: '',
    brave: '',
    serper: '',
    searxng: '',
  })
  const [searxngUrl, setSearxngUrl] = useState('')
  const [maxResults, setMaxResults] = useState(5)
  const [safeSearch, setSafeSearch] = useState(true)
  const [includeImages, setIncludeImages] = useState(false)
  const [includeSnippets, setIncludeSnippets] = useState(true)

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <Search className="inline h-5 w-5 mr-2 -mt-0.5" />
          Web Search Settings
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Configure search providers and result parameters for web search capabilities.
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Search Provider
          </label>
          <div className="space-y-2">
            {SEARCH_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setActiveProvider(provider.id)}
                className={cn(
                  'w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors',
                  activeProvider === provider.id
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]'
                )}
              >
                <div>
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{provider.name}</p>
                  <p className="text-[12px] text-[var(--muted-foreground)]">{provider.description}</p>
                </div>
                <div
                  className={cn(
                    'h-4 w-4 rounded-full border-2 transition-colors',
                    activeProvider === provider.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]'
                      : 'border-[var(--muted-foreground)]'
                  )}
                >
                  {activeProvider === provider.id && (
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* API Key Inputs */}
        {activeProvider !== 'duckduckgo' && (
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              API Key
            </label>
            {activeProvider === 'searxng' ? (
              <input
                type="text"
                value={searxngUrl}
                onChange={(e) => setSearxngUrl(e.target.value)}
                placeholder="http://localhost:8080"
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
              />
            ) : (
              <input
                type="password"
                value={apiKeys[activeProvider] || ''}
                onChange={(e) => setApiKeys({ ...apiKeys, [activeProvider]: e.target.value })}
                placeholder={`Enter your ${SEARCH_PROVIDERS.find((p) => p.id === activeProvider)?.name} API key`}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
              />
            )}
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {activeProvider === 'searxng'
                ? 'Enter the base URL of your SearXNG instance.'
                : 'Your API key is stored locally and never shared.'}
            </p>
          </div>
        )}

        {/* Max Results Slider */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Max Results: {maxResults}
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
            <span>1</span>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20</span>
          </div>
        </div>

        {/* Toggle Options */}
        <div className="space-y-3 pt-2">
          <ToggleField
            checked={safeSearch}
            onChange={setSafeSearch}
            label="Safe Search"
            description="Filter out explicit or adult content from search results"
          />
          <ToggleField
            checked={includeSnippets}
            onChange={setIncludeSnippets}
            label="Include Snippets"
            description="Include text snippets from search results in the context"
          />
          <ToggleField
            checked={includeImages}
            onChange={setIncludeImages}
            label="Include Images"
            description="Return image URLs alongside text results when available"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
        <button
          onClick={() => {
            setActiveProvider('tavily')
            setApiKeys({ tavily: '', brave: '', serper: '', searxng: '' })
            setSearxngUrl('')
            setMaxResults(5)
            setSafeSearch(true)
            setIncludeImages(false)
            setIncludeSnippets(true)
          }}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
