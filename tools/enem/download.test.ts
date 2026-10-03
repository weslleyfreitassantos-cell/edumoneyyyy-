import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { downloadOfficialEnemArtifacts } from './download';
import type { EnemDiscoveryResult } from './discover';

const discovery: EnemDiscoveryResult = {
  schemaVersion: 1,
  catalogReference: 'https://www.gov.br/inep/enem/provas-e-gabaritos',
  discoveredAt: '2026-10-03T00:00:00.000Z',
  years: [{ year: 2025, url: 'https://www.gov.br/inep/enem/provas-e-gabaritos/2025' }],
  artifacts: [{
    year: 2025,
    exam: 'ENEM',
    application: 'REGULAR',
    day: 'D1',
    booklet: 'CD1',
    sourceReference: 'https://www.gov.br/inep/enem/provas-e-gabaritos/2025',
    examUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D1_CD1.pdf',
    answerKeyUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_GB_impresso_D1_CD1.pdf',
  }],
  issues: [],
};

describe('ENEM official downloader', () => {
  it('downloads paired PDFs and records deterministic provenance metadata', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'tecescola-enem-'));
    const calls: string[] = [];
    try {
      const result = await downloadOfficialEnemArtifacts(discovery, {
        outputDirectory: directory,
        discoveryPath: '.runtime/enem-discovery-2025.json',
        now: new Date('2026-10-03T10:00:00.000Z'),
        fetchBinary: async (url) => {
          calls.push(url);
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => Buffer.from('%PDF-1.7 official fixture'),
          };
        },
      });

      expect(calls).toEqual([discovery.artifacts[0].examUrl, discovery.artifacts[0].answerKeyUrl]);
      expect(result.artifacts[0]).toMatchObject({
        year: 2025,
        day: 'D1',
        booklet: 'CD1',
        examBytes: 25,
        answerKeyBytes: 25,
        retrievedAt: '2026-10-03T10:00:00.000Z',
      });
      expect(readFileSync(result.artifacts[0].examPath).subarray(0, 5).toString()).toBe('%PDF-');
      expect(readFileSync(result.artifacts[0].answerKeyPath).subarray(0, 5).toString()).toBe('%PDF-');
      expect(result.artifacts[0].examSha256).toBe(result.artifacts[0].answerKeySha256);
      expect(result.issues).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects non-PDF responses before writing an artifact', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'tecescola-enem-'));
    try {
      const result = await downloadOfficialEnemArtifacts(discovery, {
        outputDirectory: directory,
        fetchBinary: async () => ({
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from('not a pdf'),
        }),
      });
      expect(result.artifacts).toEqual([]);
      expect(result.issues).toEqual([
        'ENEM_ARTIFACT_QUARANTINED:2025_D1_CD1:ENEM_ARTIFACT_NOT_PDF:2025_D1_CD1:PV',
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
