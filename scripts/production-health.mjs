import { pathToFileURL } from 'node:url';

const DEFAULT_SITE_URL = 'https://tecescola.grupotec.dev.br';
const DEFAULT_SUPABASE_URL = 'https://api-edu-vps.grupotec.dev.br';

async function probe(name, url, { fetchImpl, headers = {}, timeoutMs }) {
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();

    return {
      name,
      status: response.status === 200 ? 'PASS' : 'FAIL',
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name,
      status: 'FAIL',
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      error: error?.name === 'TimeoutError' ? 'timeout' : 'connection error',
    };
  }
}

export async function runProductionHealth({
  siteUrl = process.env.TECESCOLA_URL ?? DEFAULT_SITE_URL,
  supabaseUrl = process.env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
  anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  fetchImpl = fetch,
  timeoutMs = 8000,
} = {}) {
  const site = new URL(siteUrl);
  const supabase = new URL(supabaseUrl);
  if (site.protocol !== 'https:' || supabase.protocol !== 'https:') {
    throw new Error('Production health URLs must use HTTPS.');
  }
  const commonHeaders = anonKey ? { apikey: anonKey } : {};
  const unavailable = (name) => ({
    name,
    status: 'BLOCKED',
    reason: 'SUPABASE_ANON_KEY is not configured',
  });
  const checks = await Promise.all([
    probe('frontend', new URL('/', site).href, { fetchImpl, timeoutMs }),
    anonKey
      ? probe('auth', new URL('/auth/v1/health', supabase).href, {
          fetchImpl,
          headers: commonHeaders,
          timeoutMs,
        })
      : unavailable('auth'),
    anonKey
      ? probe('database-rest', new URL('/rest/v1/institutions?select=id&limit=0', supabase).href, {
          fetchImpl,
          headers: commonHeaders,
          timeoutMs,
        })
      : unavailable('database-rest'),
    anonKey
      ? probe('storage-api', new URL('/storage/v1/bucket', supabase).href, {
          fetchImpl,
          headers: commonHeaders,
          timeoutMs,
        })
      : unavailable('storage-api'),
    anonKey
      ? probe('realtime-ping', new URL('/realtime/v1/api/ping', supabase).href, {
          fetchImpl,
          headers: commonHeaders,
          timeoutMs,
        })
      : unavailable('realtime-ping'),
  ]);

  const failed = checks.filter((check) => check.status === 'FAIL').length;
  const blocked = checks.filter((check) => check.status === 'BLOCKED').length;

  return {
    checks,
    summary: { passed: checks.length - failed - blocked, failed, blocked },
    exitCode: failed > 0 ? 1 : blocked > 0 ? 2 : 0,
  };
}

function printResult(result) {
  for (const check of result.checks) {
    const fields = [check.status, check.name];
    if (check.httpStatus !== undefined && check.httpStatus !== null) fields.push(`http=${check.httpStatus}`);
    if (check.durationMs !== undefined) fields.push(`duration_ms=${check.durationMs}`);
    if (check.error) fields.push(`error=${check.error}`);
    if (check.reason) fields.push(`reason=${check.reason}`);
    process.stdout.write(`${fields.join(' ')}\n`);
  }

  process.stdout.write(
    `SUMMARY passed=${result.summary.passed} failed=${result.summary.failed} blocked=${result.summary.blocked}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runProductionHealth();
    printResult(result);
    process.exitCode = result.exitCode;
  } catch {
    process.stderr.write('BLOCKED configuration: provide valid HTTPS service URLs.\n');
    process.exitCode = 2;
  }
}
