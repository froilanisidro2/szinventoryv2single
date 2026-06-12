'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Users, Plus, LogOut, Home, Settings, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout, getCurrentUser } from '@/lib/auth-utils';
import { toast } from 'sonner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const user = getCurrentUser();
  const companyId = params.id || user?.companyId;
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // Check if this is the login page
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // Skip auth check for login page
    if (isLoginPage) {
      setIsAuthChecked(true);
      return;
    }

    if (!user || !user.isCompanyAdmin) {
      router.push('/admin/login');
    } else {
      setIsAuthChecked(true);
    }
  }, [user, router, isLoginPage]);

  if (!isAuthChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Render login page without sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const menuItems = [
    {
      icon: <Home className="h-5 w-5" />,
      label: 'Dashboard',
      href: '/admin',
      active: pathname === '/admin',
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: 'Users',
      href: `/admin/companies/${companyId}/users`,
      active: pathname?.includes('/users') && !pathname?.includes('/add'),
    },
    {
      icon: <Plus className="h-5 w-5" />,
      label: 'Add User',
      href: `/admin/companies/${companyId}/users/add`,
      active: pathname?.includes('/users/add'),
    },
    {
      icon: <Settings className="h-5 w-5" />,
      label: 'Roles & Permissions',
      href: `/admin/companies/${companyId}/roles`,
      active: pathname?.includes('/roles'),
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-gray-600 dark:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <button
                onClick={() => setIsOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  item.active
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="px-4 py-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">Logged in as</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
          <button onClick={() => setIsOpen(true)} className="text-gray-600 dark:text-gray-400">
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
