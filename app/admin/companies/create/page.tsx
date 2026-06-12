'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Eye, EyeOff, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createCompany } from '@/app/actions';

export default function CreateCompanyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [createdAdmin, setCreatedAdmin] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    tax_id: '',
    plan_type: 'starter',
    user_limit: 5,
    subscription_status: 'active',
    status: 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'user_limit' ? parseInt(value) : value,
    }));
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setIsLoading(true);
      const result = await createCompany(formData);

      if (!result.error && result.data) {
        const { adminUser, warning } = result.data;
        
        if (warning) {
          toast.warning(warning);
        }

        if (adminUser) {
          // Show admin credentials
          setCreatedAdmin(adminUser);
          toast.success('Company and admin user created successfully!');
          console.log('Admin user created:', adminUser);
        } else {
          toast.success('Company created successfully');
          // Redirect after a short delay
          setTimeout(() => router.push('/admin'), 2000);
        }
      } else {
        const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to create company';
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('Failed to create company');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const plan = e.target.value;
    const limits = {
      starter: 5,
      professional: 50,
      enterprise: 999,
    };
    setFormData((prev) => ({
      ...prev,
      plan_type: plan,
      user_limit: limits[plan as keyof typeof limits] || 5,
    }));
  };

  // If admin was created, show credentials modal
  if (createdAdmin) {
    return (
      <div className="space-y-6 p-6 min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-2xl w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="text-4xl">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Company & Admin User Created!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Save the admin credentials below. They will only be displayed once.
            </p>
          </div>

          {/* Admin Credentials Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-blue-900 dark:text-blue-100">Admin User Credentials</h2>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={createdAdmin.email}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  onClick={() => copyToClipboard(createdAdmin.email, 'email')}
                >
                  {copiedField === 'email' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Temporary Password */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Temporary Password</label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={createdAdmin.temporaryPassword}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white font-mono"
                />
                <button
                  type="button"
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  onClick={() => copyToClipboard(createdAdmin.temporaryPassword, 'password')}
                >
                  {copiedField === 'password' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mt-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-100">
                ⚠️ {createdAdmin.instructions}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-center pt-4">
            <Link href="/admin" className="flex-1">
              <Button variant="secondary" className="w-full">
                Back to Companies
              </Button>
            </Link>
            <Link href="/auth/login" className="flex-1">
              <Button variant="primary" className="w-full">
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Company</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
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
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Enter company name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="company@example.com"
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
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tax ID
              </label>
              <input
                type="text"
                name="tax_id"
                value={formData.tax_id}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Tax ID or VAT number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="City"
            />
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="State"
            />
            <input
              type="text"
              name="postal_code"
              value={formData.postal_code}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="Postal Code"
            />
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="Country"
            />
          </div>
        </div>

        {/* SaaS Settings */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SaaS Plan Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan Type *
              </label>
              <select
                name="plan_type"
                value={formData.plan_type}
                onChange={handlePlanChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="starter">Starter (5 users) - $29/mo</option>
                <option value="professional">Professional (50 users) - $99/mo</option>
                <option value="enterprise">Enterprise (Unlimited) - Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                User Limit
              </label>
              <input
                type="number"
                name="user_limit"
                value={formData.user_limit}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subscription Status
              </label>
              <select
                name="subscription_status"
                value={formData.subscription_status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Company'}
          </Button>
          <Link href="/admin">
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
