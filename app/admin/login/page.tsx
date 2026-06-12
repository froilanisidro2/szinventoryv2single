'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser } from '@/app/actions';
import { storeUser } from '@/lib/auth-utils';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginUser(email, password);

      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else if (result.data) {
        // Verify this is a company admin
        if (!result.data.isCompanyAdmin) {
          setError('This account is not authorized as a company admin. Please use the regular login.');
          toast.error('Not a company admin account');
          setIsLoading(false);
          return;
        }

        console.log('[ADMIN LOGIN] Company admin authenticated:', result.data.email);
        
        toast.success(`Welcome back, ${result.data.firstName}!`);
        
        // Store user info (localStorage if remembered, sessionStorage otherwise)
        storeUser(result.data, rememberMe);
        
        // Redirect to admin dashboard
        setTimeout(() => {
          router.push('/admin');
        }, 500);
      }
    } catch (err) {
      console.error('Admin login error:', err);
      const errorMsg = 'An error occurred during login';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="card p-8 shadow-lg border-t-4 border-t-blue-600 dark:border-t-blue-500">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 mb-4">
              <Users className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Admin</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Company Administration Portal
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="admin@company.com"
                  className="input pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password"
                  className="input pl-10 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className={`h-4 w-4 flex-shrink-0 rounded border-2 transition-colors flex items-center justify-center
                  ${rememberMe
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-transparent border-gray-400 dark:border-gray-500'
                  }`}
              >
                {rememberMe && (
                  <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Remember me
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="h-5 w-5" />
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>Company Admin Access</p>
            <p className="text-xs">
              <a href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:underline">
                Regular User Login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
