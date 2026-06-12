'use client';

import { DarkModeToggle } from './dark-mode-toggle';
import { Suspense, useState, useEffect, useRef } from 'react';
import { LogOut, Clock, Warehouse, User, ChevronDown } from 'lucide-react';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import { useRouter } from 'next/navigation';
import { logoutUser, getCompanyById } from '@/app/actions';
import { toast } from 'sonner';
import { useWarehouse } from '@/contexts/warehouse-context';

function HeaderContent() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [dateTime, setDateTime] = useState<string>('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { warehouses, selectedWarehouseId, setSelectedWarehouseId } = useWarehouse();

  useEffect(() => {
    // Get user from sessionStorage first (no "remember me"), then localStorage ("remember me")
    try {
      const userStr = sessionStorage.getItem('user') ?? localStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);

        // Try to get company name (check both storages)
        const companyStr = sessionStorage.getItem('company') ?? localStorage.getItem('company');
        if (companyStr) {
          setCompany(JSON.parse(companyStr));
        } else if (userData.companyId) {
          // Fetch company and cache it in the same storage the user came from
          getCompanyById(userData.companyId).then((result) => {
            if (result.data) {
              setCompany(result.data);
              try {
                // Cache in whichever storage has the user object
                if (sessionStorage.getItem('user')) {
                  sessionStorage.setItem('company', JSON.stringify(result.data));
                } else {
                  localStorage.setItem('company', JSON.stringify(result.data));
                }
              } catch {}
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }

    // Update date/time
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      setDateTime(now.toLocaleDateString('en-US', options));
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const result = await logoutUser();
      
      if (result.success) {
        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('company');
        toast.success('Logged out successfully');
        router.push('/auth/login');
      } else {
        toast.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Left side - Company name */}
        <div className="flex items-center gap-2 min-w-0">
          {company?.name && (
            <>
              <div className="h-7 w-1.5 bg-primary-600 rounded-full flex-shrink-0"></div>
              <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                {company.name}
              </p>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Date/Time — desktop only */}
          <div className="hidden lg:flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="whitespace-nowrap">{dateTime}</span>
          </div>

          {/* Warehouse Selector — visible when warehouses are loaded */}
          {warehouses.length > 0 && (
            <>
              <div className="hidden lg:block h-5 w-px bg-gray-200 dark:bg-gray-700" />
              <div className="flex items-center gap-1.5">
                <Warehouse className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors min-w-[140px]"
                  title="Active Warehouse"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {fmtWarehouse(wh)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="hidden lg:block h-5 w-px bg-gray-200 dark:bg-gray-700" />

          {/* Theme toggle */}
          <DarkModeToggle />

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

          {/* User avatar dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={user ? (user.firstName || user.email) : 'Account'}
            >
              {/* Avatar circle */}
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 select-none">
                {user
                  ? (user.firstName?.charAt(0) || user.email?.charAt(0))?.toUpperCase() ?? <User className="h-4 w-4" />
                  : <User className="h-4 w-4" />}
              </div>
              {/* Name + role — hidden on mobile */}
              {user && (
                <div className="hidden sm:block text-left leading-tight max-w-[120px]">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {user.firstName
                      ? `${user.firstName} ${user.lastName || ''}`.trim()
                      : user.email}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 capitalize truncate">
                    {user.role || (user.isCompanyAdmin ? 'Admin' : 'User')}
                  </p>
                </div>
              )}
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 hidden sm:block transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 z-50 overflow-hidden">
                {/* User info */}
                {user && (
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {(user.firstName?.charAt(0) || user.email?.charAt(0))?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {user.firstName
                            ? `${user.firstName} ${user.lastName || ''}`.trim()
                            : user.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                          {user.role || (user.isCompanyAdmin ? 'Admin' : 'User')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Logout */}
                <div className="py-1">
                  <button
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span>{isLoggingOut ? 'Logging out…' : 'Logout'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function Header() {
  return (
    <Suspense fallback={<div className="h-16 border-b border-gray-200 dark:border-gray-800" />}>
      <HeaderContent />
    </Suspense>
  );
}
