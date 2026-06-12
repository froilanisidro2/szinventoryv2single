'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Building2, Users, TrendingUp, Settings, AlertCircle, Clock, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanies } from '@/app/actions';
import { logout, getSuperAdminSession } from '@/lib/auth-utils';
import Link from 'next/link';

interface CompanyWithStats {
  id: string;
  name: string;
  planType: string;
  activeUsers: number;
  userLimit: number;
  activeWarehouses: number;
  warehouseLimit: number;
  subscriptionStatus: string;
  email?: string;
}

function Usagebar({ used, limit, color }: { used: number; limit: number; color: 'green' | 'amber' }) {
  const isUnlimited = limit >= 999;
  const pct = isUnlimited ? Math.min((used / 10) * 100, 100) : Math.min((used / limit) * 100, 100);
  const atLimit = !isUnlimited && used >= limit;
  const barColor = atLimit ? 'bg-red-500' : color === 'amber' ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs min-w-max ${atLimit ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
        {used}/{isUnlimited ? '∞' : limit}
      </span>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [superAdminSession, setSuperAdminSession] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    // Verify user is super admin (only check after mount)
    const session = getSuperAdminSession();
    console.log('[DASHBOARD] Super admin session:', session);
    setSuperAdminSession(session);
    
    if (!session?.isSuperAdmin) {
      console.warn('[DASHBOARD] No super admin session found, redirecting');
      toast.error('Unauthorized: Super admin access only');
      router.push('/');
      return;
    }

    loadCompanies();

    // Update time every second
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US');
      const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      setCurrentTime(`${dateStr} ${timeStr}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isMounted, router]);

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      const result = await getCompanies();
      
      if (result.error) {
        setError('Failed to load companies');
        toast.error('Failed to load companies');
        return;
      }

      // Map API response to display format
      const mappedCompanies: CompanyWithStats[] = result.data.map((company: any) => ({
        id: company.id,
        name: company.name,
        planType: company.plan_type || 'starter',
        activeUsers: company.active_users || 0,
        userLimit: company.user_limit || 5,
        activeWarehouses: company.active_warehouses || 0,
        warehouseLimit: company.warehouse_limit ?? 999,
        subscriptionStatus: company.subscription_status || 'active',
        email: company.email,
      }));

      setCompanies(mappedCompanies);
    } catch (err) {
      console.error('Error loading companies:', err);
      setError('Failed to load companies');
      toast.error('Error loading companies');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const getTotalStats = () => ({
    totalCompanies: companies.length,
    totalUsers: companies.reduce((sum, c) => sum + c.activeUsers, 0),
    totalSlots: companies.reduce((sum, c) => sum + c.userLimit, 0),
    totalWarehouses: companies.reduce((sum, c) => sum + c.activeWarehouses, 0),
  });

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="px-4 py-4 md:px-6 md:py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Super Admin Portal
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage all companies and accounts
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden md:block">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                <Clock className="h-4 w-4" />
                <span>{currentTime}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {superAdminSession?.username}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">System Administrator</p>
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
      <main className="px-4 py-6 md:px-6 md:py-8 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Companies', value: stats.totalCompanies, icon: Building2, bg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
            { label: 'Active Users', value: stats.totalUsers, icon: Users, bg: 'bg-green-100 dark:bg-green-900/30', iconColor: 'text-green-600 dark:text-green-400' },
            { label: 'Total Warehouses', value: stats.totalWarehouses, icon: Warehouse, bg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
            { label: 'Total User Slots', value: stats.totalSlots, icon: TrendingUp, bg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400' },
          ].map(({ label, value, icon: Icon, bg, iconColor }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
                </div>
                <div className={`p-3 ${bg} rounded-lg`}>
                  <Icon className={`h-6 w-6 ${iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Companies List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Companies</h2>
            <Link href="/superadmin/companies/create">
              <Button variant="primary" size="sm">
                Create Company
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">Loading companies...</p>
            </div>
          ) : error ? (
            <div className="px-6 py-8">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          ) : companies.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No companies yet</p>
              <Link href="/superadmin/companies/create">
                <Button variant="primary" size="sm">
                  Create First Company
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Company</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Plan</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Users</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Warehouses</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{company.name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{company.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                          {company.planType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Usagebar used={company.activeUsers} limit={company.userLimit} color="green" />
                      </td>
                      <td className="px-6 py-4">
                        <Usagebar used={company.activeWarehouses} limit={company.warehouseLimit} color="amber" />
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            company.subscriptionStatus === 'active'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {company.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/superadmin/companies/${company.id}`}>
                          <Button variant="ghost" size="sm" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">Manage</span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
