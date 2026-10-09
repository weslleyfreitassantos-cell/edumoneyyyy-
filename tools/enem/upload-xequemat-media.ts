import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import type { XequematArchiveReport, XequematMediaReference } from './xequemat-archive.ts';
import type { XequematMediaManifest, XequematMediaManifestAsset } from './import-xequemat.ts';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);

interface MediaPlanAsset extends XequematMediaManifestAsset {
  mimeType: string;
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isInside(root: string, candidate: string) {
  const relativePath = relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..');
}

function validateStoragePath(storagePath: string) {
  if (!storagePath.startsWith('enem/xequemat-archive-v1/')) {
    throw new Error(`canonical media path outside the Xequemat namespace: ${storagePath}`);
  }
  if (storagePath.includes('..') || storagePath.includes('\\') || /[\u0000-\u001f]/u.test(storagePath)) {
    throw new Error(`unsafe canonical media path: ${storagePath}`);
  }
}

function mediaCandidates(report: XequematArchiveReport) {
  const byCanonicalPath = new Map<string, { archivePath: string; reference: XequematMediaReference }>();
  for (const record of report.records) {
    if (!record.ready) continue;
    for (const reference of record.media) {
      if (reference.missing || !reference.archivePath || !reference.canonicalPath) continue;
      const current = byCanonicalPath.get(reference.canonicalPath);
      if (current && current.archivePath !== reference.archivePath) {
        throw new Error(`canonical media path maps to multiple archive files: ${reference.canonicalPath}`);
      }
      byCanonicalPath.set(reference.canonicalPath, { archivePath: reference.archivePath, reference });
    }
  }
  return [...byCanonicalPath.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function buildXequematMediaUploadPlan(
  report: XequematArchiveReport,
  archiveRoot: string,
): MediaPlanAsset[] {
  const root = resolve(archiveRoot);
  return mediaCandidates(report).map(([canonicalPath, candidate]) => {
    validateStoragePath(canonicalPath);
    const archiveFile = resolve(root, candidate.archivePath);
    if (!isInside(root, archiveFile) || !existsSync(archiveFile)) {
      throw new Error(`media file is not present inside the extracted archive: ${candidate.archivePath}`);
    }
    const mimeType = ALLOWED_MIME_TYPES.get(extname(archiveFile).toLowerCase());
    if (!mimeType) throw new Error(`unsupported media extension: ${candidate.archivePath}`);
    const bytes = readFileSync(archiveFile);
    if (bytes.length <= 0 || bytes.length > MAX_BYTES) {
      throw new Error(`media file size is outside the storage limit: ${candidate.archivePath}`);
    }
    return {
      canonicalPath,
      archivePath: candidate.archivePath,
      bytes: bytes.length,
      sha256: hash(bytes),
      status: 'UPLOADED',
      mimeType,
    };
  });
}

async function forEachConcurrent<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const args = process.argv.slice(2);
  const reportPath = resolve(argument('--report', args) ?? '.runtime/enem-xequemat-archive-v1/report-authorized.json');
  const archiveRoot = resolve(argument('--archive-dir', args) ?? '.runtime/enem-xequemat-archive-v1/extracted');
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-xequemat-archive-v1/media-manifest.json');
  const bucket = argument('--bucket', args) ?? 'enem-question-assets';
  const dryRun = args.includes('--dry-run');
  if (bucket !== 'enem-question-assets') throw new Error(`unexpected bucket: ${bucket}`);

  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as XequematArchiveReport;
  const plan = buildXequematMediaUploadPlan(report, archiveRoot);
  const totalBytes = plan.reduce((total, asset) => total + asset.bytes, 0);
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, assets: plan.length, bytes: totalBytes, bucket }, null, 2));
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required for media upload');
  }
  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const uploaded = new Set<string>();
  await forEachConcurrent(plan, 6, async (asset) => {
    const archiveFile = resolve(archiveRoot, asset.archivePath);
    const bytes = readFileSync(archiveFile);
    const result = await client.storage.from(bucket).upload(asset.canonicalPath, bytes, {
      cacheControl: '31536000',
      contentType: asset.mimeType,
      upsert: true,
    });
    if (result.error) throw new Error(`upload failed for ${asset.canonicalPath}: ${result.error.message}`);
    uploaded.add(asset.canonicalPath);
  });

  const verificationErrors: string[] = [];
  await forEachConcurrent(plan, 6, async (asset) => {
    const result = await client.storage.from(bucket).download(asset.canonicalPath);
    if (result.error || !result.data) {
      verificationErrors.push(`${asset.canonicalPath}: ${result.error?.message ?? 'empty download'}`);
      return;
    }
    const downloaded = new Uint8Array(await result.data.arrayBuffer());
    if (downloaded.byteLength !== asset.bytes || hash(downloaded) !== asset.sha256) {
      verificationErrors.push(`${asset.canonicalPath}: downloaded bytes do not match the source hash`);
    }
  });
  if (verificationErrors.length) throw new Error(`media verification failed:\n${verificationErrors.join('\n')}`);
  if (uploaded.size !== plan.length) throw new Error(`only ${uploaded.size}/${plan.length} media assets were uploaded`);

  const manifest: XequematMediaManifest = {
    schemaVersion: 1,
    bucket: 'enem-question-assets',
    contentRevision: report.contentRevision,
    assets: plan.map(({ mimeType: _mimeType, ...asset }) => asset),
  };
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, bucket, assets: plan.length, bytes: totalBytes, verified: true }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
