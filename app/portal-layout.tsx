'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { canAccessRoute, getCurrentUser } from '@/lib/auth-utils';
import { toast } from 'sonner';

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/admin')) {
      router.push('/dashboard');
      return;
    }
    // Skip auth/superadmin routes — they handle their own auth
    if (pathname.startsWith('/auth') || pathname.startsWith('/superadmin')) return;

    const user = getCurrentUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!canAccessRoute(pathname)) {
      toast.error('You do not have permission to access this page');
      router.push('/dashboard');
    }
  }, [pathname, router]);

  // Print pages and auth/superadmin render without sidebar/header
  const isPrintPage = pathname?.endsWith('/print');
  const isFullscreenRoute = pathname?.startsWith('/superadmin') || pathname?.startsWith('/auth') || isPrintPage;

  if (isFullscreenRoute) {
    return <>{children}</>;
  }

  // Regular inventory routes get sidebar + header
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop only */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Header />
        <div className="mx-auto max-w-7xl pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
