'use client';

import { useSettingsStoreV2 } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Toggle Component
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)]">{label}</p>
        {description && (
          <p className="text-[12px] text-[var(--muted-foreground)]">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LLM Settings Page
// ---------------------------------------------------------------------------

export default function LLMSettingsPage() {
  const settings = useSettingsStoreV2();

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          LLM Settings
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Configure LLM provider, API key, and default parameters
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Provider ID */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Provider
          </label>
          <input
            type="text"
            value={settings.smartlearnProviderId || ''}
            onChange={(e) =>
              settings.setSmartlearnModel(e.target.value, settings.smartlearnModelId || '')
            }
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            placeholder="openai, anthropic, google, etc."
          />
        </div>

        {/* Model ID */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Default Model
          </label>
          <input
            type="text"
            value={settings.smartlearnModelId || ''}
            onChange={(e) =>
              settings.setSmartlearnModel(
                settings.smartlearnProviderId || '',
                e.target.value,
              )
            }
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            placeholder="gpt-4o, claude-3.5-sonnet, etc."
          />
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            API Key
          </label>
          <input
            type="password"
            value={settings.smartlearnApiKey || ''}
            onChange={(e) => settings.setSmartlearnApiKey(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            placeholder="sk-..."
          />
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Stored on the server side only. Never sent to the browser.
          </p>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Base URL (optional)
          </label>
          <input
            type="text"
            value={settings.smartlearnBaseUrl || ''}
            onChange={(e) => settings.setSmartlearnBaseUrl(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            placeholder="https://api.openai.com/v1"
          />
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Temperature
          </label>
          <input
            type="number"
            value={settings.temperature}
            onChange={(e) => settings.setTemperature(parseFloat(e.target.value) || 0)}
            step="0.1"
            min="0"
            max="2"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Max Tokens
          </label>
          <input
            type="number"
            value={settings.maxTokens}
            onChange={(e) => settings.setMaxTokens(parseInt(e.target.value) || 4096)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2">
          <Toggle
            checked={settings.thinkingMode}
            onChange={() => settings.toggleThinkingMode()}
            label="Thinking Mode"
            description="Show reasoning process before the answer, improving accuracy on complex tasks"
          />
          <Toggle
            checked={settings.autoContextWindow}
            onChange={() => settings.toggleAutoContextWindow()}
            label="Auto Context Window Protection"
            description="Automatically compress history when context approaches the limit"
          />
          <Toggle
            checked={settings.rateLimitEnabled}
            onChange={() => settings.toggleRateLimit()}
            label="Rate Limiting (RPM throttle)"
            description="Limit requests per minute to avoid API rate limit errors"
          />
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <p className="text-[12px] text-[var(--muted-foreground)]">
          Settings are saved automatically and persisted in the browser. Changes take effect on the next message.
        </p>
      </div>
    </div>
  );
}
