import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.JWT_SECRET ?? 'change-this-secret-in-production';

/** Signs a JSON payload and returns  base64url(payload).signature */
export function signSession(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Verifies the signature and returns the parsed payload, or null if tampered */
export function verifySession<T = Record<string, unknown>>(token: string): T | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
    // Constant-time comparison prevents timing attacks
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}
