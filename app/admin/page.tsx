'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, Settings, AlertCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanyById } from '@/app/actions';
import { logout, getCurrentUser } from '@/lib/auth-utils';

interface Company {
  id: string;
  name: string;
  planType: string;
  activeUsers: number;
  userLimit: number;
}

export default function CompanyAdminDashboard() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getCurrentUser();

  useEffect(() => {
    // Verify user is company admin
    if (!user?.isCompanyAdmin) {
      toast.error('Unauthorized: Company admin access only');
      router.push('/dashboard');
      return;
    }

    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      setIsLoading(true);
      if (!user?.companyId) {
        throw new Error('No company ID found');
      }

      const result = await getCompanyById(user.companyId);

      if (result.error) {
        setError('Failed to load company data');
        toast.error('Failed to load company data');
        return;
      }

      const companyData = result.data;
      setCompany({
        id: companyData.id,
        name: companyData.name,
        planType: companyData.plan_type || 'starter',
        activeUsers: companyData.active_users || 0,
        userLimit: companyData.user_limit || 5,
      });
    } catch (err) {
      console.error('Error loading company:', err);
      setError('Failed to load company data');
      toast.error('Error loading company data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const canAddMoreUsers = company ? company.activeUsers < company.userLimit : false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="px-4 py-4 md:px-6 md:py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {company?.name || 'Company'} Admin
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage company users, roles, and permissions
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.firstName}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 md:px-6 md:py-8 max-w-6xl mx-auto">
        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading company data...</p>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        ) : company ? (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Plan</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2 capitalize">
                      {company.planType}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                      {company.activeUsers}/{company.userLimit}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Remaining Slots</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {company.userLimit - company.activeUsers}
                  </p>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        company.activeUsers >= company.userLimit
                          ? 'bg-red-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${(company.activeUsers / company.userLimit) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Management Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Users Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Users
                  </h2>
                  <Link href={`/admin/companies/${company.id}/users`}>
                    <Button variant="primary" size="sm">
                      Manage Users
                    </Button>
                  </Link>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {company.activeUsers} user{company.activeUsers !== 1 ? 's' : ''} active
                  {company.activeUsers >= company.userLimit && (
                    <span className="block mt-2 text-red-600 dark:text-red-400 font-medium">
                      ⚠️ User limit reached
                    </span>
                  )}
                </p>
                {canAddMoreUsers && (
                  <Link href={`/admin/companies/${company.id}/users/add`}>
                    <Button variant="ghost" size="sm" className="w-full flex items-center justify-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add User
                    </Button>
                  </Link>
                )}
              </div>

              {/* Roles & Permissions Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Roles & Permissions
                  </h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Manage user roles and permissions
                </p>
                <Link href={`/admin/companies/${company.id}/roles`}>
                  <Button variant="ghost" size="sm" className="w-full">
                    Configure Roles
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
