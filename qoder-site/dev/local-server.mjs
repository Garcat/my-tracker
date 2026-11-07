import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { application } from '../functions/routes.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(projectRoot, 'out');
const port = Number(process.env.PORT || 4173);

class BackendError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

let state = {
  inputs: [],
  version: 0,
  lastUpdated: Date.now(),
  lastTrackingFetchAt: null,
};

const store = {
  async read() {
    return structuredClone(state);
  },
  async write(next) {
    state = structuredClone(next);
    return next.version;
  },
};

const handle = application({ store, BackendError });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function headersObject(raw) {
  const headers = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return headers;
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

async function serveFunction(request, response) {
  const body = await readBody(request);
  const webRequest = new Request(`http://127.0.0.1${request.url}`, {
    method: request.method,
    headers: headersObject(request.headers),
    body,
  });

  let webResponse;
  try {
    webResponse = await handle({ request: webRequest });
  } catch (error) {
    webResponse = Response.json(
      { error: error?.code ?? 'error' },
      { status: error?.status ?? 500 },
    );
  }

  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => response.setHeader(key, value));
  const buffer = Buffer.from(await webResponse.arrayBuffer());
  response.end(buffer);
}

async function serveStatic(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/track') pathname = '/track.html';

  const filePath = path.resolve(outDir, `.${pathname}`);
  if (!filePath.startsWith(outDir + path.sep)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    const content = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader('Content-Type', MIME[path.extname(filePath)] ?? 'application/octet-stream');
    response.end(content);
  } catch {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/functions/v1/app')) {
      await serveFunction(request, response);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    response.statusCode = 500;
    response.end('Internal error');
    console.error(error);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local preview: http://127.0.0.1:${port}/`);
});
