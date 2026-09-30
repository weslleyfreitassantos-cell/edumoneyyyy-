import { describe, expect, it } from 'vitest';

import {
  assertOfficialEnemReference,
  buildEnemIngestionOutput,
  enemManifestKey,
  parseEnemQuestionRows,
  validateEnemManifest,
} from './enemIngestion';

const manifest = {
  year: 2025,
  exam: 'ENEM',
  application: 'regular',
  day: '1',
  sourceReference: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos',
  artifactHash: null,
  downloadUrl: null,
};

describe('ENEM ingestion contract', () => {
  it('accepts only HTTPS references under official INEP/gov.br domains', () => {
    expect(assertOfficialEnemReference(manifest.sourceReference)).toContain('gov.br');
    expect(() => assertOfficialEnemReference('https://example.com/enem.pdf')).toThrow('NOT_OFFICIAL');
    expect(() => assertOfficialEnemReference('http://www.gov.br/enem')).toThrow('NOT_OFFICIAL');
  });

  it('rejects duplicate manifest entries deterministically', () => {
    expect(() => validateEnemManifest([manifest, manifest])).toThrow('DUPLICATE');
  });

  it('preserves official provenance while keeping classification derived', () => {
    const [question] = parseEnemQuestionRows([
      {
        questionNumber: 42,
        area: 'Matemática e suas Tecnologias',
        statement: 'Uma questão oficial.',
        options: ['A', 'B', 'C', 'D', 'E'],
        correctAnswer: 'C',
        subject: 'Matemática',
        topic: 'Funções',
        canonicalSkillCode: 'LINEAR_FUNCTION',
        difficulty: 'MEDIUM',
      },
    ], manifest);

    expect(question).toMatchObject({
      year: 2025,
      questionNumber: 42,
      correctAnswer: 'C',
      sourceReference: manifest.sourceReference,
      classification: {
        subject: 'Matemática',
        topic: 'Funções',
        canonicalSkillCode: 'LINEAR_FUNCTION',
      },
    });
  });

  it('builds a deterministic normalized batch without inventing questions', () => {
    const output = buildEnemIngestionOutput(
      [manifest],
      new Map([[enemManifestKey(manifest), [{
        questionNumber: 42,
        area: 'Matemática e suas Tecnologias',
        statement: 'Uma questão oficial.',
        options: ['A', 'B', 'C', 'D', 'E'],
        correctAnswer: 'C',
      }]]]),
    );

    expect(output.schemaVersion).toBe(1);
    expect(output.entries).toHaveLength(1);
    expect(output.questions).toHaveLength(1);
    expect(output.questions[0].sourceReference).toBe(manifest.sourceReference);
  });
});
