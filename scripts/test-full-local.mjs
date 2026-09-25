import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const startedAt = Date.now();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const e2eOnly = process.argv.includes('--e2e-only');
const restartOnly = process.argv.includes('--restart-only');
if (restartOnly && !e2eOnly) {
  throw new Error('--restart-only requires --e2e-only to preserve the existing local database');
}
const runtimeDir = mkdtempSync(join(tmpdir(), 'edumoneyyyy-full-local-'));
let supabaseStarted = false;

const edgeFunctions = [
  'create-client-account',
  'create-institution',
  'update-client-account',
  'update-institution-status',
  'restore-client-account',
  'delete-client-account',
  'invite-school-user',
  'send-school-email',
  'update-client-admin-password',
  'camera-gateway',
];

function run(label, command, args, extraEnv = {}) {
  console.log(`\n[full-local] ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function runSupabaseStart(label, command, args) {
  console.log(`\n[full-local] ${label}`);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
    shell: process.platform === 'win32',
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.error) throw result.error;

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .replace(/("[^"]*(?:KEY|SECRET|PASSWORD|TOKEN)[^"]*"\s*:\s*")[^"]+("\s*,?)/gi, '$1[REDACTED]$2')
    .replace(/((?:[A-Z0-9_]*(?:KEY|SECRET|PASSWORD|TOKEN)[A-Z0-9_]*)\s*=\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/((?:anon(?:ymous)?|service[_ -]?role|jwt|database|db)\s+(?:api\s+)?key|(?:jwt\s+secret|db\s+password))\s*:\s*\S+/gi, '$1: [REDACTED]')
    .replace(/("DB_URL"\s*:\s*")[^"]+("\s*,?)/gi, '$1[REDACTED]$2')
    .replace(/(postgres(?:ql)?:\/\/)[^:\s/]+:[^@\s/]+@/gi, '$1[REDACTED]@')
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
  if (output.trim()) console.log(output.trimEnd());
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function capture(label, command, args) {
  console.log(`\n[full-local] ${label}`);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  return result;
}

function runReadOnlyInventory() {
  const containerResult = capture('Locate isolated Supabase database container', 'docker', [
    'ps', '--filter', 'name=supabase_db_edumoneyyyy-full-local-run', '--format', '{{.Names}}',
  ]);
  if (containerResult.status !== 0) throw new Error('Could not locate the isolated Supabase database container');
  const containers = containerResult.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (containers.length !== 1) throw new Error('Expected exactly one isolated Supabase database container');

  const result = spawnSync('docker', [
    'exec', '-i', containers[0], 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off',
    '-U', 'postgres', '-d', 'postgres',
  ], {
    input: readFileSync(resolve('scripts/db/self-hosted-production-inventory.sql'), 'utf8'),
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
    shell: process.platform === 'win32',
    maxBuffer: 24 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function localSupabaseEnvironment(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  const url = values.API_URL;
  if (!url || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error('Supabase status did not return a local API_URL');
  }
  if (!values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
    throw new Error('Supabase status did not return local keys');
  }
  return {
    MULTI_TENANT_SUPABASE_URL: url,
    MULTI_TENANT_SUPABASE_ANON_KEY: values.ANON_KEY,
    MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    E2E_SUPABASE_URL: url,
    E2E_SUPABASE_ANON_KEY: values.ANON_KEY,
    E2E_SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_PUBLISHABLE_KEY: values.ANON_KEY,
  };
}

function supabaseArgs(...args) {
  return ['--no-install', 'supabase', '--workdir', runtimeDir, ...args];
}

try {
  const supabaseDirectory = join(runtimeDir, 'supabase');
  cpSync(resolve('supabase'), supabaseDirectory, { recursive: true });
  const configPath = join(supabaseDirectory, 'config.toml');
  const isolatedConfig = readFileSync(configPath, 'utf8').replace(
    /^project_id\s*=.*$/m,
    'project_id = "edumoneyyyy-full-local-run"',
  );
  writeFileSync(configPath, isolatedConfig);

  run('Docker daemon', 'docker', ['info']);
  run('Supabase CLI', npxCommand, ['--no-install', 'supabase', '--version']);

  let status = capture('Supabase local status', npxCommand, supabaseArgs('status', '-o', 'env'));
  if (status.status !== 0) {
    runSupabaseStart('Start isolated Supabase locally (skip optional telemetry, Studio, Storage API, image proxy, and pooler)', npxCommand, supabaseArgs('start', '--exclude', 'logflare,studio,storage-api,imgproxy,supavisor'));
    supabaseStarted = true;
    status = capture('Supabase local status after start', npxCommand, supabaseArgs('status', '-o', 'env'));
  }
  if (status.status !== 0) throw new Error('Supabase local stack is not available');
  const localEnv = localSupabaseEnvironment(status.stdout);
  supabaseStarted = true;
  console.log('[full-local] confirmed local Supabase endpoint; keys are not printed');

  if (!e2eOnly) {
    run('Supabase database reset', npxCommand, supabaseArgs('db', 'reset'));
    run('Supabase database lint', npxCommand, supabaseArgs('db', 'lint', '--local', '--fail-on', 'error'));

    console.log('\n[full-local] Read-only self-hosted inventory query against local Supabase');
    const inventory = runReadOnlyInventory();
    if (inventory.status !== 0) {
      const diagnostic = `${inventory.stderr ?? ''}\n${inventory.stdout ?? ''}`
        .replace(/(postgres(?:ql)?:\/\/)[^:\s/]+:[^@\s/]+@/gi, '$1[REDACTED]@')
        .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
        .trim()
        .slice(-1500);
      if (diagnostic) console.error(diagnostic);
      throw new Error('Read-only inventory query failed against local Supabase');
    }
    console.log(`[full-local] inventory SQL syntax/runtime PASS output_bytes=${Buffer.byteLength(inventory.stdout ?? '')}`);

    const schemaDiff = capture('Local schema drift check', npxCommand, supabaseArgs('db', 'diff', '--local', '--schema', 'public'));
    if (schemaDiff.status !== 0) throw new Error('Local schema diff failed');
    if (!/no schema changes found/i.test(`${schemaDiff.stdout}\n${schemaDiff.stderr}`)) {
      throw new Error('Local schema diff detected drift');
    }
    console.log('[full-local] no local schema drift detected');
    run('Migration tests', npmCommand, ['test', '--', 'supabase/migrations']);
    run('Local database tests', npmCommand, ['test', '--', 'supabase/tests'], localEnv);
    run('Edge Function unit tests', npmCommand, ['test', '--', 'supabase/functions']);

    for (const functionName of edgeFunctions) {
      const directory = `supabase/functions/${functionName}`;
      run(`Deno check ${functionName}`, npxCommand, [
        '--yes', 'deno', 'check', '--frozen',
        '--config', `${directory}/deno.json`,
        '--lock', `${directory}/deno.lock`,
        `${directory}/index.ts`,
      ]);
      run(`Deno lint ${functionName}`, npxCommand, [
        '--yes', 'deno', 'lint',
        '--config', `${directory}/deno.json`,
        `${directory}/index.ts`,
      ]);
    }

    run('Typecheck', npmCommand, ['run', 'typecheck'], localEnv);
    run('Unit tests', npmCommand, ['test'], localEnv);
    run('Production build', npmCommand, ['run', 'build'], localEnv);
  } else {
    console.log('[full-local] skipping reset and pre-E2E gates; reusing the existing local database volume');
  }

  if (!restartOnly) {
    run('Playwright academic workflow E2E', npmCommand, ['run', 'e2e:local', '--', '--grep-invert', '@restart'], localEnv);
  } else {
    console.log('[full-local] skipping primary E2E; running only the persistence-after-restart scenario');
  }

  run('Stop isolated Supabase without removing volumes', npxCommand, supabaseArgs('stop'));
  supabaseStarted = false;
  runSupabaseStart('Restart isolated Supabase without resetting the database (same optional services excluded)', npxCommand, supabaseArgs('start', '--exclude', 'logflare,studio,storage-api,imgproxy,supavisor'));
  supabaseStarted = true;
  const restartedStatus = capture('Supabase status after restart', npxCommand, supabaseArgs('status', '-o', 'env'));
  if (restartedStatus.status !== 0) throw new Error('Supabase did not recover after local restart');
  const restartedEnv = localSupabaseEnvironment(restartedStatus.stdout);
  if (restartedEnv.E2E_SUPABASE_URL !== localEnv.E2E_SUPABASE_URL) {
    throw new Error('Supabase API URL changed unexpectedly after restart');
  }
  run('Playwright persistence after frontend and Supabase restart', npmCommand, [
    'run', 'e2e:local', '--', '--grep', '@restart',
  ], restartedEnv);

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[full-local] PASS duration_seconds=${durationSeconds}`);
} catch (error) {
  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.error(`\n[full-local] FAIL duration_seconds=${durationSeconds}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (supabaseStarted) {
    const stop = spawnSync(npxCommand, supabaseArgs('stop'), {
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    if (stop.error || stop.status !== 0) {
      console.error('[full-local] failed to stop isolated Supabase stack');
      process.exitCode = 1;
    }
  }
  rmSync(runtimeDir, { recursive: true, force: true });
}
