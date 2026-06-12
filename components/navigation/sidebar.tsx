'use client';

import {
  LayoutDashboard,
  Package,
  Boxes,
  BarChart3,
  Settings,
  ShoppingCart,
  ArrowRightLeft,
  Activity,
  ClipboardList,
  Hammer,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCurrentUser, type AuthUser } from '@/lib/auth-utils';

interface MenuItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string; // required permission key; omit = always visible
  adminOnly?: boolean; // only company admins
}

const ALL_MENU_ITEMS: MenuItem[] = [
  { href: '/dashboard',           label: 'Dashboard',           icon: LayoutDashboard },
  { href: '/inventory',           label: 'Inventory',           icon: Boxes,           permission: 'inventory:read' },
  { href: '/products',            label: 'Products',            icon: Package,         permission: 'inventory:read' },
  { href: '/purchase-orders',     label: 'Purchase Orders',     icon: ShoppingCart,    permission: 'inventory:write' },
  { href: '/stock-transfers',     label: 'Stock Transfers',     icon: ArrowRightLeft,  permission: 'inventory:write' },
  { href: '/inventory/movements', label: 'Stock Movements',     icon: Activity,        permission: 'inventory:read' },
  { href: '/material-requests',   label: 'Material Requests',   icon: ClipboardList,   permission: 'inventory:write' },
  { href: '/job-orders',          label: 'Job Orders',          icon: Hammer,          permission: 'inventory:write' },
  { href: '/reports-analytics',   label: 'Reports & Analytics', icon: BarChart3,       permission: 'reports:read' },
];

function hasAccess(item: MenuItem, userPerms: string[], isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (item.adminOnly) return false;
  if (!item.permission) return true;
  return userPerms.includes('all') || userPerms.includes(item.permission);
}

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const isAdmin = user?.isCompanyAdmin ?? false;
  const perms: string[] = user?.permissions ?? [];

  // Before mount, show all items so server HTML matches; filter happens client-side after mount
  const visibleItems = user
    ? ALL_MENU_ITEMS.filter(item => hasAccess(item, perms, isAdmin))
    : ALL_MENU_ITEMS;

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Logo */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="SprintZeroPH Logo"
            className="h-10 w-10 rounded-lg object-contain bg-white"
          />
          <div className="min-w-0">
            <div className="font-bold text-gray-900 dark:text-white leading-tight text-sm">SprintZeroPH</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Inventory Management</div>
          </div>
        </Link>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-400'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings (admin only) + role badge */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800 space-y-1">
        {isAdmin && (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        )}
      </div>
    </div>
  );
}
