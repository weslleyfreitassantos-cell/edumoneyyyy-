import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.2";

type Action = "pair" | "heartbeat" | "sync" | "redeem_stream_session";
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

function actionField(body: JsonRecord): Action | null {
  const value = body.action;
  return value === "pair" || value === "heartbeat" || value === "sync" || value === "redeem_stream_session"
    ? value
    : null;
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
      const localBaseUrl = textField(body, "local_base_url", 253);
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
  } catch (error) {
    console.error(JSON.stringify({ request_id: id, action, code: "INTERNAL_ERROR" }));
    return errorResponse(500, "INTERNAL_ERROR", "Nao foi possivel concluir a operacao do gateway.");
  }
}

Deno.serve(run);
