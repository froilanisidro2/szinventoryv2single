'use client';

import { useEffect, useState } from 'react';

interface LoginSplashProps {
  userName: string;
  onDone: () => void;
}

export function LoginSplash({ userName, onDone }: LoginSplashProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Hold for 1.8s, then start exit animation, then call onDone
    const exitTimer = setTimeout(() => setExiting(true), 1800);
    const doneTimer = setTimeout(() => onDone(), 2300);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center
        bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800
        ${exiting ? 'splash-exit' : 'splash-enter'}`}
    >
      {/* Background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/5" />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-6 text-center px-8">

        {/* Logo */}
        <div className="logo-pop">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-white/20 blur-xl scale-110" />
            <img
              src="/logo.png"
              alt="SprintZeroPH"
              className="relative h-28 w-28 rounded-3xl object-contain bg-white/10 p-3 shadow-2xl"
            />
          </div>
        </div>

        {/* Brand + welcome */}
        <div className="text-rise flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            SprintZeroPH
          </h1>
          <p className="text-primary-200 text-base font-medium">
            Inventory Management System
          </p>
          <div className="mt-3 px-5 py-2 rounded-full bg-white/15 backdrop-blur-sm">
            <p className="text-white text-sm font-semibold">
              Welcome back, {userName}! 👋
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 rounded-full bg-white/20 overflow-hidden mt-2">
          <div className="h-full rounded-full bg-white bar-fill" />
        </div>

        <p className="text-primary-300 text-xs">Loading your workspace…</p>
      </div>
    </div>
  );
}
