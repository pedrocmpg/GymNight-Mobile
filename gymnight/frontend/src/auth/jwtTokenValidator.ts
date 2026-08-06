import type { TokenValidator } from './AuthManager';

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = globalThis.atob
    ? globalThis.atob(padded)
    : Buffer.from(padded, 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < binary.length; i++) {
    result += `%${binary.charCodeAt(i).toString(16).padStart(2, '0')}`;
  }
  return decodeURIComponent(result);
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = base64UrlDecode(payloadB64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * No JWT-decoding library is required — only the backend verifies signatures
 * (SUPABASE_JWT_SECRET); this client-side check only needs the exp claim.
 */
export const jwtTokenValidator: TokenValidator = {
  isExpired(accessToken: string): boolean {
    const payload = decodeJwtPayload(accessToken);
    const exp = payload?.exp;
    if (typeof exp !== 'number') return true;
    return Math.floor(Date.now() / 1000) >= exp;
  },
};
