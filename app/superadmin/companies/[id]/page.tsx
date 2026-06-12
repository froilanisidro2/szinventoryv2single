'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users, BarChart3, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanyById } from '@/app/actions';

interface CompanyData {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  user_limit: number;
  active_users: number;
  subscription_status: string;
  created_at?: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompanyData();
  }, [companyId]);

  const loadCompanyData = async () => {
    try {
      setIsLoading(true);
      const result = await getCompanyById(companyId);

      if (result.error) {
        setError('Failed to load company');
        toast.error('Failed to load company');
        return;
      }

      setCompany(result.data);
    } catch (err) {
      console.error('Error loading company:', err);
      setError('Failed to load company');
      toast.error('Error loading company');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading company details...</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
          <Link href="/superadmin">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Failed to Load Company</h3>
              <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const usagePercent = (company.active_users / company.user_limit) * 100;
  const usageStatus = 
    usagePercent >= 90 ? 'critical' :
    usagePercent >= 70 ? 'warning' :
    'normal';

  const statusBadgeColor = {
    active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    suspended: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
    trial: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  };

  const planBadgeColor = {
    starter: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    professional: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
    enterprise: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4 md:px-6">
          <Link href="/superadmin">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Companies
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{company.name}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{company.email}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 md:px-6 max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Plan */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Plan</p>
                  <span
                    className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                      planBadgeColor[company.plan_type as keyof typeof planBadgeColor]
                    }`}
                  >
                    {company.plan_type.charAt(0).toUpperCase() + company.plan_type.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Subscription Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Subscription Status</p>
                <span
                  className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                    statusBadgeColor[company.subscription_status as keyof typeof statusBadgeColor]
                  }`}
                >
                  {company.subscription_status.charAt(0).toUpperCase() + company.subscription_status.slice(1)}
                </span>
              </div>
            </div>

            {/* User Usage */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">User Usage</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {company.active_users}/{company.user_limit}
                </p>
              </div>
            </div>
          </div>

          {/* User Capacity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Capacity
              </h2>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {Math.round(usagePercent)}% used
              </span>
            </div>

            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    usageStatus === 'critical'
                      ? 'bg-red-500'
                      : usageStatus === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>{company.active_users} users active</span>
                <span>{company.user_limit - company.active_users} slots remaining</span>
              </div>

              {usageStatus === 'critical' && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
                  ⚠️ User limit nearly reached. Consider upgrading the plan.
                </div>
              )}
              {usageStatus === 'warning' && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                  📊 {company.user_limit - company.active_users} slots remaining.
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Company Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Company ID</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white mt-1 break-words">{company.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{company.email}</p>
              </div>
              {company.created_at && (
                <>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {new Date(company.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link href={`/superadmin/companies/${company.id}/users`} className="flex-1">
              <Button variant="primary" className="w-full">
                Manage Users
              </Button>
            </Link>
            <Link href="/superadmin" className="flex-1">
              <Button variant="ghost" className="w-full">
                Back
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
