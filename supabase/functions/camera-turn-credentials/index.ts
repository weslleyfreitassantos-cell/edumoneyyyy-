import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;
type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

const TURN_CREDENTIAL_TTL_SECONDS = 30 * 60;
const TURN_PROVIDER_ENDPOINT = "https://rtc.live.cloudflare.com/v1/turn/keys/:turn-key-id/credentials/generate-ice-servers";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKER_ORIGIN = "https://edumoneyyyy.weslleyfreitassantos.workers.dev";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin: SupabaseClient | null = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null;

function requestId(): string {
  return crypto.randomUUID();
}

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const configured = [
    Deno.env.get("APP_URL"),
    ...(Deno.env.get("CORS_ORIGINS") ?? "").split(","),
    WORKER_ORIGIN,
  ]
    .map((value) => value?.trim().replace(/\/$/, ""))
    .filter((value): value is string => Boolean(value));
  if (configured.includes(origin)) return origin;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "https:" && parsed.hostname.endsWith(".grupotec.dev.br")) return origin;
    if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) return origin;
  } catch {
    return null;
  }
  return null;
}

function headers(request: Request): Headers {
  const result = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "vary": "Origin",
  });
  const origin = allowedOrigin(request);
  if (origin) result.set("access-control-allow-origin", origin);
  return result;
}

function json(request: Request, body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

function errorResponse(request: Request, status: number, code: string, message: string): Response {
  return json(request, { success: false, code, message }, status);
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  return value.match(/^Bearer\s+([^\s]+)$/i)?.[1] ?? null;
}

function uuidField(body: JsonRecord, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function withoutBrowserBlockedPort(url: string): boolean {
  return !/:53(?:\?|$)/.test(url);
}

function normalizeIceServers(value: unknown): IceServer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const source = entry as JsonRecord;
    const rawUrls = Array.isArray(source.urls) ? source.urls : [source.urls];
    const urls = rawUrls.filter((url): url is string => typeof url === "string" && withoutBrowserBlockedPort(url));
    if (urls.length === 0) return [];
    const server: IceServer = { urls };
    if (typeof source.username === "string" && source.username.length <= 512) server.username = source.username;
    if (typeof source.credential === "string" && source.credential.length <= 512) server.credential = source.credential;
    return [server];
  });
}

type TurnProviderFailureKind =
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "CLOUDFLARE_AUTHENTICATION"
  | "CLOUDFLARE_TURN_KEY_NOT_FOUND"
  | "CLOUDFLARE_INVALID_REQUEST"
  | "CLOUDFLARE_PROVIDER_ERROR"
  | "CLOUDFLARE_REJECTED";

class TurnProviderError extends Error {
  constructor(
    readonly kind: TurnProviderFailureKind,
    readonly status: number | null,
    readonly providerCode: string | null,
    message: string,
  ) {
    super(message);
  }
}

function sanitizeProviderString(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(token|secret|key|credential)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 240);
}

function providerMessage(payload: JsonRecord): string | null {
  for (const key of ["message", "error", "detail"]) {
    const value = sanitizeProviderString(payload[key]);
    if (value) return value;
  }
  return null;
}

function providerFailureKind(status: number): TurnProviderFailureKind {
  if (status === 401 || status === 403) return "CLOUDFLARE_AUTHENTICATION";
  if (status === 404) return "CLOUDFLARE_TURN_KEY_NOT_FOUND";
  if (status === 400 || status === 422) return "CLOUDFLARE_INVALID_REQUEST";
  if (status >= 500) return "CLOUDFLARE_PROVIDER_ERROR";
  return "CLOUDFLARE_REJECTED";
}

async function generateTurnCredentials(turnKeyId: string, apiToken: string): Promise<IceServer[]> {
  const endpoint = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
    });
  } catch {
    throw new TurnProviderError("NETWORK_ERROR", null, null, "TURN provider request failed.");
  }
  let payload: JsonRecord;
  try {
    payload = await response.json() as JsonRecord;
  } catch {
    throw new TurnProviderError("INVALID_RESPONSE", response.status, null, "TURN provider returned invalid JSON.");
  }
  if (!response.ok) {
    throw new TurnProviderError(
      providerFailureKind(response.status),
      response.status,
      sanitizeProviderString(payload.code),
      providerMessage(payload) ?? "TURN provider rejected the credential request.",
    );
  }
  const iceServers = normalizeIceServers(payload.iceServers);
  if (iceServers.length === 0) {
    throw new TurnProviderError("INVALID_RESPONSE", response.status, null, "TURN provider returned no usable ICE servers.");
  }
  return iceServers;
}

function logTurnProviderFailure(
  requestIdValue: string,
  error: unknown,
  turnKeyId: string,
): void {
  const failure = error instanceof TurnProviderError
    ? error
    : new TurnProviderError("INVALID_RESPONSE", null, null, "Unexpected TURN provider failure.");
  console.error(JSON.stringify({
    request_id: requestIdValue,
    code: "TURN_CREDENTIALS_FAILED",
    provider_kind: failure.kind,
    provider_status: failure.status,
    provider_code: failure.providerCode,
    provider_message: sanitizeProviderString(failure.message),
    endpoint: TURN_PROVIDER_ENDPOINT,
    authorization_sent: true,
    secret_key_id_present: turnKeyId.length > 0,
    secret_key_id_length: turnKeyId.length,
    secret_token_present: true,
  }));
}

async function run(request: Request): Promise<Response> {
  const id = requestId();
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== "POST") return errorResponse(request, 405, "METHOD_NOT_ALLOWED", "Metodo nao permitido.");
  if (!admin) return errorResponse(request, 500, "FUNCTION_NOT_CONFIGURED", "Servico de camera temporariamente indisponivel.");
  const token = bearer(request);
  if (!token) return errorResponse(request, 401, "UNAUTHENTICATED", "Sessao de usuario obrigatoria.");

  let body: JsonRecord;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as JsonRecord;
  } catch {
    return errorResponse(request, 400, "INVALID_PAYLOAD", "Dados da sessao invalidos.");
  }
  const cameraId = uuidField(body, "camera_id");
  const sessionId = uuidField(body, "session_id");
  if (!cameraId || !sessionId) return errorResponse(request, 400, "INVALID_PAYLOAD", "Dados da sessao invalidos.");

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const userId = userData.user?.id;
    if (userError || !userId) return errorResponse(request, 401, "UNAUTHENTICATED", "Sessao de usuario invalida.");
    const { data: session, error: sessionError } = await admin
      .from("camera_stream_sessions")
      .select("id, camera_id, profile_id, expires_at")
      .eq("id", sessionId)
      .eq("camera_id", cameraId)
      .eq("profile_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return errorResponse(request, 403, "SESSION_REJECTED", "Sessao de camera invalida ou expirada.");

    const turnKeyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID");
    const turnApiToken = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");
    if (!turnKeyId || !turnApiToken) {
      console.error(JSON.stringify({
        request_id: id,
        code: "TURN_NOT_CONFIGURED",
        endpoint: TURN_PROVIDER_ENDPOINT,
        authorization_sent: false,
        secret_key_id_present: Boolean(turnKeyId),
        secret_token_present: Boolean(turnApiToken),
      }));
      return errorResponse(request, 503, "TURN_NOT_CONFIGURED", "A conectividade remota de baixa latencia ainda nao esta configurada.");
    }
    const iceServers = await generateTurnCredentials(turnKeyId, turnApiToken);
    return json(request, {
      success: true,
      iceServers,
      expiresAt: new Date(Date.now() + TURN_CREDENTIAL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    const turnKeyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID") ?? "";
    logTurnProviderFailure(id, error, turnKeyId);
    return errorResponse(request, 502, "TURN_CREDENTIALS_FAILED", "Nao foi possivel preparar a conectividade remota agora.");
  }
}

Deno.serve(run);
