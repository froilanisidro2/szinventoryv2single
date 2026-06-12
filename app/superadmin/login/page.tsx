'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Lock, Eye, EyeOff, AlertCircle, Shield, Settings, Database, BarChart3, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { verifySuperadminLogin } from '@/app/actions';

const features = [
  { icon: Building2, label: 'Company Management', desc: 'Create and manage all tenant companies' },
  { icon: Database, label: 'System Database', desc: 'Full visibility into platform data and schema' },
  { icon: BarChart3, label: 'Platform Analytics', desc: 'Usage metrics across all organisations' },
  { icon: Settings, label: 'Global Configuration', desc: 'System-wide settings and feature flags' },
];

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
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
      const result = await verifySuperadminLogin(username, password);

      if (!result.ok) {
        setError('Invalid username or password');
        toast.error('Invalid credentials');
      } else {
        toast.success('Welcome back, Super Admin!');
        const sessionData = JSON.stringify({
          id: 'super-admin-system',
          username,
          role: 'super-admin',
          isSuperAdmin: true,
          isCompanyAdmin: false,
          isRegularUser: false,
          timestamp: Date.now(),
        });
        const target = rememberMe ? localStorage : sessionStorage;
        const other  = rememberMe ? sessionStorage : localStorage;
        target.setItem('superadmin_session', sessionData);
        other.removeItem('superadmin_session');
        setTimeout(() => router.push('/superadmin'), 400);
      }
    } catch {
      const msg = 'An unexpected error occurred. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel – branding ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-12 overflow-hidden
                      bg-gradient-to-br from-violet-800 via-purple-700 to-indigo-800">

        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 shadow-lg">
            <img src="/logo.png" alt="SprintZeroPH" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">SprintZeroPH</p>
            <p className="text-purple-300 text-xs mt-0.5">Super Admin Portal</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 mb-4 ring-1 ring-white/15">
              <Shield className="h-3.5 w-3.5 text-purple-200" />
              <span className="text-purple-100 text-xs font-semibold">Restricted Access</span>
            </div>
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
              Full platform<br />control & oversight.
            </h2>
            <p className="mt-4 text-purple-200 text-base leading-relaxed max-w-md">
              Manage all companies, users, and system-wide configurations from a single secure console.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 max-w-md">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 bg-white/8 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-white/10">
                <div className="mt-0.5 h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-purple-300 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-purple-400">© {new Date().getFullYear()} SprintZeroPH. All rights reserved.</p>
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12
                      bg-gray-950 lg:bg-white lg:dark:bg-gray-950">

        {/* Mobile logo */}
        <div className="flex flex-col items-center mb-10 lg:hidden">
          <div className="h-14 w-14 rounded-2xl bg-purple-700 flex items-center justify-center mb-3 shadow-lg">
            <img src="/logo.png" alt="SprintZeroPH" className="h-9 w-9 object-contain" />
          </div>
          <p className="text-white font-bold text-lg">SprintZeroPH</p>
          <p className="text-gray-400 text-xs mt-0.5">Super Admin Portal</p>
        </div>

        <div className="w-full max-w-sm">
          {/* Badge */}
          <div className="mb-4 lg:mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 lg:text-purple-700 lg:dark:text-purple-400 bg-purple-900/40 lg:bg-purple-50 lg:dark:bg-purple-900/30 px-3 py-1 rounded-full ring-1 ring-purple-700/40 lg:ring-purple-200 lg:dark:ring-purple-800">
              <Shield className="h-3 w-3" />
              Super Admin Portal
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white lg:text-gray-900 lg:dark:text-white tracking-tight">Administrator sign in</h1>
            <p className="text-gray-400 lg:text-gray-500 lg:dark:text-gray-400 text-sm mt-1">Restricted to authorised administrators only</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-900/30 lg:bg-red-50 lg:dark:bg-red-900/20 border border-red-700 lg:border-red-200 lg:dark:border-red-800 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 lg:text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 lg:text-red-600 lg:dark:text-red-400 leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 lg:text-gray-700 lg:dark:text-gray-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 lg:text-gray-400 pointer-events-none" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  placeholder="Admin username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-700 lg:border-gray-200 lg:dark:border-gray-700
                             bg-gray-900 lg:bg-white lg:dark:bg-gray-800
                             text-white lg:text-gray-900 lg:dark:text-white
                             placeholder-gray-600 lg:placeholder-gray-400 lg:dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             transition-all text-sm"
                  required
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 lg:text-gray-700 lg:dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 lg:text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-700 lg:border-gray-200 lg:dark:border-gray-700
                             bg-gray-900 lg:bg-white lg:dark:bg-gray-800
                             text-white lg:text-gray-900 lg:dark:text-white
                             placeholder-gray-600 lg:placeholder-gray-400 lg:dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             transition-all text-sm"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 lg:hover:text-gray-600 lg:dark:hover:text-gray-200 transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className={`h-4 w-4 flex-shrink-0 rounded border-2 transition-colors flex items-center justify-center
                  ${rememberMe
                    ? 'bg-purple-700 border-purple-700'
                    : 'bg-transparent border-gray-500 lg:border-gray-400 lg:dark:border-gray-500'
                  }`}
              >
                {rememberMe && (
                  <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className="text-sm text-gray-400 lg:text-gray-600 lg:dark:text-gray-400"
                onClick={() => setRememberMe(!rememberMe)}
              >
                Remember me
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full mt-1 py-3 rounded-xl bg-purple-700 hover:bg-purple-800 active:bg-purple-900
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-semibold text-sm transition-all
                         shadow-lg shadow-purple-900/40"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-8 lg:hidden">
            © {new Date().getFullYear()} SprintZeroPH
          </p>
        </div>
      </div>

    </div>
  );
}
