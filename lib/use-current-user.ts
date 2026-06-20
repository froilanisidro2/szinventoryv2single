'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser } from './auth-utils';
import type { AuthUser } from './auth-utils';

/**
 * SSR-safe hook for reading the current user.
 * Returns null on the server and during first hydration, then resolves
 * from sessionStorage/localStorage on the client — preventing hydration mismatches
 * caused by auth-gated UI (buttons, menus, etc.) that differ between server and client.
 */
export function useCurrentUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    setUser(getCurrentUser());
  }, []);
  return user;
}
