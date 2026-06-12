'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { PWAInstallPrompt } from '@/components/pwa/pwa-install-prompt';
import { PWAUpdater } from '@/components/pwa/pwa-updater';
import { WarehouseProvider } from '@/contexts/warehouse-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
      <WarehouseProvider>
        <PWAInstallPrompt />
        <PWAUpdater />
        {children}
      </WarehouseProvider>
    </ThemeProvider>
  );
}
