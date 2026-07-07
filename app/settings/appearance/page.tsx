'use client';

import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStoreV2 } from '@/lib/store/settings-store';

// ---------------------------------------------------------------------------
// Appearance Page
// ---------------------------------------------------------------------------

export default function AppearancePage() {
  const theme = useSettingsStoreV2((s) => s.theme);
  const language = useSettingsStoreV2((s) => s.language);
  const setTheme = useSettingsStoreV2((s) => s.setTheme);
  const setLanguage = useSettingsStoreV2((s) => s.setLanguage);

  const themes: {
    id: typeof theme;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
  }[] = [
    { id: 'light', label: 'Light', icon: Sun, desc: 'Always use light theme' },
    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Always use dark theme' },
    { id: 'system', label: 'System', icon: Monitor, desc: 'Follow system theme' },
    { id: 'glass', label: 'Glass', icon: Palette, desc: 'Glassmorphism effect' },
  ];

  const languages = [
    { id: 'zh-CN', label: '简体中文' },
    { id: 'en-US', label: 'English' },
    { id: 'ja-JP', label: '日本語' },
    { id: 'ru-RU', label: 'Русский' },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          Appearance
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Customize the visual appearance, theme, and language
        </p>
      </div>

      <div className="space-y-6">
        {/* Theme Picker */}
        <div className="space-y-3">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Theme
          </label>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    isActive
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50',
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        isActive
                          ? 'text-[var(--primary)]'
                          : 'text-[var(--muted-foreground)]',
                      )}
                    />
                    <span
                      className={cn(
                        'text-[13px] font-medium',
                        isActive
                          ? 'text-[var(--primary)]'
                          : 'text-[var(--foreground)]',
                      )}
                    >
                      {t.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {t.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Interface Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Density */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Display Density
          </label>
          <select className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]">
            <option>Compact</option>
            <option>Default</option>
            <option>Comfortable</option>
          </select>
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <p className="text-[12px] text-[var(--muted-foreground)]">
          Settings are saved automatically. Theme changes apply immediately.
        </p>
      </div>
    </div>
  );
}
