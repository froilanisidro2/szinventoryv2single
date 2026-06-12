'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Calendar,
  Clock,
  Building2,
} from 'lucide-react';
import { getCurrentUser, logout } from '@/lib/auth-utils';
import { getCompanyById } from '@/app/actions';
import { toast } from 'sonner';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [dateTime, setDateTime] = useState('');
  const [userName, setUserName] = useState('');
  const [userInitial, setUserInitial] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const user = getCurrentUser();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !user?.companyId) return;

    // Fetch company information
    const fetchCompany = async () => {
      try {
        const result = await getCompanyById(user.companyId);
        if (result.data) {
          setCompanyName(result.data.name || 'Company');
        }
      } catch (error) {
        console.error('Error fetching company:', error);
      }
    };

    fetchCompany();
  }, [isMounted, user?.companyId]);

  useEffect(() => {
    if (!isMounted) return;

    // Get user info
    if (user?.firstName && user?.lastName) {
      setUserName(`${user.firstName} ${user.lastName}`);
      setUserInitial(`${user.firstName[0]}${user.lastName[0]}`.toUpperCase());
    } else if (user?.email) {
      const emailParts = user.email.split('@');
      setUserName(emailParts[0] || 'User');
      setUserInitial(user.email.charAt(0).toUpperCase() || 'U');
    } else {
      setUserName('User');
      setUserInitial('U');
    }

    // Update date and time every second
    const updateDateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      setDateTime(`${dateStr} • ${timeStr}`);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, [isMounted, user]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Package className="h-5 w-5 text-white" />
          </div>
          <span className="hidden font-bold text-gray-900 sm:inline-block dark:text-white">
            Inventory
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            <Package className="h-4 w-4" />
            Products
          </Link>
          <Link
            href="/customers"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            <Users className="h-4 w-4" />
            Customers
          </Link>
          <Link
            href="/invoices"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            <FileText className="h-4 w-4" />
            Invoices
          </Link>
        </div>

        {/* Right side - User Info, Date/Time, Profile & Mobile Menu */}
        <div className="flex items-center gap-4">
          {/* User Info, Company, and Date/Time */}
          <div className="hidden lg:flex flex-col items-end gap-1.5">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{userName}</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              {companyName && (
                <>
                  <Building2 className="h-3 w-3" />
                  <span>{companyName}</span>
                  <span className="text-gray-500 dark:text-gray-500">•</span>
                </>
              )}
              <Calendar className="h-3 w-3" />
              <Clock className="h-3 w-3" />
              {dateTime}
            </div>
          </div>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
                {userInitial}
              </div>
              <ChevronDown className="hidden h-4 w-4 sm:block" />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {/* User Info in Dropdown */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{userName}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{user?.email}</p>
                  {companyName && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-2">
                      <Building2 className="h-3 w-3" />
                      {companyName}
                    </p>
                  )}
                  {user?.isCompanyAdmin && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Company Admin</p>
                  )}
                </div>

                {/* Date/Time Info - Mobile */}
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 lg:hidden">
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <Clock className="h-3 w-3" />
                    {dateTime}
                  </div>
                </div>

                {/* Menu Items */}
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-800"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800 md:hidden">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Package className="h-4 w-4" />
              Products
            </Link>
            <Link
              href="/customers"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Users className="h-4 w-4" />
              Customers
            </Link>
            <Link
              href="/invoices"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <FileText className="h-4 w-4" />
              Invoices
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
