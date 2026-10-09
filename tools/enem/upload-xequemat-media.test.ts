import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { buildXequematMediaUploadPlan } from './upload-xequemat-media';
import type { XequematArchiveReport } from './xequemat-archive';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function reportFor(archivePath: string, canonicalPath = 'enem/xequemat-archive-v1/test-image.png') {
  return {
    schemaVersion: 1,
    provider: 'xequemat',
    contentRevision: 'xequemat-archive-v1',
    source: { input: 'snapshot.zip', extractedRoot: null },
    rightsStatus: 'VERIFIED',
    scannedFiles: 1,
    parsedQuestions: 1,
    uniqueQuestions: 1,
    duplicateQuestions: 0,
    readyQuestions: 1,
    rejectedQuestions: 0,
    missingMediaReferences: 0,
    missingMediaQuestions: 0,
    byApplication: { REGULAR: 1 },
    byYear: { '2020': 1 },
    rejectionReasons: {},
    records: [{
      provider: 'xequemat', contentRevision: 'xequemat-archive-v1', providerQuestionKey: 'REGULAR:2020:1:COMMON:test',
      sourceFile: 'question/index.html', sourceUrl: 'https://example.test/question', title: 'Questão 1', year: 2020, questionNumber: 1,
      application: 'REGULAR', area: 'MATEMATICA', subject: null, language: null, day: 1, blocks: [{ kind: 'IMAGE', media: [] }],
      contextText: 'Contexto', promptText: 'Pergunta', alternatives: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: letter, blocks: [], media: [] })),
      correctAlternative: 'A', explanationText: null,
      media: [{ source: 'https://example.test/image.png', alt: '', archivePath, canonicalPath, missing: false }],
      normalizedContentHash: 'normalized', sourceHash: 'source', completeStatement: true, completeAlternatives: true, answerPresent: true,
      requiredMediaPresent: true, rightsStatus: 'VERIFIED', ready: true, rejectionReasons: [],
    }],
  } as XequematArchiveReport;
}

describe('Xequemat media upload plan', () => {
  it('resolves ready media inside the archive and records its content hash', () => {
    const root = mkdtempSync(join(tmpdir(), 'xequemat-media-test-'));
    temporaryDirectories.push(root);
    const archivePath = 'xequematenem.com.br/image.png';
    const bytes = Buffer.from('official-image');
    mkdirSync(join(root, 'xequematenem.com.br'), { recursive: true });
    writeFileSync(join(root, archivePath), bytes);

    const [asset] = buildXequematMediaUploadPlan(reportFor(archivePath), root);
    expect(asset).toMatchObject({
      canonicalPath: 'enem/xequemat-archive-v1/test-image.png',
      archivePath,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      status: 'UPLOADED',
      mimeType: 'image/png',
    });
  });

  it('rejects media that escapes the extracted archive', () => {
    const root = mkdtempSync(join(tmpdir(), 'xequemat-media-test-'));
    temporaryDirectories.push(root);
    expect(() => buildXequematMediaUploadPlan(reportFor('../outside.png'), root)).toThrow(/not present inside/);
  });
});
