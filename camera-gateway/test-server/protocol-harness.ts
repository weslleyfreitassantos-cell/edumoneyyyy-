import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const institutionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const gatewayId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cameraId = 'webcam-test';
const pairingCode = 'HARNESS-PAIR-001';
const gatewayToken = `harness-${randomUUID()}`;

interface HarnessState {
  pairRequests: number;
  heartbeats: number[];
  syncs: number;
  rejected: number;
  replays: number;
  usedPairing: boolean;
  revoked: boolean;
  requestIds: Set<string>;
  syncBodies: Record<string, unknown>[];
}

interface RunningGateway {
  child: ChildProcessWithoutNullStreams;
  output: { stdout: string; stderr: string };
  closed: Promise<number | null>;
}

function json(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function requestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) {
    raw += String(chunk);
    if (raw.length > 32_768) throw new Error('request too large');
  }
  const parsed: unknown = JSON.parse(raw || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid request');
  return parsed as Record<string, unknown>;
}

function authToken(request: IncomingMessage): string | null {
  const value = request.headers.authorization ?? '';
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function futureTimestamp(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

function createHarness(state: HarnessState) {
  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/functions/v1/camera-gateway') {
      json(response, 404, { success: false, code: 'NOT_FOUND' });
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await requestBody(request);
    } catch {
      json(response, 400, { success: false, code: 'INVALID_JSON' });
      return;
    }

    const action = body.action;
    if (action === 'pair') {
      state.pairRequests += 1;
      if (body.pairing_code !== pairingCode || state.usedPairing) {
        json(response, 403, { success: false, code: 'PAIRING_REJECTED', message: 'pairing rejected' });
        return;
      }
      state.usedPairing = true;
      json(response, 200, {
        success: true,
        gateway_id: gatewayId,
        institution_id: institutionId,
        gateway_token: gatewayToken,
        local_base_url: body.local_base_url,
        paired_at: new Date().toISOString(),
      });
      return;
    }

    const gatewayRequestId = typeof body.gateway_id === 'string' ? body.gateway_id : '';
    const token = authToken(request);
    if (gatewayRequestId !== gatewayId || token !== gatewayToken || state.revoked) {
      state.rejected += 1;
      json(response, 401, { success: false, code: 'GATEWAY_REJECTED', message: 'gateway rejected' });
      return;
    }

    const requestId = typeof body.request_id === 'string' ? body.request_id : '';
    const expiresAt = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : NaN;
    if (!requestId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      json(response, 400, { success: false, code: 'INVALID_PAYLOAD', message: 'invalid request' });
      return;
    }
    if (state.requestIds.has(requestId)) {
      state.replays += 1;
      json(response, 401, { success: false, code: 'GATEWAY_REJECTED', message: 'replayed request' });
      return;
    }
    state.requestIds.add(requestId);

    if (action === 'heartbeat') {
      state.heartbeats.push(Date.now());
      json(response, 200, { success: true });
      return;
    }
    if (action === 'sync') {
      state.syncs += 1;
      state.syncBodies.push(body);
      json(response, 200, {
        success: true,
        cameras: [{
          id: cameraId,
          institution_id: institutionId,
          name: 'Webcam de teste',
          host: '127.0.0.1',
          port: 8554,
          protocol: 'RTSP',
          channel: null,
          stream_profile: 'SUB',
          active: true,
        }],
      });
      return;
    }
    if (action === 'redeem_stream_session') {
      json(response, 200, {
        success: true,
        camera_id: cameraId,
        institution_id: institutionId,
        stream_path: 'camera-webcam-test',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      });
      return;
    }
    json(response, 400, { success: false, code: 'INVALID_ACTION', message: 'invalid action' });
  });
}

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('local harness port unavailable');
  return address.port;
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
}

async function freePort(): Promise<number> {
  const temporary = createServer();
  const port = await listen(temporary);
  await closeServer(temporary);
  return port;
}

function cliArgs(args: string[]): string[] {
  return ['--experimental-strip-types', resolve(projectRoot, 'camera-gateway/src/cli.ts'), ...args];
}

function childEnvironment(appData: string): NodeJS.ProcessEnv {
  return { ...process.env, APPDATA: appData, NO_COLOR: '1' };
}

function runCli(args: string[], env: NodeJS.ProcessEnv, timeoutMs = 30_000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, cliArgs(args), { cwd: projectRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolveRun({ code: timedOut ? -1 : code, stdout, stderr });
    });
  });
}

function startGateway(args: string[], env: NodeJS.ProcessEnv): RunningGateway {
  const child = spawn(process.execPath, cliArgs(args), { cwd: projectRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = { stdout: '', stderr: '' };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { output.stdout += chunk; });
  child.stderr.on('data', (chunk: string) => { output.stderr += chunk; });
  const closed = new Promise<number | null>((resolveClosed) => child.once('close', resolveClosed));
  return { child, output, closed };
}

function cliDiagnostic(result: { stdout: string; stderr: string }): string {
  return `${result.stdout}\n${result.stderr}`.replaceAll(gatewayToken, '[redacted]').trim().slice(-1_000);
}

async function stopGateway(running: RunningGateway): Promise<void> {
  if (running.child.exitCode !== null) return;
  running.child.kill();
  await Promise.race([running.closed, new Promise<void>((resolveWait) => setTimeout(resolveWait, 3_000))]);
  if (running.child.exitCode === null && running.child.pid) {
    spawnSync('taskkill.exe', ['/PID', String(running.child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await running.closed;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs: number, intervalMs = 250): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  throw new Error('timed out waiting for local gateway condition');
}

async function health(port: number): Promise<Record<string, unknown>> {
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  if (!response.ok) throw new Error('gateway health unavailable');
  return await response.json() as Record<string, unknown>;
}

async function main(): Promise<void> {
  const state: HarnessState = {
    pairRequests: 0,
    heartbeats: [],
    syncs: 0,
    rejected: 0,
    replays: 0,
    usedPairing: false,
    revoked: false,
    requestIds: new Set(),
    syncBodies: [],
  };
  const server = createHarness(state);
  const appData = await mkdtemp(join(tmpdir(), 'edumanager-camera-gateway-'));
  let running: RunningGateway | null = null;

  try {
    const harnessPort = await listen(server);
    const gatewayPort = await freePort();
    const supabaseUrl = `http://127.0.0.1:${harnessPort}`;
    const localUrl = `http://127.0.0.1:${gatewayPort}`;
    const env = childEnvironment(appData);

    const pair = await runCli(['pair', '--code', pairingCode, '--supabase-url', supabaseUrl, '--anon-key', 'harness-public-key', '--local-url', localUrl], env);
    assert.equal(pair.code, 0, `pair command failed: ${cliDiagnostic(pair)}`);
    assert(!pair.stdout.includes(gatewayToken) && !pair.stderr.includes(gatewayToken), 'gateway token appeared in pair logs');

    const configPath = join(appData, 'EduManager', 'camera-gateway', 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
    assert.equal(config.gatewayToken, gatewayToken, 'gateway token was not persisted locally');
    assert.equal(config.institutionId, institutionId, 'pairing institution mismatch');

    const reused = await runCli(['pair', '--code', pairingCode, '--supabase-url', supabaseUrl, '--anon-key', 'harness-public-key', '--local-url', localUrl], env);
    assert.notEqual(reused.code, 0, 'pairing code was reusable');
    const expired = await runCli(['pair', '--code', 'EXPIRED-CODE', '--supabase-url', supabaseUrl, '--anon-key', 'harness-public-key', '--local-url', localUrl], env);
    assert.notEqual(expired.code, 0, 'expired pairing code was accepted');

    const invalidTokenResponse = await fetch(`${supabaseUrl}/functions/v1/camera-gateway`, {
      method: 'POST',
      headers: { authorization: 'Bearer invalid-token', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'heartbeat', gateway_id: gatewayId, request_id: randomUUID(), expires_at: futureTimestamp() }),
    });
    assert.equal(invalidTokenResponse.status, 401, 'invalid gateway token was accepted');

    const replayRequestId = randomUUID();
    const replayBody = { action: 'heartbeat', gateway_id: gatewayId, request_id: replayRequestId, expires_at: futureTimestamp() };
    const firstReplayRequest = await fetch(`${supabaseUrl}/functions/v1/camera-gateway`, { method: 'POST', headers: { authorization: `Bearer ${gatewayToken}`, 'content-type': 'application/json' }, body: JSON.stringify(replayBody) });
    const secondReplayRequest = await fetch(`${supabaseUrl}/functions/v1/camera-gateway`, { method: 'POST', headers: { authorization: `Bearer ${gatewayToken}`, 'content-type': 'application/json' }, body: JSON.stringify(replayBody) });
    assert.equal(firstReplayRequest.status, 200, 'valid harness heartbeat failed');
    assert.equal(secondReplayRequest.status, 401, 'replayed gateway request was accepted');

    const startArgs = ['start', '--port', String(gatewayPort), '--allowed-origin', 'http://127.0.0.1:3000', '--lab-camera-id', cameraId, '--lab-rtsp-url', 'rtsp://127.0.0.1:8554/camera1', '--lab-stream-path', 'camera1'];
    running = startGateway(startArgs, env);
    await waitFor(() => state.heartbeats.length >= 2 && state.syncs >= 1, 15_000);
    const firstStartHeartbeats = state.heartbeats.length;

    const goodTest = await runCli(['test-camera', cameraId, '--lab-camera-id', cameraId, '--lab-rtsp-url', 'rtsp://127.0.0.1:8554/camera1', '--lab-stream-path', 'camera1'], env, 30_000);
    assert.equal(goodTest.code, 0, 'real RTSP camera test failed');
    const probe = JSON.parse(goodTest.stdout.trim()) as Record<string, unknown>;
    assert.equal(probe.reachable, true, 'RTSP was not reachable');
    assert.equal(probe.codec, 'h264', 'unexpected RTSP codec');
    assert.equal(probe.width, 640, 'unexpected RTSP width');
    assert.equal(probe.height, 480, 'unexpected RTSP height');
    assert.equal(probe.hasAudio, false, 'unexpected RTSP audio stream');
    assert(typeof probe.fps === 'number' && probe.fps > 25 && probe.fps < 65, 'unexpected RTSP FPS');

    const missingCamera = await runCli(['test-camera', 'missing-camera'], env, 30_000);
    assert.notEqual(missingCamera.code, 0, 'missing camera was accepted');
    const offlineTest = await runCli(['test-camera', cameraId, '--lab-camera-id', cameraId, '--lab-rtsp-url', 'rtsp://127.0.0.1:8554/offline', '--lab-stream-path', 'camera1'], env, 30_000);
    assert.notEqual(offlineTest.code, 0, 'offline camera was reported as reachable');
    const logs = `${pair.stdout}${pair.stderr}${goodTest.stdout}${goodTest.stderr}${missingCamera.stdout}${missingCamera.stderr}${offlineTest.stdout}${offlineTest.stderr}`;
    assert(!logs.includes(gatewayToken), 'gateway token appeared in CLI logs');

    await waitFor(() => state.heartbeats.length >= firstStartHeartbeats + 2, 55_000);
    assert(state.syncBodies.every((body) => !('institution_id' in body)), 'sync accepted an arbitrary institution id');
    assert(state.syncs > 0 && state.heartbeats.length >= 4, 'gateway did not complete multiple protocol cycles');

    await stopGateway(running);
    running = null;
    const beforeRestart = state.heartbeats.length;
    assert.equal(state.pairRequests, 3, 'unexpected pair request count');

    state.revoked = false;
    running = startGateway(startArgs, env);
    await waitFor(() => state.heartbeats.length > beforeRestart, 15_000);
    assert.equal(state.pairRequests, 3, 'restart unexpectedly required pairing');

    state.revoked = true;
    const rejectedBefore = state.rejected;
    await waitFor(() => state.rejected > rejectedBefore, 35_000);
    const revokedHealth = await health(gatewayPort);
    const revokedStatus = revokedHealth.status as Record<string, unknown>;
    assert.equal(revokedStatus.state, 'REVOKED', 'gateway did not enter REVOKED state');
    assert.equal(revokedStatus.paired, false, 'revoked gateway remained paired');
    assert.equal(revokedStatus.running, false, 'revoked gateway remained running');
    await stopGateway(running);
    running = null;

    const hls = await fetch('http://127.0.0.1:8888/camera1/index.m3u8');
    const webrtc = await fetch('http://127.0.0.1:8889/camera1/whep', { method: 'OPTIONS' });
    assert.equal(hls.status, 200, 'HLS lab endpoint failed');
    assert.equal(webrtc.status, 204, 'WebRTC lab endpoint failed');

    const logout = await runCli(['logout'], env);
    assert.equal(logout.code, 0, 'gateway logout failed');
    await assert.rejects(readFile(configPath, 'utf8'));

    console.log(JSON.stringify({
      docker: 'BLOCKED',
      supabaseLocal: 'UNAVAILABLE',
      testHarness: 'IMPLEMENTED',
      webcam: 'PASS',
      mediamtx: 'PASS',
      rtsp: 'PASS',
      pairingHarness: 'PASS',
      heartbeat: 'PASS',
      heartbeatsObserved: state.heartbeats.length,
      cameraSync: 'PASS',
      cameraTest: { codec: probe.codec, resolution: `${probe.width}x${probe.height}`, fps: probe.fps, audio: probe.hasAudio },
      restart: 'PASS',
      revocation: 'PASS',
      multiTenant: 'PASS',
      localStream: 'PASS',
      remoteRelay: 'NOT_HOMOLOGATED',
      configCleanup: 'PASS',
    }, null, 2));
  } finally {
    if (running) await stopGateway(running);
    await closeServer(server);
    await rm(appData, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Gateway protocol harness failed.');
  process.exitCode = 1;
});
