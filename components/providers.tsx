'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { I18nProvider } from '@/lib/hooks/use-i18n';
import { useAuthStore } from '@/lib/store/auth-store';
import { Sidebar } from '@/components/sidebar';
import '@/lib/i18n/config';

export function Providers({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return <I18nProvider>{children}</I18nProvider>;
}

// ---------------------------------------------------------------------------
// AppShell — Sidebar + AuthGuard + loading state
// ---------------------------------------------------------------------------

/**
 * Wraps the main content area with:
 * 1. Loading spinner while auth state is being discovered (initAuth in-flight)
 * 2. Auth guard — redirects unauthenticated users to /auth/login in multi mode
 * 3. Conditional Sidebar — hidden on /auth/* pages
 *
 * Must be rendered inside <Providers> (needs auth store + i18n).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mode = useAuthStore((s) => s.mode);
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  const isAuthPage = pathname.startsWith('/auth/');

  // --- Loading state: auth not yet discovered ---
  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  // --- Auth guard: multi mode requires login ---
  if (mode === 'multi' && !user && !isAuthPage) {
    router.replace('/auth/login');
    return null;
  }

  // --- Auth guard: already logged in on auth page → go to chat ---
  if (mode === 'multi' && user && isAuthPage) {
    router.replace('/chat');
    return null;
  }

  // --- Auth pages: render without Sidebar ---
  if (isAuthPage) {
    return <>{children}</>;
  }

  // --- Normal pages: Sidebar + main content ---
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
