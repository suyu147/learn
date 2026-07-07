'use client'

import { Activity, CheckCircle2, AlertCircle, Database, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StatusPage() {
  const services = [
    { name: 'LLM 网关', status: 'online', latency: '120ms', icon: Cpu },
    { name: '向量数据库', status: 'online', latency: '45ms', icon: Database },
    { name: '知识库索引', status: 'online', latency: '89ms', icon: Database },
    { name: '嵌入模型', status: 'online', latency: '67ms', icon: Cpu },
    { name: '搜索引擎', status: 'warning', latency: '340ms', icon: Activity },
    { name: '图片生成', status: 'offline', latency: '-', icon: Activity },
  ]

  const getStatusConfig = (status: string) => {
    if (status === 'online') return { color: 'text-[var(--success)]', bg: 'bg-[var(--success)]', icon: CheckCircle2 }
    if (status === 'warning') return { color: 'text-[var(--warning)]', bg: 'bg-[var(--warning)]', icon: AlertCircle }
    return { color: 'text-[var(--destructive)]', bg: 'bg-[var(--destructive)]', icon: AlertCircle }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">系统状态</h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          查看各服务的运行状态、延迟和系统资源使用情况
        </p>
      </div>

      {/* Service Status */}
      <div className="space-y-3 mb-6">
        <h2 className="text-[14px] font-semibold text-[var(--foreground)]">服务状态</h2>
        {services.map((service) => {
          const config = getStatusConfig(service.status)
          const StatusIcon = config.icon
          return (
            <div
              key={service.name}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--muted)]">
                  <service.icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{service.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--muted-foreground)]">{service.latency}</span>
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={cn('h-3.5 w-3.5', config.color)} />
                  <span className={cn('text-[12px] font-medium', config.color)}>
                    {service.status === 'online' ? '正常' : service.status === 'warning' ? '警告' : '离线'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* System Info */}
      <div className="space-y-3">
        <h2 className="text-[14px] font-semibold text-[var(--foreground)]">系统信息</h2>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--foreground)]">版本</span>
            <span className="text-[12px] text-[var(--muted-foreground)]">v1.2.0-beta</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--foreground)]">运行时间</span>
            <span className="text-[12px] text-[var(--muted-foreground)]">3 天 14 小时</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--foreground)]">内存使用</span>
            <span className="text-[12px] text-[var(--muted-foreground)]">512 MB / 1 GB</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--foreground)]">存储使用</span>
            <span className="text-[12px] text-[var(--muted-foreground)]">2.4 GB / 10 GB</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--foreground)]">知识库文档块</span>
            <span className="text-[12px] text-[var(--muted-foreground)]">85 blocks</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          刷新状态
        </button>
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--destructive)] text-white hover:opacity-90 transition-opacity">
          重启服务
        </button>
      </div>
    </div>
  )
}
