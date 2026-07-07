'use client';

import { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertCircle, Database, Cpu, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceStatus {
  name: string;
  status: 'online' | 'warning' | 'offline';
  latency: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface HealthData {
  version: string;
  capabilities: string[];
  uptime?: string;
}

// ---------------------------------------------------------------------------
// Status Page
// ---------------------------------------------------------------------------

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<HealthData>('/api/v1/health');
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const services: ServiceStatus[] = [
    {
      name: 'LLM Gateway',
      status: health ? 'online' : 'offline',
      latency: health ? '—' : '—',
      icon: Cpu,
    },
    {
      name: 'Vector Database',
      status: health ? 'online' : 'offline',
      latency: '—',
      icon: Database,
    },
    {
      name: 'Knowledge Index',
      status: health ? 'online' : 'offline',
      latency: '—',
      icon: Database,
    },
    {
      name: 'Embedding Model',
      status: health ? 'online' : 'offline',
      latency: '—',
      icon: Cpu,
    },
    {
      name: 'Search Engine',
      status: health ? 'warning' : 'offline',
      latency: '—',
      icon: Activity,
    },
  ];

  const getStatusConfig = (status: string) => {
    if (status === 'online')
      return { color: 'text-[var(--success)]', icon: CheckCircle2 };
    if (status === 'warning')
      return { color: 'text-[var(--warning)]', icon: AlertCircle };
    return { color: 'text-[var(--destructive)]', icon: AlertCircle };
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          System Status
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          View the running status, latency, and resource usage of each service
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[var(--primary)] animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-xl p-4 mb-6">
          <p className="text-[13px] text-[var(--destructive)]">{error}</p>
          <button
            onClick={fetchHealth}
            className="mt-2 text-[12px] text-[var(--primary)] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Service Status */}
          <div className="space-y-3 mb-6">
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
              Services
            </h2>
            {services.map((service) => {
              const config = getStatusConfig(service.status);
              const StatusIcon = config.icon;
              return (
                <div
                  key={service.name}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--muted)]">
                      <service.icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </div>
                    <p className="text-[13px] font-medium text-[var(--foreground)]">
                      {service.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[var(--muted-foreground)]">
                      {service.latency}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={cn('h-3.5 w-3.5', config.color)} />
                      <span className={cn('text-[12px] font-medium', config.color)}>
                        {service.status === 'online'
                          ? 'Online'
                          : service.status === 'warning'
                            ? 'Warning'
                            : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* System Info */}
          <div className="space-y-3">
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
              System Info
            </h2>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--foreground)]">Version</span>
                <span className="text-[12px] text-[var(--muted-foreground)]">
                  {health?.version ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--foreground)]">
                  Capabilities
                </span>
                <span className="text-[12px] text-[var(--muted-foreground)]">
                  {health?.capabilities?.join(', ') ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--foreground)]">
                  Uptime
                </span>
                <span className="text-[12px] text-[var(--muted-foreground)]">
                  {health?.uptime ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>
    </div>
  );
}
