'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { Server, Plus, Trash2, CircleCheck, CircleX, AlertTriangle, RefreshCw } from 'lucide-react'

interface McpServer {
  id: string
  name: string
  command: string
  args: string
  env: string
  status: 'connected' | 'disconnected' | 'error'
  lastChecked: string
}

function StatusBadge({ status }: { status: McpServer['status'] }) {
  const config = {
    connected: {
      icon: CircleCheck,
      className: 'text-green-500',
      label: 'Connected',
    },
    disconnected: {
      icon: CircleX,
      className: 'text-[var(--muted-foreground)]',
      label: 'Disconnected',
    },
    error: {
      icon: AlertTriangle,
      className: 'text-red-500',
      label: 'Error',
    },
  }
  const { icon: Icon, className, label } = config[status]
  return (
    <div className={cn('flex items-center gap-1.5 text-[12px]', className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  )
}

export default function McpSettingsPage() {
  const { t } = useI18n()
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '', env: '' })

  useEffect(() => {
    let cancelled = false
    async function fetchServers() {
      try {
        setLoading(true)
        setFetchError(null)
        const res = await fetch('/api/v1/mcp')
        if (!res.ok) throw new Error(`Failed to load MCP servers (${res.status})`)
        const data = await res.json()
        if (!cancelled) {
          setServers(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchServers()
    return () => { cancelled = true }
  }, [])

  const addServer = () => {
    if (!newServer.name || !newServer.command) return
    const server: McpServer = {
      id: Date.now().toString(),
      name: newServer.name,
      command: newServer.command,
      args: newServer.args,
      env: newServer.env,
      status: 'disconnected',
      lastChecked: 'Just now',
    }
    setServers([...servers, server])
    setNewServer({ name: '', command: '', args: '', env: '' })
    setShowAddForm(false)
  }

  const removeServer = (id: string) => {
    setServers(servers.filter((s) => s.id !== id))
  }

  const reconnectServer = (id: string) => {
    setServers((svrs) =>
      svrs.map((s) => (s.id === id ? { ...s, status: 'connected' as const, lastChecked: 'Just now' } : s))
    )
  }

  const connectedCount = servers.filter((s) => s.status === 'connected').length

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <Server className="inline h-5 w-5 mr-2 -mt-0.5" />
          MCP Server Management
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Manage Model Context Protocol servers for tool integration. ({connectedCount}/{servers.length} connected)
        </p>
      </div>

      {/* Server List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-[var(--muted-foreground)] mr-2" />
            <span className="text-[13px] text-[var(--muted-foreground)]">Loading MCP servers...</span>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="text-[13px] text-red-500 font-medium">{fetchError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Server className="h-8 w-8 text-[var(--muted-foreground)]" />
            <p className="text-[13px] text-[var(--muted-foreground)]">No MCP servers configured.</p>
            <p className="text-[12px] text-[var(--muted-foreground)]">Add a server below to get started.</p>
          </div>
        ) : (
        servers.map((server) => (
          <div
            key={server.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{server.name}</p>
                  <StatusBadge status={server.status} />
                </div>
                <p className="text-[12px] text-[var(--muted-foreground)] font-mono">
                  {server.command} {server.args}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                  Last checked: {server.lastChecked}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {server.status !== 'connected' && (
                  <button
                    onClick={() => reconnectServer(server.id)}
                    className="p-1.5 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    title="Reconnect"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setEditingId(editingId === server.id ? null : server.id)}
                  className="px-2 py-1 rounded-md text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeServer(server.id)}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Edit form */}
            {editingId === server.id && (
              <div className="border-t border-[var(--border)] p-4 space-y-3 bg-[var(--muted)]/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-[var(--foreground)]">Name</label>
                    <input
                      type="text"
                      defaultValue={server.name}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-[var(--foreground)]">Command</label>
                    <input
                      type="text"
                      defaultValue={server.command}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--foreground)]">Arguments</label>
                  <input
                    type="text"
                    defaultValue={server.args}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--foreground)]">Environment Variables</label>
                  <textarea
                    defaultValue={server.env}
                    rows={2}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] font-mono resize-none"
                    placeholder="KEY=value (one per line)"
                  />
                </div>
                <button className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
                  Save Changes
                </button>
              </div>
            )}
          </div>
        )))
        }
      </div>

      {/* Add Server Form */}
      {showAddForm ? (
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <h3 className="text-[13px] font-medium text-[var(--foreground)]">Add New MCP Server</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[var(--foreground)]">Name *</label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="e.g., brave-search"
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[var(--foreground)]">Command *</label>
              <input
                type="text"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                placeholder="e.g., npx"
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-[var(--foreground)]">Arguments</label>
            <input
              type="text"
              value={newServer.args}
              onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
              placeholder="e.g., -y @modelcontextprotocol/server-brave-search"
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-[var(--foreground)]">Environment Variables</label>
            <textarea
              value={newServer.env}
              onChange={(e) => setNewServer({ ...newServer, env: e.target.value })}
              rows={2}
              placeholder="KEY=value (one per line)"
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] font-mono resize-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addServer}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              Add Server
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewServer({ name: '', command: '', args: '', env: '' })
              }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-[var(--border)] text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add MCP Server
        </button>
      )}

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
      </div>

      <div className="mt-4 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <p className="text-[12px] text-[var(--muted-foreground)]">
          MCP servers extend the agent&apos;s capabilities with external tools. Each server runs as a separate process and communicates via the Model Context Protocol. Ensure required environment variables and credentials are configured before connecting.
        </p>
      </div>
    </div>
  )
}
