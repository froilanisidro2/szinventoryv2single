'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getUserType } from '@/lib/auth-utils';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'superadmin' | 'admin' | 'user' | 'any';
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole = 'any',
  redirectTo,
}: ProtectedRouteProps) {
  const router = useRouter();
  const user = getCurrentUser();
  const userType = getUserType();

  useEffect(() => {
    // Check if user exists
    if (!user) {
      toast.error('Please log in first');
      router.push('/auth/login');
      return;
    }

    // Check role access
    let hasAccess = false;

    switch (requiredRole) {
      case 'superadmin':
        hasAccess = userType.isSuperAdmin;
        break;
      case 'admin':
        hasAccess = userType.isCompanyAdmin || userType.isSuperAdmin;
        break;
      case 'user':
        hasAccess = userType.isRegularUser;
        break;
      case 'any':
        hasAccess = true;
        break;
      default:
        hasAccess = false;
    }

    if (!hasAccess) {
      toast.error('You do not have permission to access this page');
      router.push(redirectTo || '/dashboard');
    }
  }, [user, userType, requiredRole, redirectTo, router]);

  // Return null while checking auth
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
