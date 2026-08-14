import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { SupabaseGatewayApi } from './api.ts';
import {
  defaultConfigPath,
  readGatewayConfig,
  removeGatewayConfig,
  validateLocalBaseUrl,
  validateSupabaseUrl,
  writeGatewayConfig,
  runtimePidPath,
} from './config.ts';
import { FfmpegCameraPublisher } from './publisher.ts';
import { GatewayRuntime } from './runtime.ts';
import { createGatewayServer } from './server.ts';
import type { GatewayConfig } from './types.ts';

function option(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function requiredOption(args: string[], name: string): string {
  const value = option(args, name);
  if (!value || value.startsWith('--')) throw new Error(`Informe ${name}.`);
  return value;
}

function findBinary(name: string): string {
  try {
    const command = process.platform === 'win32' ? 'where.exe' : 'which';
    return execFileSync(command, [name], { encoding: 'utf8' }).split(/\r?\n/)[0].trim();
  } catch {
    throw new Error(`${name} nao encontrado no PATH.`);
  }
}

function printUsage(): void {
  console.log('camera-gateway pair --code CODE --supabase-url URL --anon-key KEY');
  console.log('camera-gateway start [--port 8787] [--lab-camera-id ID] [--lab-rtsp-url URL]');
  console.log('camera-gateway status');
  console.log('camera-gateway test-camera CAMERA_ID');
  console.log('camera-gateway logout');
}

async function pair(args: string[]): Promise<void> {
  const code = requiredOption(args, '--code');
  const supabaseUrl = validateSupabaseUrl(option(args, '--supabase-url', process.env.SUPABASE_URL) ?? '');
  const anonKey = option(args, '--anon-key', process.env.SUPABASE_ANON_KEY);
  if (!anonKey) throw new Error('Informe --anon-key ou SUPABASE_ANON_KEY.');
  const localBaseUrl = validateLocalBaseUrl(option(args, '--local-url', 'http://127.0.0.1:8787') as string);
  const api = new SupabaseGatewayApi(supabaseUrl, anonKey);
  const result = await api.pair(code, localBaseUrl);
  const config: GatewayConfig = {
    supabaseUrl,
    supabaseAnonKey: anonKey,
    gatewayId: result.gatewayId,
    institutionId: result.institutionId,
    gatewayToken: result.gatewayToken,
    localBaseUrl: result.localBaseUrl,
    mediaMtxHlsUrl: option(args, '--media-hls-url', 'http://127.0.0.1:8888') as string,
    mediaMtxRtspUrl: option(args, '--media-rtsp-url', 'rtsp://127.0.0.1:8554') as string,
    pairedAt: result.pairedAt,
  };
  await writeGatewayConfig(config);
  console.log(`Gateway pareado. ID: ${config.gatewayId}`);
  console.log(`Configuracao salva em: ${defaultConfigPath()}`);
}

function createRuntime(config: GatewayConfig, args: string[]): GatewayRuntime {
  const api = new SupabaseGatewayApi(config.supabaseUrl, config.supabaseAnonKey);
  const labId = option(args, '--lab-camera-id');
  const labUrl = option(args, '--lab-rtsp-url');
  const labSource = labId && labUrl ? { cameraId: labId, rtspUrl: labUrl, streamPath: option(args, '--lab-stream-path', 'camera1') } : undefined;
  return new GatewayRuntime({
    config,
    api,
    publisher: new FfmpegCameraPublisher(findBinary('ffmpeg'), config.mediaMtxRtspUrl),
    ffprobePath: findBinary('ffprobe'),
    labSource,
  });
}

async function start(args: string[]): Promise<void> {
  const config = await readGatewayConfig();
  const runtime = createRuntime(config, args);
  const port = Number(option(args, '--port', '8787'));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Porta local invalida.');
  const server = createGatewayServer(runtime, config.mediaMtxHlsUrl);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  await runtime.start();
  await mkdir(dirname(runtimePidPath()), { recursive: true });
  await writeFile(runtimePidPath(), `${process.pid}\n`, { encoding: 'ascii', mode: 0o600 });
  console.log(`Gateway ativo em ${config.localBaseUrl}`);
  console.log('Modo remoto: relay remoto nao configurado.');
  const stop = () => {
    runtime.stop();
    server.close();
    void writeFile(runtimePidPath(), '', { encoding: 'ascii' });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await new Promise<void>(() => undefined);
}

async function status(): Promise<void> {
  try {
    const config = await readGatewayConfig();
    let runtime: Record<string, unknown> = { running: false };
    try {
      const response = await fetch(`${config.localBaseUrl}/health`);
      if (response.ok) runtime = await response.json() as Record<string, unknown>;
    } catch {
      runtime = { running: false };
    }
    console.log(JSON.stringify({ paired: true, gatewayId: config.gatewayId, institutionId: config.institutionId, configPath: defaultConfigPath(), runtime }, null, 2));
  } catch {
    console.log(JSON.stringify({ paired: false, configPath: defaultConfigPath() }, null, 2));
  }
}

async function testCamera(args: string[]): Promise<void> {
  const cameraId = requiredOption(args, 'camera-id');
  const config = await readGatewayConfig();
  const runtime = createRuntime(config, args);
  await runtime.syncNow();
  const result = await runtime.testCamera(cameraId);
  console.log(JSON.stringify(result, null, 2));
  if (!result.reachable) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }
  if (command === 'pair') return pair(args);
  if (command === 'start') return start(args);
  if (command === 'status') return status();
  if (command === 'test-camera') return testCamera([args[0] ? 'camera-id' : '', args[0] ?? '', ...args.slice(1)]);
  if (command === 'logout') {
    await removeGatewayConfig();
    console.log('Gateway despareado localmente.');
    return;
  }
  printUsage();
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha inesperada.';
  console.error(message);
  process.exitCode = 1;
});
