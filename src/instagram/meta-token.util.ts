const FB_USER_TOKEN = /^EAA[A-Za-z0-9]+$/;
const IG_LOGIN_TOKEN = /^IG[A-Za-z0-9]+$/;

export type TokenFormat = 'FACEBOOK_GRAPH' | 'INSTAGRAM_LOGIN' | 'UNKNOWN';

export function sanitizeAccessToken(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}

export function describeTokenFormat(token: string): TokenFormat {
  if (FB_USER_TOKEN.test(token)) return 'FACEBOOK_GRAPH';
  if (IG_LOGIN_TOKEN.test(token)) return 'INSTAGRAM_LOGIN';
  return 'UNKNOWN';
}

export function assertUsableAccessToken(token: string): TokenFormat {
  const kind = describeTokenFormat(token);
  if (kind === 'UNKNOWN' || token.length < 50) {
    throw new Error(
      'Access token looks malformed or truncated. Paste the full token from Meta Developer Console.',
    );
  }
  return kind;
}

/** @deprecated use assertUsableAccessToken */
export function assertGraphApiToken(token: string): void {
  const kind = assertUsableAccessToken(token);
  if (kind === 'INSTAGRAM_LOGIN') return;
}

export function extractMetaAxiosError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: unknown } }).response?.data ===
      'object'
  ) {
    const data = (
      error as {
        response: { data: { error?: { message?: string; code?: number } } };
      }
    ).response.data;
    const msg = data.error?.message;
    const code = data.error?.code;
    if (msg) return code ? `${msg} (code=${code})` : msg;
  }
  return error instanceof Error ? error.message : String(error);
}

export function expiresAtFromExpiresIn(expiresInSec: number): number {
  return Math.floor(Date.now() / 1000) + expiresInSec;
}
