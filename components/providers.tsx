'use client';

import { I18nProvider } from '@/lib/hooks/use-i18n';
import '@/lib/i18n/config';

export function Providers({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
