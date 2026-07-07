'use client'

import { useState } from 'react'
import { Sun, Moon, Monitor, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AppearancePage() {
  const [activeTheme, setActiveTheme] = useState('system')
  const [fontSize, setFontSize] = useState('14')

  const themes = [
    { id: 'light', label: '浅色', icon: Sun, desc: '始终使用浅色主题' },
    { id: 'dark', label: '深色', icon: Moon, desc: '始终使用深色主题' },
    { id: 'system', label: '系统', icon: Monitor, desc: '跟随系统主题' },
    { id: 'sepia', label: '护眼', icon: Palette, desc: '暖色调护眼模式' },
  ]

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">外观设置</h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          自定义应用的视觉外观，包括主题、字体和显示密度
        </p>
      </div>

      <div className="space-y-6">
        {/* Theme Picker */}
        <div className="space-y-3">
          <label className="text-[13px] font-medium text-[var(--foreground)]">主题</label>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((theme) => {
              const Icon = theme.icon
              return (
                <button
                  key={theme.id}
                  onClick={() => setActiveTheme(theme.id)}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    activeTheme === theme.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn(
                      'h-4 w-4',
                      activeTheme === theme.id ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
                    )} />
                    <span className={cn(
                      'text-[13px] font-medium',
                      activeTheme === theme.id ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'
                    )}>
                      {theme.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{theme.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">字体大小</label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="12">小 (12px)</option>
            <option value="14">默认 (14px)</option>
            <option value="16">大 (16px)</option>
            <option value="18">特大 (18px)</option>
          </select>
        </div>

        {/* Density */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">显示密度</label>
          <select className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]">
            <option>紧凑</option>
            <option>默认</option>
            <option>宽松</option>
          </select>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">界面语言</label>
          <select className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]">
            <option>简体中文</option>
            <option>English</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          应用更改
        </button>
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
          重置为默认
        </button>
      </div>
    </div>
  )
}
