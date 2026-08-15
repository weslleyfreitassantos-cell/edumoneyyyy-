import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type Action = "pair" | "heartbeat" | "relay_heartbeat" | "provision_relay" | "sync" | "redeem_stream_session";
type JsonRecord = Record<string, unknown>;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) throw new Error("Camera gateway function is not configured.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function response(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(status: number, code: string, message: string): Response {
  return response({ success: false, code, message }, status);
}

function requestId(): string {
  return crypto.randomUUID();
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function textField(body: JsonRecord, key: string, maxLength: number): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength
    ? value.trim()
    : null;
}

function uuidField(body: JsonRecord, key: string): string | null {
  const value = textField(body, key, 64);
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function timestampField(body: JsonRecord, key: string): string | null {
  const value = textField(body, key, 64);
  if (!value || !value.endsWith("Z")) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? value : null;
}

function localUrlField(body: JsonRecord, key: string): string | null {
  const value = textField(body, key, 253);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const octets = hostname.split('.').map(Number);
    const privateIpv4 = octets.length === 4
      && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
      && (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168));
    const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || privateIpv4 || hostname.endsWith('.local');
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !localHost) return null;
    return value.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function relayUrlField(body: JsonRecord, key: string): string | null {
  const value = textField(body, key, 253);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
      || !/^gw-[0-9a-f]{16}\.cameras\.grupotec\.dev\.br$/i.test(hostname)) return null;
    return value.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function actionField(body: JsonRecord): Action | null {
  const value = body.action;
  return value === "pair" || value === "heartbeat" || value === "relay_heartbeat" || value === "provision_relay" || value === "sync" || value === "redeem_stream_session"
    ? value
    : null;
}

function cloudflareConfig(): { accountId: string; zoneId: string; apiToken: string } {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const zoneId = Deno.env.get("CLOUDFLARE_ZONE_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!accountId || !zoneId || !apiToken) throw new Error("Cloudflare relay is not configured.");
  return { accountId, zoneId, apiToken };
}

async function cloudflareRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const { apiToken } = cloudflareConfig();
  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("authorization", `Bearer ${apiToken}`);
  requestHeaders.set("content-type", "application/json");
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: requestHeaders,
  });
  let body: JsonRecord;
  try {
    body = await response.json() as JsonRecord;
  } catch {
    throw new Error("Cloudflare relay returned invalid response.");
  }
  if (!response.ok || body.success !== true || body.result === undefined) {
    throw new Error("Cloudflare relay request failed.");
  }
  return body.result;
}

function tunnelSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function ensureRelayDns(zoneId: string, hostname: string, tunnelId: string): Promise<void> {
  const existing = await cloudflareRequest(`/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`);
  const records = Array.isArray(existing) ? existing : [];
  const payload = JSON.stringify({
    type: "CNAME",
    name: hostname,
    content: `${tunnelId}.cfargotunnel.com`,
    proxied: true,
    ttl: 1,
  });
  if (records.length > 0 && records[0] && typeof records[0] === "object" && typeof (records[0] as JsonRecord).id === "string") {
    await cloudflareRequest(`/zones/${zoneId}/dns_records/${(records[0] as JsonRecord).id}`, { method: "PUT", body: payload });
    return;
  }
  await cloudflareRequest(`/zones/${zoneId}/dns_records`, { method: "POST", body: payload });
}

async function provisionRelay(
  gatewayId: string,
  gatewayToken: string,
  requestId: string,
  requestExpiresAt: string,
): Promise<Response> {
  const identityResult = await admin.rpc("get_camera_gateway_relay_identity", {
    target_gateway_id: gatewayId,
    target_gateway_token: gatewayToken,
    target_request_id: requestId,
    target_request_expires_at: requestExpiresAt,
  });
  if (identityResult.error) return errorResponse(401, "RELAY_REJECTED", "Gateway nao autorizado.");
  const identity = Array.isArray(identityResult.data) ? identityResult.data[0] as JsonRecord | undefined : undefined;
  if (!identity?.public_id || !identity.relay_hostname) return errorResponse(403, "RELAY_REJECTED", "Identidade do relay indisponivel.");

  const { accountId, zoneId } = cloudflareConfig();
  let tunnelId = typeof identity.tunnel_id === "string" ? identity.tunnel_id : null;
  if (!tunnelId) {
    const created = await cloudflareRequest(`/accounts/${accountId}/cfd_tunnel`, {
      method: "POST",
      body: JSON.stringify({
        name: `edumanager-${identity.public_id}`,
        config_src: "cloudflare",
        tunnel_secret: tunnelSecret(),
      }),
    });
    if (!created || typeof created !== "object" || typeof (created as JsonRecord).id !== "string") {
      throw new Error("Cloudflare tunnel response is invalid.");
    }
    tunnelId = (created as JsonRecord).id as string;
  }

  const hostname = String(identity.relay_hostname).toLowerCase();
  const relayBaseUrl = `https://${hostname}`;
  await cloudflareRequest(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    method: "PUT",
    body: JSON.stringify({ config: { ingress: [
      { hostname, path: "/health", service: "http://127.0.0.1:8787" },
      { hostname, path: "/stream/.*", service: "http://127.0.0.1:8787" },
      { service: "http_status:404" },
    ] } }),
  });
  await ensureRelayDns(zoneId, hostname, tunnelId);
  const tokenResult = await cloudflareRequest(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
  if (typeof tokenResult !== "string" || tokenResult.length < 32) throw new Error("Cloudflare tunnel token is invalid.");

  const saved = await admin.rpc("save_camera_gateway_relay", {
    target_gateway_id: gatewayId,
    target_gateway_token: gatewayToken,
    target_tunnel_id: tunnelId,
    target_relay_base_url: relayBaseUrl,
    target_request_id: crypto.randomUUID(),
    target_request_expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (saved.error) throw saved.error;
  return response({ success: true, relay_base_url: relayBaseUrl, tunnel_id: tunnelId, tunnel_token: tokenResult });
}

async function run(request: Request): Promise<Response> {
  if (request.method !== "POST") return errorResponse(405, "METHOD_NOT_ALLOWED", "Metodo nao permitido.");

  let body: JsonRecord;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as JsonRecord;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Corpo da requisicao invalido.");
  }

  const action = actionField(body);
  if (!action) return errorResponse(400, "INVALID_ACTION", "Acao de gateway invalida.");
  const id = requestId();

  try {
    if (action === "pair") {
      const pairingCode = textField(body, "pairing_code", 64);
      const localBaseUrl = localUrlField(body, "local_base_url");
      if (!pairingCode || !localBaseUrl) return errorResponse(400, "INVALID_PAYLOAD", "Codigo ou URL local invalida.");
      const { data, error } = await admin.rpc("pair_camera_gateway_runtime", {
        target_pairing_code: pairingCode,
        gateway_local_url: localBaseUrl,
      });
      if (error) {
        if (error.code === "42501") return errorResponse(403, "PAIRING_REJECTED", "Codigo de pareamento invalido ou expirado.");
        if (error.code === "22023") return errorResponse(400, "INVALID_PAYLOAD", "Codigo ou URL local invalida.");
        throw error;
      }
      const paired = Array.isArray(data) ? data[0] as JsonRecord | undefined : undefined;
      if (!paired?.gateway_id || !paired.institution_id || !paired.gateway_token) {
        return errorResponse(403, "PAIRING_REJECTED", "Codigo de pareamento invalido ou expirado.");
      }
      return response({
        success: true,
        gateway_id: paired.gateway_id,
        institution_id: paired.institution_id,
        gateway_token: paired.gateway_token,
        local_base_url: paired.local_base_url ?? localBaseUrl,
        paired_at: paired.paired_at ?? new Date().toISOString(),
      });
    }

    const gatewayToken = bearer(request);
    const gatewayId = uuidField(body, "gateway_id");
    if (!gatewayToken || !gatewayId) return errorResponse(401, "UNAUTHENTICATED", "Token ou gateway invalido.");
    const requestNonce = uuidField(body, "request_id");
    const requestExpiresAt = timestampField(body, "expires_at");
    if (!requestNonce || !requestExpiresAt) return errorResponse(400, "INVALID_PAYLOAD", "Requisicao de gateway invalida.");

    if (action === "provision_relay") {
      try {
        return await provisionRelay(gatewayId, gatewayToken, requestNonce, requestExpiresAt);
      } catch {
        console.error(JSON.stringify({ request_id: id, action, code: "RELAY_PROVISION_FAILED" }));
        return errorResponse(502, "RELAY_PROVISION_FAILED", "Nao foi possivel preparar o relay HTTPS agora.");
      }
    }

    if (action === "heartbeat") {
      const { error } = await admin.rpc("heartbeat_camera_gateway_runtime", {
        target_gateway_id: gatewayId,
        target_gateway_token: gatewayToken,
        target_request_id: requestNonce,
        target_request_expires_at: requestExpiresAt,
      });
      if (error) return errorResponse(401, "GATEWAY_REJECTED", "Gateway nao autorizado.");
      return response({ success: true });
    }

    if (action === "relay_heartbeat") {
      const relayBaseUrl = relayUrlField(body, "relay_base_url");
      if (!relayBaseUrl) return errorResponse(400, "RELAY_INVALID", "URL do relay HTTPS invalida.");
      const { error } = await admin.rpc("register_camera_gateway_relay", {
        target_gateway_id: gatewayId,
        target_gateway_token: gatewayToken,
        target_relay_base_url: relayBaseUrl,
        target_request_id: requestNonce,
        target_request_expires_at: requestExpiresAt,
      });
      if (error) {
        if (error.code === "22023") return errorResponse(400, "RELAY_INVALID", "URL do relay HTTPS invalida.");
        return errorResponse(401, "RELAY_REJECTED", "O relay HTTPS nao esta autorizado.");
      }
      return response({ success: true, relay_base_url: relayBaseUrl });
    }

    if (action === "sync") {
      const { data, error } = await admin.rpc("sync_camera_gateway_runtime", {
        target_gateway_id: gatewayId,
        target_gateway_token: gatewayToken,
        target_request_id: requestNonce,
        target_request_expires_at: requestExpiresAt,
      });
      if (error) return errorResponse(401, "GATEWAY_REJECTED", "Gateway nao autorizado.");
      return response({ success: true, cameras: data ?? [] });
    }

    const sessionId = uuidField(body, "session_id");
    const sessionToken = textField(body, "session_token", 256);
    if (!sessionId || !sessionToken) return errorResponse(400, "INVALID_PAYLOAD", "Sessao invalida.");
    const { data, error } = await admin.rpc("redeem_camera_stream_session", {
      target_gateway_id: gatewayId,
      target_gateway_token: gatewayToken,
      target_session_id: sessionId,
      target_session_token: sessionToken,
      target_request_id: requestNonce,
      target_request_expires_at: requestExpiresAt,
    });
    if (error) return errorResponse(403, "SESSION_REJECTED", "Sessao de stream invalida ou expirada.");
    const session = Array.isArray(data) ? data[0] as JsonRecord | undefined : undefined;
    if (!session?.camera_id || !session.institution_id || !session.stream_path || !session.expires_at) {
      return errorResponse(403, "SESSION_REJECTED", "Sessao de stream invalida ou expirada.");
    }
    return response({
      success: true,
      camera_id: session.camera_id,
      institution_id: session.institution_id,
      stream_path: session.stream_path,
      expires_at: session.expires_at,
    });
  } catch {
    console.error(JSON.stringify({ request_id: id, action, code: "INTERNAL_ERROR" }));
    return errorResponse(500, "INTERNAL_ERROR", "Nao foi possivel concluir a operacao do gateway.");
  }
}

Deno.serve(run);
