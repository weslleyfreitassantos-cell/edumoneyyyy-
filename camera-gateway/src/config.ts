import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

import type { GatewayConfig } from './types.ts';

export function defaultConfigPath(): string {
  const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
  return join(appData, 'EduManager', 'camera-gateway', 'config.json');
}

export function runtimePidPath(): string {
  return join(dirname(defaultConfigPath()), 'gateway.pid');
}

export function defaultTunnelTokenPath(): string {
  return join(dirname(defaultConfigPath()), 'cloudflared-tunnel.token');
}

function ensureUrl(value: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} invalida.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${label} deve ser HTTP(S) sem credenciais.`);
  }
  return parsed;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || isPrivateIpv4(normalized)
    || normalized.endsWith('.local');
}

export function validateLocalBaseUrl(value: string): string {
  const parsed = ensureUrl(value, 'URL local');
  if (!isLocalHost(parsed.hostname)) throw new Error('URL local deve apontar para localhost ou uma rede privada.');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('URL local deve apontar para a raiz e nao conter query.');
  }
  return value.replace(/\/$/, '');
}

export function validateRelayBaseUrl(value: string): string {
  const parsed = ensureUrl(value, 'URL do relay HTTPS');
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('URL do relay HTTPS deve ser uma raiz HTTPS sem query.');
  }
  if (!parsed.hostname.toLowerCase().endsWith('.cameras.grupotec.dev.br')) {
    throw new Error('URL do relay HTTPS deve usar o dominio cameras.grupotec.dev.br.');
  }
  return value.replace(/\/$/, '');
}

export function listenHostForLocalBaseUrl(value: string): string {
  const parsed = new URL(validateLocalBaseUrl(value));
  return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' ? '127.0.0.1' : '0.0.0.0';
}

export function validateSupabaseUrl(value: string): string {
  const parsed = ensureUrl(value, 'SUPABASE_URL');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('SUPABASE_URL deve apontar para a raiz.');
  }
  return value.replace(/\/$/, '');
}

export function validateMediaMtxRtspUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('URL RTSP do MediaMTX invalida.');
  }
  if (parsed.protocol !== 'rtsp:' || parsed.username || parsed.password || !['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash) {
    throw new Error('URL RTSP do MediaMTX deve ser uma raiz sem credenciais.');
  }
  return value.replace(/\/$/, '');
}

export async function readGatewayConfig(path = defaultConfigPath()): Promise<GatewayConfig> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error('Gateway ainda nao foi pareado neste computador.');
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Configuracao local do gateway invalida.');
  }

  if (!value || typeof value !== 'object') throw new Error('Configuracao local do gateway invalida.');
  const config = value as Partial<GatewayConfig>;
  const required = ['supabaseUrl', 'supabaseAnonKey', 'gatewayId', 'institutionId', 'gatewayToken', 'localBaseUrl', 'pairedAt'];
  if (required.some((key) => typeof config[key as keyof GatewayConfig] !== 'string')) {
    throw new Error('Configuracao local do gateway incompleta.');
  }

  return {
    supabaseUrl: validateSupabaseUrl(config.supabaseUrl as string),
    supabaseAnonKey: config.supabaseAnonKey as string,
    gatewayId: config.gatewayId as string,
    institutionId: config.institutionId as string,
    gatewayToken: config.gatewayToken as string,
    localBaseUrl: validateLocalBaseUrl(config.localBaseUrl as string),
    relayBaseUrl: typeof config.relayBaseUrl === 'string' ? validateRelayBaseUrl(config.relayBaseUrl) : null,
    mediaMtxHlsUrl: typeof config.mediaMtxHlsUrl === 'string' ? validateLocalBaseUrl(config.mediaMtxHlsUrl) : 'http://127.0.0.1:8888',
    mediaMtxRtspUrl: typeof config.mediaMtxRtspUrl === 'string' ? validateMediaMtxRtspUrl(config.mediaMtxRtspUrl) : 'rtsp://127.0.0.1:8554',
    pairedAt: config.pairedAt as string,
  };
}

export async function writeGatewayConfig(config: GatewayConfig, path = defaultConfigPath()): Promise<void> {
  const normalized: GatewayConfig = {
    ...config,
    supabaseUrl: validateSupabaseUrl(config.supabaseUrl),
    localBaseUrl: validateLocalBaseUrl(config.localBaseUrl),
    relayBaseUrl: config.relayBaseUrl ? validateRelayBaseUrl(config.relayBaseUrl) : null,
    mediaMtxHlsUrl: validateLocalBaseUrl(config.mediaMtxHlsUrl),
    mediaMtxRtspUrl: validateMediaMtxRtspUrl(config.mediaMtxRtspUrl),
  };
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, path);
}

export async function writeCloudflaredTunnelToken(token: string, path = defaultTunnelTokenPath()): Promise<void> {
  if (!token || token.length < 32 || /[\r\n]/.test(token)) throw new Error('Token do tunnel invalido.');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
}

export async function removeGatewayConfig(path = defaultConfigPath()): Promise<void> {
  await rm(path, { force: true });
}

export function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
}
