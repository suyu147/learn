'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Cpu, Search, ToggleRight, Brain, Palette, Wifi, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { label: 'LLM 模型', href: '/settings/llm', icon: Bot },
    { label: '嵌入模型', href: '/settings/embedding', icon: Cpu },
    { label: '搜索引擎', href: '/settings/models', icon: Search },
    { label: '工具开关', href: '/settings/tools', icon: ToggleRight },
    { label: '记忆设置', href: '/settings/memory', icon: Brain },
    { label: '外观设置', href: '/settings/appearance', icon: Palette },
    { label: '网络设置', href: '/settings/network', icon: Wifi },
    { label: '系统状态', href: '/settings/status', icon: Activity },
  ]

  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Left Navigation */}
      <div className="w-[200px] border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <h2 className="text-[14px] font-semibold text-[var(--foreground)]">设置中心</h2>
        </div>
        <nav className="flex-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-r-2 border-[var(--primary)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
