import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildEnemIngestionOutput,
  enemManifestKey,
  type EnemManifestEntry,
  type EnemQuestionInput,
} from '../../src/services/enemIngestion';

const manifest = JSON.parse(
  readFileSync(new URL('./manifest.v1.json', import.meta.url), 'utf8'),
) as { entries: EnemManifestEntry[] };
const questions = JSON.parse(
  readFileSync(new URL('./fixtures/2023-d2-cd5-math.json', import.meta.url), 'utf8'),
) as EnemQuestionInput[];

describe('verified ENEM manifest', () => {
  it('contains a reviewed official artifact and one imported question', () => {
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]).toMatchObject({
      year: 2023,
      exam: 'ENEM',
      application: 'REGULAR',
      day: 'D2',
      artifactHash: '818b89dec87eb0b77bf77f96d3e744502c7bdffb57166d2b5137beb3a6b9ac59',
    });
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({ questionNumber: 136, correctAnswer: '7', canonicalSkillCode: 'RATIO_PROPORTION' });
  });

  it('normalizes the official provenance without manufacturing rows', () => {
    const output = buildEnemIngestionOutput(
      manifest.entries,
      new Map([[enemManifestKey(manifest.entries[0]), questions]]),
    );

    expect(output.entries).toHaveLength(1);
    expect(output.questions).toHaveLength(1);
    expect(output.questions[0]).toMatchObject({
      sourceReference: manifest.entries[0].sourceReference,
      artifactHash: manifest.entries[0].artifactHash,
      questionNumber: 136,
      correctAnswer: '7',
    });
  });
});
