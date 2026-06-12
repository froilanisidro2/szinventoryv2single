'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  BarChart3,
  MoreHorizontal,
  X,
  Package,
  TrendingUp,
  FileText,
  ArrowRightLeft,
  Activity,
  Settings,
  LogOut,
} from 'lucide-react';
import { getCurrentUser, type AuthUser } from '@/lib/auth-utils';
import { logoutUser } from '@/app/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const BOTTOM_ITEMS = [
  { href: '/dashboard',       label: 'Home',      icon: LayoutDashboard },
  { href: '/inventory',       label: 'Inventory', icon: Boxes },
  { href: '/purchase-orders', label: 'Orders',    icon: ShoppingCart },
  { href: '/reports-analytics', label: 'Reports', icon: BarChart3 },
];

const DRAWER_ITEMS = [
  { href: '/products',            label: 'Products',            icon: Package },
  { href: '/sales-orders',        label: 'Sales Orders',        icon: TrendingUp },
  { href: '/invoices',            label: 'Sales Invoices',      icon: FileText },
  { href: '/stock-transfers',     label: 'Stock Transfers',     icon: ArrowRightLeft },
  { href: '/inventory/movements', label: 'Stock Movements',     icon: Activity },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleLogout = async () => {
    setDrawerOpen(false);
    try {
      await logoutUser();
      localStorage.removeItem('user');
      localStorage.removeItem('company');
      toast.success('Logged out');
      router.push('/auth/login');
    } catch {
      toast.error('Error logging out');
    }
  };

  return (
    <>
      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-900 border-t border-sky-100 dark:border-gray-800 safe-area-inset-bottom">
        <div className="flex items-stretch h-16">
          {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-sky-400 dark:text-sky-600'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {label}
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              drawerOpen ? 'text-primary-600 dark:text-primary-400' : 'text-sky-400 dark:text-sky-600'
            }`}
          >
            <MoreHorizontal className="h-5 w-5 stroke-2" />
            More
          </button>
        </div>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl transition-transform duration-300 ${
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-sky-200 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-sky-50 dark:border-gray-800">
          <div>
            <p className="text-sm font-semibold text-sky-800 dark:text-sky-100">
              {user?.firstName || user?.email || 'User'}
            </p>
            <p className="text-xs text-sky-500 dark:text-sky-400">{user?.email}</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-full bg-sky-50 dark:bg-gray-800 text-sky-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Links */}
        <div className="px-4 py-3 space-y-1 max-h-[60vh] overflow-y-auto">
          {DRAWER_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-primary-600 dark:bg-sky-900/30 dark:text-primary-400'
                    : 'text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}

          {user?.isCompanyAdmin && (
            <Link
              href="/settings"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              Settings
            </Link>
          )}
        </div>

        {/* Logout */}
        <div className="px-4 pb-6 pt-2 border-t border-sky-50 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </div>
    </>
  );
}
