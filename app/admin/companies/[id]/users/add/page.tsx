'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Eye, EyeOff, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanyById, createUserWithLimitCheck } from '@/app/actions';

export default function AddUserPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    status: 'active',
  });

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
        router.push('/admin');
      }
    } catch (error) {
      console.error('Error loading company:', error);
      toast.error('Failed to load company');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData((prev) => ({
      ...prev,
      password: password,
      confirm_password: password,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      toast.error('All fields are required');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setIsSaving(true);

      // Simple password hashing for demo
      const salt = 'temp_salt_' + Date.now();
      const passwordHash = salt + ':' + formData.password;

      // Ensure all required fields are set
      const user = {
        company_id: companyId,
        email: formData.email.toLowerCase().trim(),
        first_name: (formData.first_name || '').trim(),
        last_name: (formData.last_name || '').trim(),
        phone: formData.phone?.trim() || null,
        password_hash: passwordHash,
        // role_id will be fetched in createUser if not provided
        // role_id is a UUID that refers to the roles table
        status: formData.status,
        is_company_admin: false,
      };

      console.log('[USER_CREATION] ===== FORM SUBMISSION =====');
      console.log('[USER_CREATION] Form data:', formData);
      console.log('[USER_CREATION] Creating user:', user);
      console.log('[USER_CREATION] User keys:', Object.keys(user));
      console.log('[USER_CREATION] Email:', user.email);
      console.log('[USER_CREATION] Company ID:', user.company_id);
      console.log('[USER_CREATION] ===== END FORM =====');

      // Validate required fields
      if (!user.email || !user.first_name || !user.last_name) {
        toast.error('First name, last name, and email are required');
        setIsSaving(false);
        return;
      }

      const result = await createUserWithLimitCheck(user);

      if (result.error) {
        toast.error(result.error?.message || 'Failed to create user');
      } else {
        toast.success('User created successfully');
        router.push(`/admin/companies/${companyId}/users`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
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
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Company not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/companies/${companyId}/users`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add New User</h1>
          <p className="text-gray-600 dark:text-gray-400">{company.name}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="John"
                required
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Doe"
                required
                disabled={isSaving}
              />
            </div>
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
              placeholder="john@example.com"
              required
              disabled={isSaving}
            />
          </div>

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
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Account Settings */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Settings</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              disabled={isSaving}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Password */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Set Password</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={generatePassword}
              disabled={isSaving}
            >
              Generate Password
            </Button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono"
                placeholder="Enter password"
                required
                disabled={isSaving}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                disabled={isSaving}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono"
              placeholder="Confirm password"
              required
              disabled={isSaving}
            />
          </div>

          {formData.password && formData.confirm_password && formData.password === formData.confirm_password && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              Passwords match
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" icon={<Plus className="h-4 w-4" />} disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create User'}
          </Button>
          <Link href={`/admin/companies/${companyId}/users`}>
            <Button variant="secondary" disabled={isSaving}>
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
