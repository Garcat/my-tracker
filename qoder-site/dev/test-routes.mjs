import { application } from '../functions/routes.mjs';

class BackendError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function memoryStore(initial) {
  let state = initial ?? {
    inputs: [],
    version: 0,
    lastUpdated: Date.now(),
    lastTrackingFetchAt: null,
  };
  return {
    async read() {
      return structuredClone(state);
    },
    async write(next) {
      state = structuredClone(next);
      return next.version;
    },
  };
}

const handle = application({ store: memoryStore(), BackendError });

async function call(method, path, body, headers) {
  const request = new Request(`http://127.0.0.1${path}`, {
    method,
    headers:
      headers ??
      (body !== undefined ? { 'content-type': 'application/json' } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  try {
    const response = await handle({ request });
    return { status: response.status, body: await response.json() };
  } catch (error) {
    return {
      status: error.status ?? 500,
      body: { error: error.code ?? 'error' },
    };
  }
}

const failures = [];
function check(name, condition, detail) {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures.push(name);
    console.error(`not ok - ${name}`, detail ?? '');
  }
}

const unauthorized = await call('GET', '/functions/v1/app/shared-data');
check('shared-data requires session', unauthorized.status === 401, unauthorized);

const authStatus = await call('GET', '/functions/v1/app/auth');
check(
  'auth reports unauthenticated',
  authStatus.status === 200 && authStatus.body.authenticated === false,
  authStatus,
);

const wrongPassword = await call('POST', '/functions/v1/app/auth', {
  password: '0000',
});
check('wrong password rejected', wrongPassword.status === 401, wrongPassword);

const login = await call('POST', '/functions/v1/app/auth', { password: '4343' });
check(
  'password login issues token',
  login.status === 200 &&
    typeof login.body.token === 'string' &&
    Number.isFinite(login.body.expiresAt) &&
    login.body.expiresAt > Date.now(),
  { status: login.status, keys: Object.keys(login.body ?? {}) },
);
const token = login.body.token;
const authorized = { 'x-tracker-token': token };
const jsonAuthorized = { 'content-type': 'application/json', ...authorized };

const authWithToken = await call('GET', '/functions/v1/app/auth', undefined, authorized);
check(
  'auth reports authenticated with token',
  authWithToken.status === 200 && authWithToken.body.authenticated === true,
  authWithToken,
);

const tampered = await call('GET', '/functions/v1/app/shared-data', undefined, {
  'x-tracker-token': `${token.slice(0, -2)}xx`,
});
check('tampered token rejected', tampered.status === 401, tampered);

const bearerFallback = await call('GET', '/functions/v1/app/shared-data', undefined, {
  authorization: `Bearer ${token}`,
});
check('bearer header accepted', bearerFallback.status === 200, bearerFallback);

const empty = await call('GET', '/functions/v1/app/shared-data', undefined, authorized);
check('GET empty shared state', empty.status === 200 && Array.isArray(empty.body.inputs), empty);

const saved = await call(
  'PUT',
  '/functions/v1/app/shared-data',
  { inputs: ['TEST001', 'TEST002'] },
  jsonAuthorized,
);
check('PUT inputs', saved.status === 200 && saved.body.version === 1, saved);

const loaded = await call('GET', '/functions/v1/app/shared-data', undefined, authorized);
check(
  'GET returns saved inputs',
  loaded.status === 200 &&
    loaded.body.inputs.length === 2 &&
    loaded.body.inputs[0] === 'TEST001',
  loaded,
);

const fetchAt = 1762460000000;
const savedFetchAt = await call(
  'PUT',
  '/functions/v1/app/shared-data',
  { lastTrackingFetchAt: fetchAt },
  jsonAuthorized,
);
check(
  'PUT lastTrackingFetchAt',
  savedFetchAt.status === 200 && savedFetchAt.body.version === 2,
  savedFetchAt,
);

const afterFetchAt = await call('GET', '/functions/v1/app/shared-data', undefined, authorized);
check(
  'lastTrackingFetchAt preserved with inputs',
  afterFetchAt.status === 200 &&
    afterFetchAt.body.lastTrackingFetchAt === fetchAt &&
    afterFetchAt.body.inputs.length === 2,
  afterFetchAt,
);

const invalid = await call(
  'PUT',
  '/functions/v1/app/shared-data',
  { inputs: 'not-an-array' },
  jsonAuthorized,
);
check('rejects invalid inputs', invalid.status === 400, invalid);

const wrongMethod = await call('GET', '/functions/v1/app/track', undefined, authorized);
check('rejects wrong method', wrongMethod.status === 405, wrongMethod);

const invalidTrack = await call('POST', '/functions/v1/app/track', {}, jsonAuthorized);
check('rejects missing wayBillCode', invalidTrack.status === 400, invalidTrack);

const unknown = await call('GET', '/functions/v1/app/unknown', undefined, authorized);
check('unknown route is 404', unknown.status === 404, unknown);

const throttledKey = {
  'content-type': 'application/json',
  'x-forwarded-for': '203.0.113.77',
};
let throttledStatus = 0;
for (let i = 0; i < 11; i += 1) {
  const attempt = await call('POST', '/functions/v1/app/auth', { password: '9999' }, throttledKey);
  throttledStatus = attempt.status;
}
check('throttles repeated wrong passwords', throttledStatus === 429, { throttledStatus });

if (process.env.RUN_NETWORK === '1' && process.env.TEST_WAYBILL) {
  const network = await call(
    'POST',
    '/functions/v1/app/track',
    { wayBillCode: process.env.TEST_WAYBILL },
    jsonAuthorized,
  );
  check(
    'upstream proxy responds',
    network.status === 200 &&
      (typeof network.body?.result === 'boolean' ||
        typeof network.body?.msg === 'string'),
    { status: network.status, keys: Object.keys(network.body ?? {}) },
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
