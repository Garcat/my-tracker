/**
 * 访问密码会话。
 * Function 端校验密码并签发带过期时间的 HMAC 令牌；
 * 业务接口（track / shared-data）全部要求该令牌。
 */

const AUTH_ENDPOINT = '/functions/v1/app/auth';
const TOKEN_KEY = 'tracker-session-token';

interface StoredSession {
  token: string;
  expiresAt: number;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown };
    if (
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt > Date.now()
    ) {
      return { token: parsed.token, expiresAt: parsed.expiresAt };
    }
    localStorage.removeItem(TOKEN_KEY);
    return null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  return readStoredSession()?.token ?? null;
}

function saveSession(token: string, expiresAt: number): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // ignore storage failures
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { 'X-Tracker-Token': token } : {};
}

/** 页面加载时确认本地令牌仍然有效 */
export async function checkSession(): Promise<boolean> {
  if (!getSessionToken()) return false;
  try {
    const response = await fetch(AUTH_ENDPOINT, {
      headers: { Accept: 'application/json', ...authHeaders() },
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { authenticated?: unknown };
    if (data.authenticated === true) return true;
    clearSession();
    return false;
  } catch {
    return false;
  }
}

export type LoginResult =
  | { ok: true }
  | { ok: false; status: number };

export async function login(password: string): Promise<LoginResult> {
  try {
    const response = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const data = (await response.json()) as {
      token?: unknown;
      expiresAt?: unknown;
    };
    if (typeof data.token === 'string' && typeof data.expiresAt === 'number') {
      saveSession(data.token, data.expiresAt);
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}
