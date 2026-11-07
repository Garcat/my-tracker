const AUODO_ENDPOINT =
  'https://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList';
const MAX_INPUT_BYTES = 4096;
const MAX_STATE_BYTES = 300 * 1024;
const MAX_INPUTS = 1000;
const MAX_LINE_LENGTH = 200;
const MAX_WAYBILL_LENGTH = 100;

// The page is publicly reachable; all business routes require this session.
const ACCESS_PASSWORD_SHA256 =
  '3e7c3d4cf5be91eca62500b41e292c3474ecc0329156d11f682b609c42828df7';
const SESSION_SECRET =
  'tracker-session-v1-7c1f9a3e5b2d4860a1c3e5f7089b2d4f6a8c0e2';
const SESSION_COOKIE = 'tracker_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AUTH_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 10 * 60 * 1000;

const authAttempts = new Map();
let hmacKeyPromise = null;

function getHmacKey() {
  hmacKeyPromise ??= crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hmacKeyPromise;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(value) {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  );
  return toBase64Url(new Uint8Array(signature));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return '';
}

async function readSession(request) {
  const custom = request.headers.get('x-tracker-token');
  const authorization = request.headers.get('authorization');
  const raw = custom
    ? custom.trim()
    : authorization && authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : readCookie(request, SESSION_COOKIE);
  if (!raw) return null;

  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;

  const expiresAt = Number(parts[1]);
  if (!Number.isInteger(expiresAt) || expiresAt <= Date.now()) return null;

  const expected = await sign(`v1.${expiresAt}`);
  if (!safeEqual(parts[2], expected)) return null;

  return { expiresAt };
}

function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function application({ store, BackendError }) {
  const fail = (code, status) => {
    throw new BackendError(code, status);
  };

  async function readJson(request, maxBytes) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      fail('invalid_input', 400);
    }
    const reader = request.body?.getReader();
    if (!reader) fail('invalid_input', 400);

    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          fail('payload_too_large', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      fail('invalid_input', 400);
    }
  }

  async function loadState() {
    try {
      return await store.read();
    } catch {
      fail('database_unavailable', 503);
    }
  }

  async function requireSession(request) {
    const session = await readSession(request);
    if (!session) fail('auth_required', 401);
  }

  async function handleAuth(request) {
    if (request.method === 'GET') {
      const session = await readSession(request);
      return Response.json(
        {
          authenticated: Boolean(session),
          expiresAt: session ? session.expiresAt : null,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (request.method === 'POST') {
      const key = clientKey(request);
      const now = Date.now();
      const attempt = authAttempts.get(key);
      if (attempt && attempt.resetAt > now && attempt.count >= MAX_AUTH_ATTEMPTS) {
        fail('too_many_attempts', 429);
      }

      const body = await readJson(request, MAX_INPUT_BYTES);
      const password =
        body && typeof body === 'object' && typeof body.password === 'string'
          ? body.password
          : '';
      const digest = await sha256Hex(password);

      if (!safeEqual(digest, ACCESS_PASSWORD_SHA256)) {
        const current = authAttempts.get(key);
        if (!current || current.resetAt <= now) {
          authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
        } else {
          current.count += 1;
        }
        fail('invalid_password', 401);
      }

      authAttempts.delete(key);
      const expiresAt = Date.now() + SESSION_TTL_MS;
      const token = `v1.${expiresAt}.${await sign(`v1.${expiresAt}`)}`;

      return Response.json(
        { success: true, token, expiresAt },
        {
          headers: {
            'Cache-Control': 'no-store',
            'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(
              SESSION_TTL_MS / 1000,
            )}`,
          },
        },
      );
    }

    if (request.method === 'DELETE') {
      return Response.json(
        { success: true },
        {
          headers: {
            'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
          },
        },
      );
    }

    fail('method_not_allowed', 405);
  }

  return async ({ request }) => {
    // The gateway preserves the suffix while replacing the logical function
    // name; the provider may also strip /functions/v1 before invocation.
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(
      /^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/,
    );
    if (!match) fail('not_found', 404);
    const path = match[1] || '/';

    if (match[1] === '/auth') {
      return handleAuth(request);
    }
    await requireSession(request);

    if (path === '/track') {
      if (request.method !== 'POST') fail('method_not_allowed', 405);

      const body = await readJson(request, MAX_INPUT_BYTES);
      const rawCode =
        body && typeof body === 'object' ? body.wayBillCode : undefined;
      const wayBillCode = typeof rawCode === 'string' ? rawCode.trim() : '';
      if (!wayBillCode || wayBillCode.length > MAX_WAYBILL_LENGTH) {
        fail('invalid_input', 400);
      }

      let upstream;
      try {
        upstream = await fetch(AUODO_ENDPOINT, {
          method: 'POST',
          headers: {
            Accept: '/',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ wayBillCode }),
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        fail('upstream_unavailable', 502);
      }

      if (!upstream.ok) {
        await upstream.body?.cancel();
        fail('upstream_unavailable', 502);
      }

      let data;
      try {
        data = await upstream.json();
      } catch {
        fail('upstream_invalid_response', 502);
      }
      return Response.json(data);
    }

    if (path === '/shared-data') {
      if (request.method === 'GET') {
        const state = await loadState();
        return Response.json({
          inputs: state.inputs,
          lastUpdated: state.lastUpdated,
          version: state.version,
          lastTrackingFetchAt: state.lastTrackingFetchAt,
        });
      }

      if (request.method === 'PUT') {
        const body = await readJson(request, MAX_STATE_BYTES);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          fail('invalid_input', 400);
        }

        const hasInputs = Object.prototype.hasOwnProperty.call(body, 'inputs');
        const hasFetchAt = Object.prototype.hasOwnProperty.call(
          body,
          'lastTrackingFetchAt',
        );
        if (!hasInputs && !hasFetchAt) fail('invalid_input', 400);

        let nextInputs;
        if (hasInputs) {
          if (!Array.isArray(body.inputs) || body.inputs.length > MAX_INPUTS) {
            fail('invalid_input', 400);
          }
          for (const line of body.inputs) {
            if (typeof line !== 'string' || line.length > MAX_LINE_LENGTH) {
              fail('invalid_input', 400);
            }
          }
          nextInputs = body.inputs;
        }

        let nextFetchAt;
        if (hasFetchAt) {
          const value = body.lastTrackingFetchAt;
          if (
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < 0
          ) {
            fail('invalid_input', 400);
          }
          nextFetchAt = value;
        }

        const current = await loadState();
        const now = Date.now();
        const next = {
          exists: current.exists,
          inputs: hasInputs ? nextInputs : current.inputs,
          version: current.version + 1,
          lastUpdated: hasInputs ? now : current.lastUpdated,
          lastTrackingFetchAt: hasFetchAt
            ? nextFetchAt
            : current.lastTrackingFetchAt,
        };

        let version;
        try {
          version = await store.write(next);
        } catch {
          fail('database_unavailable', 503);
        }

        return Response.json({ success: true, version });
      }

      fail('method_not_allowed', 405);
    }

    fail('not_found', 404);
  };
}
