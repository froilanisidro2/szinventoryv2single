'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { changePassword } from '@/app/actions';
import { getPortalPath } from '@/lib/auth-utils';

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    
    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoading(true);
      
      // Get user ID — check sessionStorage first (non-remember-me login), then localStorage
      const userStr = typeof window !== 'undefined'
        ? (sessionStorage.getItem('user') ?? localStorage.getItem('user'))
        : null;
      if (!userStr) {
        toast.error('Session not found. Please log in again.');
        router.push('/auth/login');
        return;
      }

      let user: any;
      try {
        user = JSON.parse(userStr);
      } catch {
        toast.error('Session data corrupted. Please log in again.');
        router.push('/auth/login');
        return;
      }

      const userId = user?.id;
      if (!userId) {
        toast.error('User ID not found. Please log in again.');
        router.push('/auth/login');
        return;
      }
      
      const result = await changePassword(newPassword, userId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Password changed successfully!');
        // Use the same portal-path logic as post-login redirect
        const redirectPath = getPortalPath();
        setTimeout(() => router.push(redirectPath), 500);
      }
    } catch (err) {
      console.error('Error changing password:', err);
      toast.error('Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 mb-4">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Change Your Password</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
              This is your first login. For security reasons, you must set a permanent password.
            </p>
          </div>

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Security Notice:</strong> You received a temporary password. Please create a strong permanent password to secure your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password *
              </label>
              <div className="relative">
                <input
                  id="new_password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.newPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter your new password"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.newPassword}</p>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                At least 8 characters recommended
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Confirm your new password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mt-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Password Requirements:</p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li className={newPassword.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                  ✓ At least 8 characters
                </li>
                <li className={newPassword && confirmPassword && newPassword === confirmPassword ? 'text-green-600 dark:text-green-400' : ''}>
                  ✓ Passwords match
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Setting Password...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Set Permanent Password
                </>
              )}
            </button>
          </form>

          {/* Info Text */}
          <p className="text-center text-xs text-gray-600 dark:text-gray-400 mt-4">
            After setting your permanent password, you'll be redirected to your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
