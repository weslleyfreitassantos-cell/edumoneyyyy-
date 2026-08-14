import type {
  CameraConfig,
  GatewayConfig,
  PairResponse,
  StreamSessionAuthorization,
} from './types.ts';

export interface GatewayCloudApi {
  pair(pairingCode: string, localBaseUrl: string): Promise<PairResponse>;
  heartbeat(config: GatewayConfig): Promise<void>;
  sync(config: GatewayConfig): Promise<CameraConfig[]>;
  redeemStreamSession(config: GatewayConfig, sessionId: string, sessionToken: string): Promise<StreamSessionAuthorization>;
}

interface GatewayResponse {
  success?: boolean;
  error?: string;
  message?: string;
  gateway_id?: string;
  institution_id?: string;
  gateway_token?: string;
  local_base_url?: string;
  paired_at?: string;
  cameras?: CameraConfig[];
  camera_id?: string;
  stream_path?: string;
  expires_at?: string;
}

function safeError(status: number, body: GatewayResponse | null): Error {
  const messages: Record<string, string> = {
    INVALID_PAYLOAD: 'Os dados do gateway sao invalidos.',
    PAIRING_REJECTED: 'O codigo de pareamento e invalido ou expirou.',
    GATEWAY_REJECTED: 'O gateway nao esta autorizado.',
    SESSION_REJECTED: 'A sessao da camera e invalida ou expirou.',
  };
  const message = typeof body?.error === 'string' && messages[body.error]
    ? messages[body.error]
    : status >= 500
      ? 'O servico do gateway esta indisponivel.'
      : 'Falha na comunicacao com o servico do gateway.';
  return new Error(`${message} (HTTP ${status})`);
}

export class SupabaseGatewayApi implements GatewayCloudApi {
  private readonly supabaseUrl: string;
  private readonly anonKey: string;

  constructor(supabaseUrl: string, anonKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.anonKey = anonKey;
  }

  private async request(
    action: string,
    body: Record<string, unknown>,
    gatewayToken?: string,
  ): Promise<GatewayResponse> {
    const headers: Record<string, string> = {
      apikey: this.anonKey,
      'content-type': 'application/json',
    };
    if (gatewayToken) headers.authorization = `Bearer ${gatewayToken}`;
    const response = await fetch(`${this.supabaseUrl}/functions/v1/camera-gateway`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...body }),
    });
    let parsed: GatewayResponse | null = null;
    try {
      parsed = (await response.json()) as GatewayResponse;
    } catch {
      parsed = null;
    }
    if (!response.ok || parsed?.success === false) throw safeError(response.status, parsed);
    return parsed ?? {};
  }

  private requestEnvelope(): { request_id: string; expires_at: string } {
    return {
      request_id: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  async pair(pairingCode: string, localBaseUrl: string): Promise<PairResponse> {
    const response = await this.request('pair', { pairing_code: pairingCode, local_base_url: localBaseUrl });
    if (!response.gateway_id || !response.institution_id || !response.gateway_token) {
      throw new Error('Resposta de pareamento incompleta.');
    }
    return {
      gatewayId: response.gateway_id,
      institutionId: response.institution_id,
      gatewayToken: response.gateway_token,
      localBaseUrl: response.local_base_url ?? localBaseUrl,
      pairedAt: response.paired_at ?? new Date().toISOString(),
    };
  }

  async heartbeat(config: GatewayConfig): Promise<void> {
    await this.request('heartbeat', { gateway_id: config.gatewayId, ...this.requestEnvelope() }, config.gatewayToken);
  }

  async sync(config: GatewayConfig): Promise<CameraConfig[]> {
    const response = await this.request('sync', { gateway_id: config.gatewayId, ...this.requestEnvelope() }, config.gatewayToken);
    return response.cameras ?? [];
  }

  async redeemStreamSession(config: GatewayConfig, sessionId: string, sessionToken: string): Promise<StreamSessionAuthorization> {
    const response = await this.request('redeem_stream_session', {
      gateway_id: config.gatewayId,
      session_id: sessionId,
      session_token: sessionToken,
      ...this.requestEnvelope(),
    }, config.gatewayToken);
    if (!response.camera_id || !response.institution_id || !response.stream_path || !response.expires_at) {
      throw new Error('Sessao de stream incompleta.');
    }
    return {
      cameraId: response.camera_id,
      institutionId: response.institution_id,
      streamPath: response.stream_path,
      expiresAt: response.expires_at,
    };
  }
}
