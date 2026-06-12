'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Package, BarChart3, Truck, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser } from '@/app/actions';
import { storeUser, getPortalPath } from '@/lib/auth-utils';
import { LoginSplash } from '@/components/ui/login-splash';

const features = [
  { icon: Package, label: 'Inventory Tracking', desc: 'Real-time stock visibility across all locations' },
  { icon: Truck, label: 'Purchase Orders', desc: 'Streamline procurement from order to delivery' },
  { icon: BarChart3, label: 'Analytics & Reports', desc: 'Actionable insights to drive smarter decisions' },
  { icon: ShieldCheck, label: 'Role-Based Access', desc: 'Granular permissions for your entire team' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [splash, setSplash] = useState<{ name: string; redirect: string } | null>(null);

  const handleSplashDone = useCallback(() => {
    if (splash) router.push(splash.redirect);
  }, [splash, router]);

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
        storeUser(result.data, rememberMe);

        const redirect = result.data.forcePasswordChange || result.data.passwordIsTemporary
          ? '/auth/force-password-change'
          : getPortalPath();

        setSplash({ name: result.data.firstName || result.data.email, redirect });
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
    <>
      {splash && <LoginSplash userName={splash.name} onDone={handleSplashDone} />}

      <div className="min-h-screen flex">

        {/* ── Left panel – branding ── */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-12 overflow-hidden
                        bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-700">

          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none select-none">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-indigo-400/10 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/5" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />
            {/* Grid dots */}
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
              <p className="text-primary-200 text-xs mt-0.5">Inventory Management</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="relative space-y-8">
            <div>
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
                Everything you need<br />to run your inventory.
              </h2>
              <p className="mt-4 text-primary-200 text-base leading-relaxed max-w-md">
                One platform to manage stock, suppliers, purchases, and fulfillment — built for Filipino businesses.
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
                    <p className="text-primary-300 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="relative text-xs text-primary-400">© {new Date().getFullYear()} SprintZeroPH. All rights reserved.</p>
        </div>

        {/* ── Right panel – form ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12
                        bg-gray-950 lg:bg-white lg:dark:bg-gray-950">

          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="h-14 w-14 rounded-2xl bg-primary-600 flex items-center justify-center mb-3 shadow-lg">
              <img src="/logo.png" alt="SprintZeroPH" className="h-9 w-9 object-contain" />
            </div>
            <p className="text-white font-bold text-lg">SprintZeroPH</p>
            <p className="text-gray-400 text-xs mt-0.5">Inventory Management</p>
          </div>

          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white lg:text-gray-900 lg:dark:text-white tracking-tight">Welcome back</h1>
              <p className="text-gray-400 lg:text-gray-500 lg:dark:text-gray-400 text-sm mt-1">Sign in to your account to continue</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-900/30 lg:bg-red-50 lg:dark:bg-red-900/20 border border-red-700 lg:border-red-200 lg:dark:border-red-800 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 lg:text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 lg:text-red-600 lg:dark:text-red-400 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 lg:text-gray-700 lg:dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 lg:text-gray-400 pointer-events-none" />
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-700 lg:border-gray-200 lg:dark:border-gray-700
                               bg-gray-900 lg:bg-white lg:dark:bg-gray-800
                               text-white lg:text-gray-900 lg:dark:text-white
                               placeholder-gray-600 lg:placeholder-gray-400 lg:dark:placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               transition-all text-sm"
                    required
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 lg:text-gray-700 lg:dark:text-gray-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotHint(!showForgotHint)}
                    className="text-xs text-primary-400 lg:text-primary-600 lg:dark:text-primary-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                {showForgotHint && (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-blue-700/40 lg:border-blue-200 lg:dark:border-blue-800 bg-blue-900/20 lg:bg-blue-50 lg:dark:bg-blue-900/20 px-3 py-2.5">
                    <Info className="h-3.5 w-3.5 text-blue-400 lg:text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300 lg:text-blue-700 lg:dark:text-blue-300 leading-snug">
                      Please contact your administrator to reset your password.
                    </p>
                  </div>
                )}
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
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
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
                      ? 'bg-primary-600 border-primary-600'
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
                disabled={isLoading || !email || !password}
                className="w-full mt-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                           disabled:opacity-50 disabled:cursor-not-allowed
                           text-white font-semibold text-sm transition-all
                           shadow-lg shadow-primary-900/40"
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
    </>
  );
}
