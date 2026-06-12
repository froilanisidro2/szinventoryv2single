'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, CheckCircle, Copy as CopyIcon, AlertCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanyById } from '@/app/actions';

export default function AddAdminPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [createdAdmin, setCreatedAdmin] = useState<any>(null);

  useEffect(() => {
    console.log('[ADD-ADMIN] Page mounted with companyId:', companyId);
    loadCompanyData();
  }, [companyId]);

  const loadCompanyData = async () => {
    try {
      console.log('[ADD-ADMIN] loadCompanyData called for companyId:', companyId);
      // Check if admin data was passed via sessionStorage
      const storedAdminData = sessionStorage.getItem(`company_admin_${companyId}`);
      if (storedAdminData) {
        console.log('[ADD-ADMIN] Found created admin in session storage');
        setCreatedAdmin(JSON.parse(storedAdminData));
      } else {
        console.log('[ADD-ADMIN] No admin data in sessionStorage');
      }

      const result = await getCompanyById(companyId);
      console.log('[ADD-ADMIN] getCompanyById result:', result);
      if (result.error) {
        console.error('[ADD-ADMIN] Error loading company:', result.error);
        toast.error('Failed to load company');
        router.push('/superadmin/companies');
        return;
      }
      console.log('[ADD-ADMIN] Company loaded:', result.data);
      setCompany(result.data);
    } catch (err) {
      console.error('[ADD-ADMIN] Exception loading company:', err);
      toast.error('Error loading company');
      router.push('/superadmin/companies');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success('Password copied to clipboard');
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copied to clipboard');
  };

  const handleBackToCompanies = () => {
    sessionStorage.removeItem(`company_admin_${companyId}`);
    router.push('/superadmin/companies');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading company details...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    console.error('[ADD-ADMIN] Company not found after loading. Redirecting to companies list.');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Company not found</p>
          <Button onClick={() => router.push('/superadmin/companies')} className="mt-4">
            Back to Companies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToCompanies}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Companies
          </Button>
        </div>

        {/* Success Banner */}
        {createdAdmin && (
          <div className="card p-6 border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Company & Admin Created Successfully! 🎉
                </h2>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  Your company is ready to use with an admin account
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Company Details */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary-600" />
            Company Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name
              </label>
              <p className="text-gray-900 dark:text-white font-medium">{company.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white font-medium">{company.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Person in Charge
              </label>
              <p className="text-gray-900 dark:text-white font-medium">{company.person_in_charge_name || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact Number
              </label>
              <p className="text-gray-900 dark:text-white font-medium">{company.person_in_charge_contact || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address
              </label>
              <p className="text-gray-900 dark:text-white font-medium">{company.company_address || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Type
              </label>
              <p className="text-gray-900 dark:text-white font-medium capitalize">{company.business_type || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                TIN Number
              </label>
              <p className="text-gray-900 dark:text-white font-medium">{company.tin_number || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Active Users
              </label>
              <p className="text-gray-900 dark:text-white font-medium">
                {company.active_users || 0} / {company.user_limit || 'Unlimited'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan
              </label>
              <p className="text-gray-900 dark:text-white font-medium capitalize">{company.plan_type || 'Starter'}</p>
            </div>
          </div>
        </div>

        {/* Admin User Details */}
        {createdAdmin && (
          <div className="card p-6 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Admin Account Created
            </h3>

            <div className="space-y-4">
              {/* Admin Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Admin Full Name
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {createdAdmin.firstName} {createdAdmin.lastName}
                </p>
              </div>

              {/* Admin Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Admin Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={createdAdmin.email || company.email || ''}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
                  />
                  <Button
                    onClick={() => handleCopyEmail(createdAdmin.email || company.email || '')}
                    size="sm"
                    className="gap-2"
                  >
                    <CopyIcon className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>

              {/* Temporary Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temporary Password
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={createdAdmin.temporaryPassword || ''}
                      readOnly
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono text-sm"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    onClick={() => handleCopyPassword(createdAdmin.temporaryPassword || '')}
                    size="sm"
                    className="gap-2"
                  >
                    <CopyIcon className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>

              {/* Warning Box */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    <strong>⚠️ Important:</strong> Save this temporary password securely. It will only be displayed once. 
                    The admin must change this password immediately after first login.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="card p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200 dark:border-purple-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            What Next?
          </h3>
          <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                1
              </span>
              <span>
                <strong>Save these credentials</strong> - Share the email and temporary password with the admin
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                2
              </span>
              <span>
                <strong>Admin logs in</strong> - Using the email and temporary password above
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                3
              </span>
              <span>
                <strong>Change password</strong> - Set a permanent password on first login
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                4
              </span>
              <span>
                <strong>Create additional users</strong> - Add team members from Settings → Users
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                5
              </span>
              <span>
                <strong>Set up company data</strong> - Add products, customers, suppliers, etc. starting with blank inventory
              </span>
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleBackToCompanies}
            className="flex-1 gap-2"
            size="lg"
          >
            Back to Companies
          </Button>
        </div>
      </div>
    </div>
  );
}
