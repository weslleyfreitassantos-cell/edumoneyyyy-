import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';

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
    response.setHeader('access-control-allow-headers', 'accept, content-type, if-match');
    response.setHeader('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.setHeader('access-control-expose-headers', 'location, etag');
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('cache-control', 'no-store');
}

function streamSessionKey(sessionId: string, token: string): string {
  return `${sessionId}:${createHash('sha256').update(token).digest('hex')}`;
}

async function readBody(request: IncomingMessage, maxBytes = 2_000_000): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error('WHEP payload too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

async function isMediaMtxReachable(mediaMtxHlsUrl: string): Promise<boolean> {
  try {
    await fetch(mediaMtxHlsUrl, { method: 'HEAD', signal: AbortSignal.timeout(1_500) });
    return true;
  } catch {
    return false;
  }
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

export function createGatewayServer(runtime: GatewayRuntime, mediaMtxHlsUrl: string, mediaMtxWebrtcUrl = 'http://127.0.0.1:8889') {
  const whepSessions = new Map<string, string>();
  return createServer(async (request, response) => {
    headers(request, response);
    if (request.method === 'OPTIONS') {
      response.statusCode = allowedOrigin(request.headers.origin) ? 204 : 403;
      response.end();
      return;
    }
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      const health = runtime.health();
      json(response, 200, {
        ok: health.gatewayOnline,
        gatewayOnline: health.gatewayOnline,
        relayOnline: health.relayOnline,
        mediaMtxReachable: await isMediaMtxReachable(mediaMtxHlsUrl),
      });
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/status') {
      json(response, 200, runtime.status());
      return;
    }
    const match = requestUrl.pathname.match(/^\/stream\/([^/]+)\/([^/]+)$/);
    if (!match || !['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method ?? '')) {
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
      if (resource === 'whep') {
        if (request.method === 'GET') {
          json(response, 405, { error: 'WHEP requer uma negociacao WebRTC.' });
          return;
        }
        const key = streamSessionKey(sessionId, token);
        const baseUrl = `${mediaMtxWebrtcUrl.replace(/\/$/, '')}/${runtime.getCameraStreamPath(session)}/whep`;
        const storedLocation = whepSessions.get(key);
        const upstreamUrl = request.method === 'POST' ? baseUrl : (storedLocation ?? baseUrl);
        const body = request.method === 'POST' || request.method === 'PATCH' ? await readBody(request) : undefined;
        const upstream = await fetch(upstreamUrl, {
          method: request.method,
          headers: {
            accept: request.headers.accept ?? 'application/sdp',
            ...(request.headers['content-type'] ? { 'content-type': request.headers['content-type'] } : {}),
            ...(request.headers['if-match'] ? { 'if-match': request.headers['if-match'] } : {}),
          },
          body,
        });
        const location = upstream.headers.get('location');
        if (request.method === 'POST' && upstream.ok) {
          whepSessions.set(key, location ? new URL(location, upstreamUrl).toString() : upstreamUrl);
          response.setHeader('location', `/stream/${encodeURIComponent(sessionId)}/whep?token=${encodeURIComponent(token)}`);
        } else if (location) {
          response.setHeader('location', `/stream/${encodeURIComponent(sessionId)}/whep?token=${encodeURIComponent(token)}`);
        }
        const contentType = upstream.headers.get('content-type');
        if (contentType) response.setHeader('content-type', contentType);
        const etag = upstream.headers.get('etag');
        if (etag) response.setHeader('etag', etag);
        response.statusCode = upstream.status;
        response.end(Buffer.from(await upstream.arrayBuffer()));
        if (request.method === 'DELETE') whepSessions.delete(key);
        return;
      }
      if (request.method !== 'GET') {
        json(response, 405, { error: 'Metodo nao permitido.' });
        return;
      }
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
