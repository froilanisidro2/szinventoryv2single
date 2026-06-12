'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Warehouse, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createCompany } from '@/app/actions';
import { PLANS, formatLimit, formatPrice } from '@/lib/plans';

const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500';
const INPUT_ERROR_CLASS =
  'w-full px-4 py-2 border border-red-500 dark:border-red-500 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500';

export default function CreateCompanyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    person_in_charge_name: '',
    person_in_charge_contact: '',
    company_address: '',
    business_type: '',
    tin_number: '',
    plan_type: 'starter',
    user_limit: PLANS['starter']!.userLimit,
    warehouse_limit: PLANS['starter']!.warehouseLimit,
    subscription_status: 'active',
    status: 'active',
    currency_code: 'PHP',
    is_super_admin_company: false,
  });

  const selectedPlan = PLANS[formData.plan_type] ?? PLANS['starter']!;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev } as Record<string, any>;
      if (name === 'user_limit' || name === 'warehouse_limit') {
        updated[name] = parseInt(value) || 1;
      } else {
        updated[name] = value;
      }
      return updated as typeof formData;
    });
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
    if (!formData.person_in_charge_name?.trim()) newErrors.person_in_charge_name = 'Person in charge is required';
    if (!formData.person_in_charge_contact?.trim()) newErrors.person_in_charge_contact = 'Contact number is required';
    if (!formData.company_address?.trim()) newErrors.company_address = 'Company address is required';
    if (!formData.business_type?.trim()) newErrors.business_type = 'Business type is required';
    if (!formData.tin_number?.trim()) newErrors.tin_number = 'TIN number is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsLoading(true);
      const result = await createCompany(formData);

      if (!result.error && result.data) {
        toast.success('Company created! Redirecting to admin setup...');
        const responseData = result.data as any;
        const newCompany = responseData.company || responseData;
        const companyId = newCompany?.id;

        if (companyId) {
          if (responseData.adminUser) {
            sessionStorage.setItem(`company_admin_${companyId}`, JSON.stringify(responseData.adminUser));
          }
          setTimeout(() => router.push(`/superadmin/companies/${companyId}/users/add`), 300);
        } else {
          toast.error('Company created but ID not found. Check companies list.');
          setTimeout(() => router.push('/superadmin/companies'), 1000);
        }
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : (result.error as any)?.message || 'Failed to create company';
        if (String(errorMsg).includes('duplicate') || String(errorMsg).includes('unique')) {
          setErrors({ name: 'A company with this name already exists.' });
          toast.error('Company name already exists');
        } else {
          toast.error(errorMsg);
        }
      }
    } catch (error) {
      toast.error('Failed to create company');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4 md:px-6 flex items-center gap-4">
          <Link href="/superadmin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Company</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Set up a new company with an initial admin account</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 md:px-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Company Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name *</label>
                <input name="name" type="text" value={formData.name} onChange={handleChange}
                  className={errors.name ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="Acme Corporation" required />
                {errors.name && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Email *</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange}
                  className={errors.email ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="admin@company.com" required />
                {errors.email && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Person in Charge & Business Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Person in Charge & Business Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Person in Charge *</label>
                <input name="person_in_charge_name" type="text" value={formData.person_in_charge_name} onChange={handleChange}
                  className={errors.person_in_charge_name ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="Full name" required />
                {errors.person_in_charge_name && <p className="text-red-600 text-sm mt-1">{errors.person_in_charge_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Number *</label>
                <input name="person_in_charge_contact" type="tel" value={formData.person_in_charge_contact} onChange={handleChange}
                  className={errors.person_in_charge_contact ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="+63 9XX XXX XXXX" required />
                {errors.person_in_charge_contact && <p className="text-red-600 text-sm mt-1">{errors.person_in_charge_contact}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Address *</label>
                <input name="company_address" type="text" value={formData.company_address} onChange={handleChange}
                  className={errors.company_address ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="Street, City, Province" required />
                {errors.company_address && <p className="text-red-600 text-sm mt-1">{errors.company_address}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type of Business *</label>
                <select name="business_type" value={formData.business_type} onChange={handleChange}
                  className={errors.business_type ? INPUT_ERROR_CLASS : INPUT_CLASS} required>
                  <option value="">Select business type</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="distribution">Distribution</option>
                  <option value="e-commerce">E-Commerce</option>
                  <option value="services">Services</option>
                  <option value="other">Other</option>
                </select>
                {errors.business_type && <p className="text-red-600 text-sm mt-1">{errors.business_type}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">TIN Number *</label>
                <input name="tin_number" type="text" value={formData.tin_number} onChange={handleChange}
                  className={errors.tin_number ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="123-456-789-001" required />
                {errors.tin_number && <p className="text-red-600 text-sm mt-1">{errors.tin_number}</p>}
              </div>
            </div>
          </div>

          {/* Plan & Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plan & Configuration</h2>
            <div className="space-y-4">

              {/* Plan selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subscription Plan *</label>
                <select name="plan_type" value={formData.plan_type} onChange={handlePlanChange} className={INPUT_CLASS}>
                  {Object.entries(PLANS).map(([key, plan]) => (
                    <option key={key} value={key}>
                      {plan.label} — {formatLimit(plan.userLimit)} users / {formatLimit(plan.warehouseLimit)} warehouse{plan.warehouseLimit !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan limits summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">User Limit</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {formatLimit(formData.user_limit)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <Warehouse className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Warehouse Limit</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {formatLimit(formData.warehouse_limit)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom overrides */}
              {formData.plan_type === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User Limit *</label>
                    <input name="user_limit" type="number" min="1" value={formData.user_limit} onChange={handleChange} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Warehouse Limit *</label>
                    <input name="warehouse_limit" type="number" min="1" value={formData.warehouse_limit} onChange={handleChange} className={INPUT_CLASS} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subscription Status</label>
                <select name="subscription_status" value={formData.subscription_status} onChange={handleChange} className={INPUT_CLASS}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currency</label>
                <select name="currency_code" value={formData.currency_code} onChange={handleChange} className={INPUT_CLASS}>
                  <option value="PHP">Philippine Peso (PHP)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="SGD">Singapore Dollar (SGD)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Plan feature summary */}
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <p className="text-sm font-semibold text-primary-900 dark:text-primary-200">
                {selectedPlan.label} Plan
              </p>
            </div>
            <p className="text-xs text-primary-700 dark:text-primary-300">
              {formatLimit(selectedPlan.userLimit)} users · {formatLimit(selectedPlan.warehouseLimit)} warehouse{selectedPlan.warehouseLimit !== 1 ? 's' : ''} · Target: {selectedPlan.target}
            </p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
              An admin account will be auto-created. You will receive login credentials to share with the company admin.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link href="/superadmin" className="flex-1">
              <Button variant="ghost" className="w-full">Cancel</Button>
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Company'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
