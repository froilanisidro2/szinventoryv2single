'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Building2, ChevronLeft, AlertCircle, Users, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanyById, updateCompany } from '@/app/actions';
import { getSuperAdminSession } from '@/lib/auth-utils';
import { PLANS, formatLimit, formatPrice } from '@/lib/plans';
import Link from 'next/link';

const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500';

export default function EditCompanyPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted) return;
    const session = getSuperAdminSession();
    if (!session?.isSuperAdmin) { router.push('/superadmin/login'); return; }
    loadCompany();
  }, [isMounted, router]);

  const loadCompany = async () => {
    try {
      setIsLoading(true);
      const result = await getCompanyById(companyId);
      if (result.error || !result.data) {
        toast.error('Failed to load company');
        router.push('/superadmin/companies');
        return;
      }
      const data = result.data as any;
      setCompany(data);
      setFormData({
        name: data.name || '',
        email: data.email || '',
        plan_type: data.plan_type || 'starter',
        subscription_status: data.subscription_status || 'active',
        status: data.status || 'active',
        user_limit: data.user_limit ?? PLANS[data.plan_type || 'starter']?.userLimit ?? 3,
        warehouse_limit: data.warehouse_limit ?? PLANS[data.plan_type || 'starter']?.warehouseLimit ?? 1,
        currency_code: data.currency_code || 'PHP',
      });
    } catch {
      toast.error('Error loading company');
      router.push('/superadmin/companies');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'user_limit' || name === 'warehouse_limit' ? parseInt(value) || 1 : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const plan = e.target.value;
    const def = PLANS[plan] ?? PLANS['starter']!;
    setFormData((prev) => ({
      ...prev,
      plan_type: plan,
      user_limit: def.userLimit,
      warehouse_limit: def.warehouseLimit,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = 'Company name is required';
    if (!formData.email?.trim()) newErrors.email = 'Company email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email address';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the errors below');
      return;
    }

    try {
      setIsSaving(true);
      const result = await updateCompany(companyId, formData);
      if (result.error) {
        const msg = typeof result.error === 'string' ? result.error : (result.error as any)?.message || 'Failed to update';
        if (String(msg).includes('duplicate') || String(msg).includes('unique')) {
          setErrors({ name: 'A company with this name already exists.' });
          toast.error('Company name already exists');
        } else {
          toast.error(msg);
        }
      } else {
        toast.success('Company updated successfully');
        router.push('/superadmin/companies');
      }
    } catch {
      toast.error('Failed to update company');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading company...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 font-medium mb-4">Company not found</p>
          <Link href="/superadmin/companies"><Button variant="ghost">Return to Companies</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/superadmin/companies" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4 text-sm">
            <ChevronLeft className="h-4 w-4" />
            Back to Companies
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary-600" />
            Edit Company
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{company.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name *</label>
                <input name="name" type="text" value={formData.name || ''} onChange={handleChange}
                  className={errors.name ? INPUT_CLASS.replace('border-gray-300 dark:border-gray-600', 'border-red-500') : INPUT_CLASS} required />
                {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Email *</label>
                <input name="email" type="email" value={formData.email || ''} onChange={handleChange}
                  className={errors.email ? INPUT_CLASS.replace('border-gray-300 dark:border-gray-600', 'border-red-500') : INPUT_CLASS} required />
                {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Plan & Limits */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plan & Limits</h2>
            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subscription Plan</label>
                <select name="plan_type" value={formData.plan_type || 'starter'} onChange={handlePlanChange} className={INPUT_CLASS}>
                  {Object.entries(PLANS).map(([key, plan]) => (
                    <option key={key} value={key}>
                      {plan.label} — {formatLimit(plan.userLimit)} users / {formatLimit(plan.warehouseLimit)} warehouse{plan.warehouseLimit !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Limits display */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">User Limit</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatLimit(formData.user_limit ?? 3)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <Warehouse className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Warehouse Limit</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatLimit(formData.warehouse_limit ?? 1)}</p>
                  </div>
                </div>
              </div>

              {/* Manual override for custom plan */}
              {formData.plan_type === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User Limit</label>
                    <input name="user_limit" type="number" min="1" value={formData.user_limit || 1} onChange={handleChange} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Warehouse Limit</label>
                    <input name="warehouse_limit" type="number" min="1" value={formData.warehouse_limit || 1} onChange={handleChange} className={INPUT_CLASS} />
                  </div>
                </div>
              )}

              {/* Usage info */}
              {company.active_users !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-1">
                  <p>Current usage: <strong className="text-gray-700 dark:text-gray-300">{company.active_users ?? 0}</strong> / {formatLimit(formData.user_limit ?? 3)} users</p>
                  {company.active_warehouses !== undefined && (
                    <p>Warehouses: <strong className="text-gray-700 dark:text-gray-300">{company.active_warehouses ?? 0}</strong> / {formatLimit(formData.warehouse_limit ?? 1)}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subscription Status</label>
                <select name="subscription_status" value={formData.subscription_status || 'active'} onChange={handleChange} className={INPUT_CLASS}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Status</label>
                <select name="status" value={formData.status || 'active'} onChange={handleChange} className={INPUT_CLASS}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currency</label>
                <select name="currency_code" value={formData.currency_code || 'PHP'} onChange={handleChange} className={INPUT_CLASS}>
                  <option value="PHP">Philippine Peso (PHP)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="SGD">Singapore Dollar (SGD)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Link href="/superadmin/companies" className="flex-1">
              <Button variant="ghost" className="w-full">Cancel</Button>
            </Link>
            <button type="submit" disabled={isSaving}
              className="flex-1 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
