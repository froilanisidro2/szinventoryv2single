/** Pad a numeric code to 4 digits: 1 → "0001" */
export function fmtCode(code?: number | null): string | null {
  return code != null ? String(code).padStart(4, '0') : null;
}

export interface WarehouseLike {
  code?: number | null;
  name: string;
  city?: string | null;
}

/** Returns "0001 · Main" or just "Main" when code is absent. */
export function fmtWarehouse(w?: WarehouseLike | null): string {
  if (!w) return '';
  const c = fmtCode(w.code);
  return c ? `${c} · ${w.name}` : w.name;
}

/** Same as fmtWarehouse but appends city: "0001 · Main — Cavite" */
export function fmtWarehouseWithCity(w?: WarehouseLike | null): string {
  if (!w) return '';
  const base = fmtWarehouse(w);
  return w.city ? `${base} — ${w.city}` : base;
}

export interface SupplierLike {
  code?: number | null;
  name: string;
}

/** Returns "0001 · Supplier 1" or just "Supplier 1" when code is absent. */
export function fmtSupplier(s?: SupplierLike | null): string {
  if (!s) return '';
  const c = fmtCode(s.code);
  return c ? `${c} · ${s.name}` : s.name;
}

export interface UserLike {
  code?: number | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/** Returns "0001 · John Doe" or just "John Doe" when code is absent. */
export function fmtUser(u?: UserLike | null): string {
  if (!u) return '';
  const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '';
  const c = fmtCode(u.code);
  return c ? `${c} · ${name}` : name;
}
