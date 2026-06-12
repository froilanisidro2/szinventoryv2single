'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getAccessibleWarehouses } from '@/app/actions';

/** Read the stored user ID from sessionStorage or localStorage (matches storeUser logic) */
function getClientUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('user') ?? localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

interface Warehouse {
  id: string;
  code?: number | null;
  name: string;
  address?: string;
  city?: string | null;
  [key: string]: any;
}

interface WarehouseContextValue {
  warehouses: Warehouse[];
  selectedWarehouseId: string; // always a real UUID once warehouses are loaded
  setSelectedWarehouseId: (id: string) => void;
  selectedWarehouse: Warehouse | null;
  isLoading: boolean;
  reload: () => void;
}

const STORAGE_KEY = 'selectedWarehouseId';

const WarehouseContext = createContext<WarehouseContextValue>({
  warehouses: [],
  selectedWarehouseId: '',
  setSelectedWarehouseId: () => {},
  selectedWarehouse: null,
  isLoading: true,
  reload: () => {},
});

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, _setSelectedWarehouseId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const setSelectedWarehouseId = useCallback((id: string) => {
    _setSelectedWarehouseId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Pass the client-side user ID as a fallback in case the session cookie
      // can't be verified (e.g. stale session signed with old secret).
      const clientUserId = getClientUserId();
      const res = await getAccessibleWarehouses(clientUserId ?? undefined);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const list: Warehouse[] = res.data;
        setWarehouses(list);

        // Restore persisted selection only if it still exists in the list
        let stored = '';
        try { stored = localStorage.getItem(STORAGE_KEY) || ''; } catch {}

        const valid = list.find((w) => w.id === stored);
        _setSelectedWarehouseId(valid ? stored : list[0]!.id);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId) ?? null;

  return (
    <WarehouseContext.Provider
      value={{
        warehouses,
        selectedWarehouseId,
        setSelectedWarehouseId,
        selectedWarehouse,
        isLoading,
        reload: load,
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  return useContext(WarehouseContext);
}
