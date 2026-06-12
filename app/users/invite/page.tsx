'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createUser } from '@/app/actions';

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  status: 'active' | 'inactive';
}

export default function InviteUserPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'staff',
    status: 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!validateEmail(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsLoading(true);
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';

      const result = await createUser({
        company_id: defaultCompanyId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password_hash: formData.password,
        role: formData.role,
        status: formData.status,
      });

      if (result.error) {
        toast.error(result.error.message || 'Failed to create user');
        setIsLoading(false);
        return;
      }

      toast.success(`User ${formData.email} created successfully`);
      router.push('/users');
    } catch (error) {
      toast.error('Failed to create user');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/users" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add User</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Invite a new team member to the system</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {/* Email */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email<span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@company.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {/* Password */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Temporary Password<span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">User can change password on first login</p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role<span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="admin">Admin - Full access</option>
                <option value="manager">Manager - Can manage inventory and reports</option>
                <option value="staff">Staff - Data entry and updates</option>
                <option value="viewer">Viewer - Read-only access</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status<span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Role Information */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Role Permissions</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              {formData.role === 'admin' && (
                <li>✓ Full access to all features and settings</li>
              )}
              {formData.role === 'manager' && (
                <>
                  <li>✓ Manage inventory and stock levels</li>
                  <li>✓ View and generate reports</li>
                  <li>✓ Cannot manage users or system settings</li>
                </>
              )}
              {formData.role === 'staff' && (
                <>
                  <li>✓ Create and update inventory records</li>
                  <li>✓ Access assigned products and warehouses</li>
                  <li>✓ Cannot approve purchases or delete records</li>
                </>
              )}
              {formData.role === 'viewer' && (
                <>
                  <li>✓ View reports and dashboards</li>
                  <li>✓ Cannot create or modify records</li>
                </>
              )}
            </ul>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Link href="/users">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Sending Invitation...' : 'Send Invitation'}
            </Button>
          </div>
        </form>

        {/* Help Section */}
        <div className="mt-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">What happens next?</h3>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>1. An invitation email will be sent to the user's email address</li>
            <li>2. They can click the link in the email to set up their account</li>
            <li>3. They'll be able to log in with their email and create a password</li>
            <li>4. Their access level will be based on the role you assign</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
