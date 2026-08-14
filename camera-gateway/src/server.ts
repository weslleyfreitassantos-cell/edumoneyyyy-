import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { GatewayRuntime } from './runtime.ts';

function allowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  const configured = (process.env.CAMERA_GATEWAY_ALLOWED_ORIGINS ?? 'http://127.0.0.1:3000,http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : null;
}

function headers(request: IncomingMessage, response: ServerResponse): void {
  const origin = allowedOrigin(request.headers.origin);
  if (origin) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-allow-headers', 'content-type');
    response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('cache-control', 'no-store');
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

function safeResource(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded || decoded.includes('..') || decoded.includes('/') || !/^[a-zA-Z0-9_.-]+$/.test(decoded)) return null;
  return decoded;
}

function rewriteManifest(manifest: string, sessionId: string, token: string): string {
  const encodedSession = encodeURIComponent(sessionId);
  const encodedToken = encodeURIComponent(token);
  return manifest.split(/\r?\n/).map((line) => {
    if (!line || line.startsWith('#EXT-X-KEY')) return line;
    const withMap = line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="/stream/${encodedSession}/${encodeURIComponent(uri)}?token=${encodedToken}"`);
    if (withMap !== line) return withMap;
    if (line.startsWith('#')) return line;
    return `/stream/${encodedSession}/${encodeURIComponent(line)}?token=${encodedToken}`;
  }).join('\n');
}

const UPSTREAM_RETRY_ATTEMPTS = 40;
const UPSTREAM_RETRY_DELAY_MS = 250;

async function fetchUpstreamWithRetry(url: string): Promise<Response> {
  const retryableStatuses = new Set([404, 502, 503, 504]);
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < UPSTREAM_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const upstream = await fetch(url);
      if (upstream.ok || !retryableStatuses.has(upstream.status) || attempt === UPSTREAM_RETRY_ATTEMPTS - 1) return upstream;
      lastResponse = upstream;
    } catch (error) {
      if (attempt === UPSTREAM_RETRY_ATTEMPTS - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, UPSTREAM_RETRY_DELAY_MS));
  }

  return lastResponse ?? new Response(null, { status: 502 });
}

export function createGatewayServer(runtime: GatewayRuntime, mediaMtxHlsUrl: string) {
  return createServer(async (request, response) => {
    headers(request, response);
    if (request.method === 'OPTIONS') {
      response.statusCode = allowedOrigin(request.headers.origin) ? 204 : 403;
      response.end();
      return;
    }
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      json(response, 200, { ok: true, status: runtime.status() });
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/status') {
      json(response, 200, runtime.status());
      return;
    }
    const match = requestUrl.pathname.match(/^\/stream\/([^/]+)\/([^/]+)$/);
    if (request.method !== 'GET' || !match) {
      json(response, 404, { error: 'Rota nao encontrada.' });
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    const resource = safeResource(match[2]);
    const token = requestUrl.searchParams.get('token');
    if (!resource || !token || token.length > 256) {
      json(response, 400, { error: 'Sessao invalida.' });
      return;
    }
    try {
      const session = await runtime.authorizeStream(sessionId, token);
      const streamPath = runtime.getCameraStreamPath(session);
      const upstream = await fetchUpstreamWithRetry(`${mediaMtxHlsUrl.replace(/\/$/, '')}/${streamPath}/${resource}`);
      if (!upstream.ok) {
        json(response, 502, { error: 'Stream local indisponivel.' });
        return;
      }
      const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
      response.statusCode = 200;
      response.setHeader('content-type', contentType);
      if (resource.endsWith('.m3u8')) {
        response.end(rewriteManifest(await upstream.text(), sessionId, token));
      } else {
        response.end(Buffer.from(await upstream.arrayBuffer()));
      }
    } catch {
      json(response, 403, { error: 'Sessao de stream recusada.' });
    }
  });
}
