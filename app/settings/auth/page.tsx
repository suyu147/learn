'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { Shield, Clock, Users, KeyRound, LogOut, Trash2 } from 'lucide-react'

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

interface SessionInfo {
  id: string
  userAgent: string
  lastActive: string
  current: boolean
}

const ACTIVE_SESSIONS: SessionInfo[] = [
  { id: '1', userAgent: 'Chrome 124 / Windows 11', lastActive: 'Now', current: true },
  { id: '2', userAgent: 'Safari 17 / macOS Sonoma', lastActive: '2 hours ago', current: false },
  { id: '3', userAgent: 'Firefox 125 / Ubuntu 24.04', lastActive: '1 day ago', current: false },
]

export default function AuthSettingsPage() {
  const { t } = useI18n()
  const [authMode] = useState('single')
  const [jwtExpiry] = useState('24 hours')
  const [sessions, setSessions] = useState<SessionInfo[]>(ACTIVE_SESSIONS)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [autoLogout, setAutoLogout] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState('30')

  const revokeSession = (id: string) => {
    setSessions((s) => s.filter((session) => session.id !== id))
  }

  const revokeAllSessions = () => {
    setSessions((s) => s.filter((session) => session.current))
  }

  const authModeLabels: Record<string, { label: string; description: string; color: string }> = {
    disabled: {
      label: 'Disabled',
      description: 'No authentication required. Anyone can access.',
      color: 'text-red-500',
    },
    single: {
      label: 'Single User',
      description: 'Password-protected access for a single user.',
      color: 'text-green-500',
    },
    multi: {
      label: 'Multi User',
      description: 'Account-based authentication with role management.',
      color: 'text-blue-500',
    },
  }

  const currentAuth = authModeLabels[authMode]

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <Shield className="inline h-5 w-5 mr-2 -mt-0.5" />
          Authentication Settings
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          View authentication mode, manage sessions, and configure access security.
        </p>
      </div>

      <div className="space-y-4">
        {/* Auth Mode (Read Only) */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Authentication Mode
              </p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1">{currentAuth.description}</p>
            </div>
            <div className="text-right">
              <span className={cn('text-[14px] font-semibold', currentAuth.color)}>
                {currentAuth.label}
              </span>
              <p className="text-[11px] text-[var(--muted-foreground)]">Read-only</p>
            </div>
          </div>
        </div>

        {/* JWT Info */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[var(--foreground)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                JWT Token Expiry
              </p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                Tokens expire after this duration. Sessions are automatically invalidated.
              </p>
            </div>
            <span className="text-[14px] font-semibold text-[var(--foreground)]">{jwtExpiry}</span>
          </div>
        </div>

        {/* Session Timeout */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">
            Idle Session Timeout (minutes)
          </label>
          <select
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
            <option value="0">Never (until token expires)</option>
          </select>
        </div>

        {/* Session Toggles */}
        <div className="space-y-3 pt-2">
          <ToggleField
            checked={rememberDevice}
            onChange={setRememberDevice}
            label="Remember Trusted Devices"
            description="Skip re-authentication on devices that have been previously verified"
          />
          <ToggleField
            checked={autoLogout}
            onChange={setAutoLogout}
            label="Auto-Logout on Inactivity"
            description="Automatically sign out when the idle timeout threshold is reached"
          />
        </div>

        {/* Active Sessions */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Active Sessions ({sessions.length})
            </h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-[var(--foreground)]">
                      {session.userAgent}
                    </p>
                    {session.current && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                    Last active: {session.lastActive}
                  </p>
                </div>
                {!session.current && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                    title="Revoke session"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
        <button
          onClick={revokeAllSessions}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--destructive)] text-white hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Revoke All Other Sessions
        </button>
      </div>

      <div className="mt-4 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <p className="text-[12px] text-[var(--muted-foreground)]">
          Authentication mode is configured at the system level and cannot be changed from this panel. Contact your system administrator to change the authentication mode. Session changes take effect immediately.
        </p>
      </div>
    </div>
  )
}
