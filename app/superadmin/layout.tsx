'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Plus, LogOut, Home, Menu, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout, getSuperAdminSession } from '@/lib/auth-utils';
import { toast } from 'sonner';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const superAdminSession = getSuperAdminSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if this is the login page
  const isLoginPage = pathname === '/superadmin/login';

  useEffect(() => {
    // Skip auth check for login page
    if (isLoginPage) {
      setIsLoading(false);
      return;
    }

    if (!superAdminSession) {
      router.push('/superadmin/login');
    } else {
      setIsLoading(false);
    }
  }, [superAdminSession, router, isLoginPage]);

  if (isLoading) {
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

  const dashboardItem = {
    icon: <Home className="h-5 w-5" />,
    label: 'Dashboard',
    href: '/superadmin',
    active: pathname === '/superadmin',
  };

  const accountItems = [
    {
      icon: <Building2 className="h-5 w-5" />,
      label: 'View Companies',
      href: '/superadmin/companies',
      active: pathname === '/superadmin/companies' || (pathname?.startsWith('/superadmin/companies/') && !pathname?.startsWith('/superadmin/companies/create')),
    },
    {
      icon: <Plus className="h-5 w-5" />,
      label: 'Create Company',
      href: '/superadmin/companies/create',
      active: pathname === '/superadmin/companies/create',
    },
  ];

  const billingItems = [
    {
      icon: <FileText className="h-5 w-5" />,
      label: 'Billing & Invoices',
      href: '/superadmin/billing',
      active: pathname === '/superadmin/billing',
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Super Admin</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-gray-600 dark:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-6">
          {/* Dashboard */}
          <Link href={dashboardItem.href}>
            <button
              onClick={() => setIsOpen(false)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                dashboardItem.active
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              {dashboardItem.icon}
              <span className="font-medium">{dashboardItem.label}</span>
            </button>
          </Link>

          {/* Accounts Section */}
          <div>
            <h3 className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Accounts
            </h3>
            <div className="space-y-1">
              {accountItems.map((item) => (
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
            </div>
          </div>

          {/* Billing Section */}
          <div>
            <h3 className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Finance
            </h3>
            <div className="space-y-1">
              {billingItems.map((item) => (
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
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
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
