'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, Users, Calendar, EyeIcon, Edit, AlertCircle, Trash2, Ban, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanies, deactivateCompany, deleteCompany } from '@/app/actions';
import { getSuperAdminSession } from '@/lib/auth-utils';
import Link from 'next/link';

interface Company {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  subscription_status: string;
  active_users: number;
  user_limit: number;
  active_warehouses: number;
  warehouse_limit: number;
  created_at: string;
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'users' | 'created'>('name');
  const [isMounted, setIsMounted] = useState(false);
  
  // Action management
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [actionType, setActionType] = useState<'edit' | 'deactivate' | 'delete' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    console.log('[COMPANIES] Checking auth after mount');
    const superAdminSession = getSuperAdminSession();
    console.log('[COMPANIES] Session check:', superAdminSession);
    
    if (!superAdminSession?.isSuperAdmin) {
      console.warn('[COMPANIES] No super admin session, redirecting to login');
      router.push('/superadmin/login');
      return;
    }
    
    console.log('[COMPANIES] Super admin authenticated');
    loadCompanies();
  }, [isMounted, router]);

  useEffect(() => {
    filterAndSortCompanies();
  }, [companies, searchTerm, sortBy]);

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      console.log('[COMPANIES] Loading companies from API...');
      const result = await getCompanies(1000, 0);

      console.log('[COMPANIES] API Response:', result);

      if (result.error || !result.data) {
        console.error('[COMPANIES] Error response:', result.error);
        setError('Failed to load companies');
        toast.error('Failed to load companies');
        return;
      }

      console.log('[COMPANIES] Companies list:', result.data);
      setCompanies(result.data);
      setError('');
    } catch (err) {
      console.error('Error loading companies:', err);
      setError('Failed to load companies');
      toast.error('Error loading companies');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortCompanies = () => {
    let filtered = companies;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (company) =>
          company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          company.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'users':
          return (b.active_users || 0) - (a.active_users || 0);
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredCompanies(sorted);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
      trial: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
      suspended: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
      cancelled: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400' },
    };

    const color = colors[status] || colors.active;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color?.bg} ${color?.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      starter: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      pro: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      enterprise: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    };

    const color = colors[plan] || colors.starter;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleEditClick = (company: Company) => {
    setSelectedCompany(company);
    setActionType('edit');
  };

  const handleDeactivateClick = (company: Company) => {
    setSelectedCompany(company);
    setActionType('deactivate');
  };

  const handleDeleteClick = (company: Company) => {
    setSelectedCompany(company);
    setActionType('delete');
  };

  const handleConfirmAction = async () => {
    if (!selectedCompany) return;

    try {
      setIsActionLoading(true);

      if (actionType === 'deactivate') {
        const result = await deactivateCompany(selectedCompany.id);
        if (result.error) {
          toast.error('Failed to deactivate company');
        } else {
          toast.success('Company deactivated successfully');
          loadCompanies(); // Reload the list
        }
      } else if (actionType === 'delete') {
        const result = await deleteCompany(selectedCompany.id);
        if (result.error) {
          toast.error('Failed to delete company');
        } else {
          toast.success('Company deleted successfully');
          loadCompanies(); // Reload the list
        }
      } else if (actionType === 'edit') {
        router.push(`/superadmin/companies/${selectedCompany.id}/edit`);
      }

      setSelectedCompany(null);
      setActionType(null);
    } catch (err) {
      console.error('Error performing action:', err);
      toast.error('An error occurred');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedCompany(null);
    setActionType(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary-600" />
            Companies
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage all companies and their subscriptions
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by company name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input px-4"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="users">Sort: Active Users</option>
              <option value="created">Sort: Recently Created</option>
            </select>

            {/* Create Button */}
            <Link href="/superadmin/companies/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Company
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Total: <b className="text-gray-900 dark:text-white">{companies.length}</b></span>
            <span>|</span>
            <span>Showing: <b className="text-gray-900 dark:text-white">{filteredCompanies.length}</b></span>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
              <Button variant="ghost" size="sm" onClick={loadCompanies} className="mt-2">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading companies...</p>
            </div>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No companies found</p>
            <Link href="/superadmin/companies/create">
              <Button>Create First Company</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Company Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Warehouses
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCompanies.map((company) => (
                    <tr
                      key={company.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{company.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{company.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getPlanBadge(company.plan_type || 'starter')}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(company.subscription_status || 'active')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className={`text-xs font-medium ${(company.active_users || 0) >= (company.user_limit || 5) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                              {company.active_users || 0}/{company.user_limit || 5}
                            </span>
                            {(company.active_users || 0) >= (company.user_limit || 5) && (
                              <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Full</span>
                            )}
                          </div>
                          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${(company.active_users || 0) >= (company.user_limit || 5) ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(((company.active_users || 0) / (company.user_limit || 5)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const used = company.active_warehouses || 0;
                          const limit = company.warehouse_limit ?? 999;
                          const isUnlimited = limit >= 999;
                          const atLimit = !isUnlimited && used >= limit;
                          const pct = isUnlimited ? Math.min((used / 5) * 100, 100) : Math.min((used / limit) * 100, 100);
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Warehouse className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <span className={`text-xs font-medium ${atLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                  {used}/{isUnlimited ? '∞' : limit}
                                </span>
                                {atLimit && <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Full</span>}
                              </div>
                              <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${atLimit ? 'bg-red-500' : 'bg-amber-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="h-4 w-4" />
                          {formatDate(company.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/superadmin/companies/${company.id}`}>
                            <Button variant="ghost" size="sm" className="flex items-center gap-1">
                              <EyeIcon className="h-4 w-4" />
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            onClick={() => handleEditClick(company)}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                            onClick={() => handleDeactivateClick(company)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400"
                            onClick={() => handleDeleteClick(company)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {actionType && selectedCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full mx-4">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  {actionType === 'delete' && (
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  )}
                  {actionType === 'deactivate' && (
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Ban className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  )}
                  {actionType === 'edit' && (
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Edit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {actionType === 'delete' && 'Delete Company'}
                    {actionType === 'deactivate' && 'Deactivate Company'}
                    {actionType === 'edit' && 'Edit Company'}
                  </h3>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {actionType === 'delete' && (
                    <>
                      Are you sure you want to delete <strong>{selectedCompany.name}</strong>? This action cannot be undone.
                    </>
                  )}
                  {actionType === 'deactivate' && (
                    <>
                      Are you sure you want to deactivate <strong>{selectedCompany.name}</strong>? Users will not be able to access this company.
                    </>
                  )}
                  {actionType === 'edit' && (
                    <>
                      You will be redirected to edit <strong>{selectedCompany.name}</strong>.
                    </>
                  )}
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleCloseModal}
                    disabled={isActionLoading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmAction}
                    disabled={isActionLoading}
                    className={`flex-1 ${
                      actionType === 'delete'
                        ? 'bg-red-600 hover:bg-red-700'
                        : actionType === 'deactivate'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isActionLoading ? 'Processing...' : 'Confirm'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
