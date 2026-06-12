'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanyById, updateCompany } from '@/app/actions';

export default function CompanyEditPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCompany();
  }, [companyId]);

  const loadCompany = async () => {
    try {
      setIsLoading(true);
      const result = await getCompanyById(companyId);
      if (result.data) {
        setCompany(result.data);
      } else {
        toast.error('Company not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading company:', error);
      toast.error('Failed to load company');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!company.name || !company.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setIsSaving(true);
      const result = await updateCompany(companyId, {
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: company.address,
        city: company.city,
        state: company.state,
        country: company.country,
        postal_code: company.postal_code,
        user_limit: parseInt(String(company.user_limit)),
        plan_type: company.plan_type,
        subscription_status: company.subscription_status,
        status: company.status,
      });

      if (!result.error) {
        toast.success('Company updated successfully');
        router.back();
      } else {
        toast.error('Failed to update company');
      }
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Failed to update company');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading company...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{company.name}</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={company.name || ''}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={company.email || ''}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={company.phone || ''}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tax ID
              </label>
              <input
                type="text"
                value={company.tax_id || ''}
                onChange={(e) => setCompany({ ...company, tax_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <input
              type="text"
              value={company.address || ''}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="City"
              value={company.city || ''}
              onChange={(e) => setCompany({ ...company, city: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="State"
              value={company.state || ''}
              onChange={(e) => setCompany({ ...company, state: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="Postal Code"
              value={company.postal_code || ''}
              onChange={(e) => setCompany({ ...company, postal_code: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* SaaS Settings */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SaaS Plan Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan Type
              </label>
              <select
                value={company.plan_type}
                onChange={(e) => setCompany({ ...company, plan_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="starter">Starter (5 users)</option>
                <option value="professional">Professional (50 users)</option>
                <option value="enterprise">Enterprise (Unlimited)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                User Limit
              </label>
              <input
                type="number"
                value={company.user_limit || 5}
                onChange={(e) => setCompany({ ...company, user_limit: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subscription Status
              </label>
              <select
                value={company.subscription_status}
                onChange={(e) => setCompany({ ...company, subscription_status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Status
            </label>
            <select
              value={company.status}
              onChange={(e) => setCompany({ ...company, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            icon={<Save className="h-4 w-4" />}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Link href="/admin">
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
