import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST = 'https://admin.grupotec.dev.br/';
export function getEntries(html) {
  const results = [];
  for (const m of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const kind = m[1].toLowerCase();
    if (kind === 'script' && !/\btype=["']module["']/i.test(tag)) continue;
    if (kind === 'link' && !/\brel=["']stylesheet["']/i.test(tag)) continue;
    const path = /\b(?:src|href)=["']([^"']+)["']/i.exec(tag)?.[1];
    if (path?.startsWith('/assets/')) results.push({ kind: kind === 'script' ? 'js' : 'css', path });
  }
  return results;
}
const hash = (contents) => createHash('sha256').update(contents).digest('hex');

export async function compare({ productionUrl = HOST, distDir = 'dist', fetchImpl = fetch, readFileImpl = readFile } = {}) {
  const origin = new URL(productionUrl);
  if (origin.protocol !== 'https:') throw new Error('Require HTTPS production URL');
  const dir = resolve(distDir);
  const built = getEntries(await readFileImpl(resolve(dir, 'index.html'), 'utf8'));
  const htmlResponse = await fetchImpl(origin.href, {signal: AbortSignal.timeout(20000)});
  if (!htmlResponse.ok) throw new Error('Production HTTP ' + htmlResponse.status);
  const live = getEntries(await htmlResponse.text());
  const findings = [];
  for (const kind of ['js','css']) {
    const a = built.filter((e) => e.kind === kind);
    const b = live.filter((e) => e.kind === kind);
    if (a.length !== 1 || b.length !== 1) throw new Error('Missing or multiple ' + kind + ' assets');
    const localURL = new URL(a[0].path, origin.href);
    const path = resolve(dir, localURL.pathname.replace(/^\/+/, ''));
    const rel = relative(dir, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unsafe local asset path');
    const localBytes = await readFileImpl(path);
    const remoteURL = new URL(b[0].path, origin.href);
    if (remoteURL.origin !== origin.origin) throw new Error('Unexpected asset origin');
    const assetRes = await fetchImpl(remoteURL.href, { signal: AbortSignal.timeout(20000) });
    if (!assetRes.ok) throw new Error('Asset HTTP ' + assetRes.status);
    const remoteBytes = Buffer.from(await assetRes.arrayBuffer());
    const localHash = hash(localBytes);
    const liveHash = hash(remoteBytes);
    findings.push({ kind, equal: localHash === liveHash, localPath: a[0].path, livePath: b[0].path, localBytes: localBytes.length, liveBytes: remoteBytes.length, localHash, liveHash });
  }
  return { productionUrl: origin.href, status: findings.every(f => f.equal) ? 'MATCH' : 'DRIFT', findings };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await compare({productionUrl: process.env.TECESCOLA_URL ?? HOST,distDir:process.env.TECESCOLA_BUILD_DIR ?? 'dist'});
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (process.argv.includes('--strict') && result.status !== 'MATCH') process.exitCode = 2;
  } catch (err) {
    process.stderr.write('PARITY_ERROR ' + err.message + '\n');
    process.exitCode = 1;
  }
}
