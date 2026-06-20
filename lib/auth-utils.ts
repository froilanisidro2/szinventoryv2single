/**
 * Client-side auth utilities for role/permission checking
 * Used for route protection and navigation decisions
 */

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  isCompanyAdmin: boolean;
  isSuperAdminCompany: boolean;
  role: string;
  permissions: string[];
}

export interface UserType {
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  isRegularUser: boolean;
}

/**
 * Get current user — checks sessionStorage first (session login), then localStorage (remembered login)
 */
export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  const userStr = sessionStorage.getItem('user') ?? localStorage.getItem('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Get super admin session — checks sessionStorage first, then localStorage
 */
export function getSuperAdminSession() {
  if (typeof window === 'undefined') return null;

  const sessionStr = sessionStorage.getItem('superadmin_session') ?? localStorage.getItem('superadmin_session');
  if (!sessionStr) return null;

  try {
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

/**
 * Get user type based on company and user flags
 */
export function getUserType(): UserType {
  // Check super admin session first
  const superAdminSession = getSuperAdminSession();
  if (superAdminSession?.isSuperAdmin) {
    return {
      isSuperAdmin: true,
      isCompanyAdmin: false,
      isRegularUser: false,
    };
  }

  const user = getCurrentUser();
  
  if (!user) {
    return {
      isSuperAdmin: false,
      isCompanyAdmin: false,
      isRegularUser: false,
    };
  }

  return {
    isSuperAdmin: false, // Super admins use superadmin_session, not regular user session
    isCompanyAdmin: user.isCompanyAdmin,      // User is admin for their company
    isRegularUser: !user.isCompanyAdmin,      // Regular user
  };
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(): boolean {
  return getUserType().isSuperAdmin;
}

/**
 * Check if user is company admin
 */
export function isCompanyAdmin(): boolean {
  return getUserType().isCompanyAdmin;
}

/**
 * Check if user is regular user
 */
export function isRegularUser(): boolean {
  return getUserType().isRegularUser;
}

/**
 * Get portal path based on user type
 */
export function getPortalPath(): string {
  // Check super admin session first
  const superAdminSession = getSuperAdminSession();
  if (superAdminSession?.isSuperAdmin) {
    return '/superadmin';
  }

  const userType = getUserType();
  
  if (userType.isSuperAdmin) {
    return '/superadmin';
  } else if (userType.isCompanyAdmin) {
    // Company admins use the regular dashboard/inventory system
    return '/dashboard';
  } else if (userType.isRegularUser) {
    return '/dashboard';
  }
  
  return '/auth/login';
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(pathname: string): boolean {
  // Check super admin session
  const superAdminSession = getSuperAdminSession();
  if (superAdminSession?.isSuperAdmin) {
    // Super admins can only access superadmin routes
    return pathname.startsWith('/superadmin');
  }

  const user = getCurrentUser();
  if (!user) {
    // Only allow auth routes for unauthenticated users
    return pathname.startsWith('/auth');
  }

  const isAdmin = user.isCompanyAdmin;
  const perms: string[] = user.permissions || [];
  const hasPerm = (p: string) => isAdmin || perms.includes('all') || perms.includes(p);

  // Routes always accessible when authenticated
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/profile')) return true;

  // Settings — admin or users with settings:write permission
  if (pathname.startsWith('/settings')) return isAdmin || hasPerm('settings:write');

  // Permission-gated routes
  if (pathname.startsWith('/inventory') || pathname.startsWith('/products')) return hasPerm('inventory:read');
  if (pathname.startsWith('/purchase-orders') || pathname.startsWith('/stock-transfers') || pathname.startsWith('/suppliers')) return hasPerm('inventory:write');
  if (pathname.startsWith('/sales-orders') || pathname.startsWith('/invoices') || pathname.startsWith('/customers')) return hasPerm('invoices:read');
  if (pathname.startsWith('/payments')) return hasPerm('payments:read');
  if (pathname.startsWith('/reports')) return hasPerm('reports:read');

  // Production workflow routes
  if (
    pathname.startsWith('/material-requests') ||
    pathname.startsWith('/job-orders') ||
    pathname.startsWith('/material-issue-slips') ||
    pathname.startsWith('/material-return-slips')
  ) return hasPerm('inventory:write');

  return false;
}

/**
 * Check if the current user has a specific permission.
 * Users with "all" permission (admin) pass every check.
 */
export function hasPermission(permission: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.isCompanyAdmin) return true;
  const perms = user.permissions || [];
  return perms.includes('all') || perms.includes(permission);
}

/**
 * Logout user — clears both localStorage and sessionStorage
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    const keys = ['user', 'companyId', 'superadmin_session'];
    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // Call server action to clear authentication cookie
    // Use dynamic import to avoid circular dependency
    import('@/app/actions').then(({ logoutUser }) => {
      logoutUser().catch(err => console.error('[AUTH] Failed to clear server cookie:', err));
    }).finally(() => {
      // Redirect to login page
      window.location.href = '/auth/login';
    });
  }
}

/**
 * Store user from login response.
 * rememberMe = true  → localStorage  (persists across browser restarts)
 * rememberMe = false → sessionStorage (cleared when browser closes)
 */
export function storeUser(user: AuthUser, rememberMe = false): void {
  if (typeof window !== 'undefined') {
    const target = rememberMe ? localStorage : sessionStorage;
    const other  = rememberMe ? sessionStorage : localStorage;

    target.setItem('user', JSON.stringify(user));
    target.setItem('companyId', user.companyId);

    // Remove stale entry from the other storage to avoid conflicts
    other.removeItem('user');
    other.removeItem('companyId');
  }
}
