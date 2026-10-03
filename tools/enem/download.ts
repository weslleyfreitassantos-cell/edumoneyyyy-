import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { assertOfficialEnemReference } from '../../src/services/enemIngestion.ts';
import type { EnemDiscoveredArtifact, EnemDiscoveryResult } from './discover.ts';

export interface EnemDownloadedArtifact extends EnemDiscoveredArtifact {
  examPath: string;
  answerKeyPath: string;
  examSha256: string;
  answerKeySha256: string;
  examBytes: number;
  answerKeyBytes: number;
  retrievedAt: string;
}

export interface EnemDownloadResult {
  schemaVersion: 1;
  discoveryPath: string;
  outputDirectory: string;
  downloadedAt: string;
  artifacts: EnemDownloadedArtifact[];
  issues: string[];
}

export type FetchBinary = (url: string) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

const execFileAsync = promisify(execFile);

async function fetchOfficialBinary(url: string) {
  const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const { stdout } = await execFileAsync(curl, [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--retry',
    '3',
    '--retry-delay',
    '1',
    '--max-time',
    '120',
    '--user-agent',
    'TecEscola-ENEM-official-ingestion/1.0',
    '--output',
    '-',
    url,
  ], { encoding: null, maxBuffer: 128 * 1024 * 1024 });
  const bytes = Buffer.from(stdout);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertPdf(bytes: Uint8Array, label: string) {
  const header = Buffer.from(bytes.subarray(0, 5)).toString('ascii');
  if (header !== '%PDF-') throw new Error(`ENEM_ARTIFACT_NOT_PDF:${label}`);
}

function artifactStem(artifact: EnemDiscoveredArtifact) {
  return `${artifact.year}_${artifact.day}_${artifact.booklet}`;
}

async function fetchPdf(url: string, label: string, fetchBinary: FetchBinary) {
  const officialUrl = assertOfficialEnemReference(url);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchBinary(officialUrl);
      if (!response.ok) {
        if (response.status < 500 || attempt === 3) {
          throw new Error(`ENEM_ARTIFACT_FETCH_FAILED:${label}:${response.status}`);
        }
        throw new Error(`ENEM_ARTIFACT_RETRYABLE_STATUS:${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      assertPdf(bytes, label);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1000));
    }
  }
  throw lastError;
}

export async function downloadOfficialEnemArtifacts(
  discovery: EnemDiscoveryResult,
  options: {
    outputDirectory: string;
    discoveryPath?: string;
    fetchBinary?: FetchBinary;
    now?: Date;
  },
): Promise<EnemDownloadResult> {
  if (discovery.issues.length > 0) {
    throw new Error(`ENEM_DISCOVERY_HAS_ISSUES:${discovery.issues.join(',')}`);
  }

  const outputDirectory = resolve(options.outputDirectory);
  mkdirSync(outputDirectory, { recursive: true });
  const fetchBinary = options.fetchBinary ?? fetchOfficialBinary;
  const downloadedAt = (options.now ?? new Date()).toISOString();
  const artifacts: EnemDownloadedArtifact[] = [];
  const issues: string[] = [];

  for (const artifact of discovery.artifacts) {
    const stem = artifactStem(artifact);
    const examPath = resolve(outputDirectory, `${stem}_PV.pdf`);
    const answerKeyPath = resolve(outputDirectory, `${stem}_GB.pdf`);
    let examBytes: Uint8Array;
    let answerKeyBytes: Uint8Array;
    try {
      examBytes = existsSync(examPath)
        ? new Uint8Array(readFileSync(examPath))
        : await fetchPdf(artifact.examUrl, `${stem}:PV`, fetchBinary);
      assertPdf(examBytes, `${stem}:PV`);
      answerKeyBytes = existsSync(answerKeyPath)
        ? new Uint8Array(readFileSync(answerKeyPath))
        : await fetchPdf(artifact.answerKeyUrl, `${stem}:GB`, fetchBinary);
      assertPdf(answerKeyBytes, `${stem}:GB`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      issues.push(`ENEM_ARTIFACT_QUARANTINED:${stem}:${message}`);
      continue;
    }

    writeFileSync(examPath, examBytes);
    writeFileSync(answerKeyPath, answerKeyBytes);
    artifacts.push({
      ...artifact,
      examPath,
      answerKeyPath,
      examSha256: sha256(examBytes),
      answerKeySha256: sha256(answerKeyBytes),
      examBytes: examBytes.byteLength,
      answerKeyBytes: answerKeyBytes.byteLength,
      retrievedAt: downloadedAt,
    });
  }

  return {
    schemaVersion: 1,
    discoveryPath: options.discoveryPath ? resolve(options.discoveryPath) : '',
    outputDirectory,
    downloadedAt,
    artifacts,
    issues,
  };
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli() {
  const args = process.argv.slice(2);
  const discoveryPath = argument('--discovery', args) ?? '.runtime/enem-discovery-2025.json';
  const outputPath = argument('--out', args) ?? '.runtime/enem-download-2025.json';
  const outputDirectory = argument('--dir', args) ?? '.runtime/enem/2025';
  const discovery = JSON.parse(readFileSync(resolve(discoveryPath), 'utf8')) as EnemDiscoveryResult;
  const result = await downloadOfficialEnemArtifacts(discovery, {
    outputDirectory,
    discoveryPath,
  });
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const bytes = result.artifacts.reduce(
    (total, artifact) => total + artifact.examBytes + artifact.answerKeyBytes,
    0,
  );
  console.log(
    `ENEM_DOWNLOAD_OK artifacts=${result.artifacts.length} issues=${result.issues.length} bytes=${bytes} output=${resolvedOutput}`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
