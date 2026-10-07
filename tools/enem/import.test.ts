import { describe, expect, it } from 'vitest';

import { buildEnemImportPlan, selectCanaryQuestions } from './import';

describe('ENEM import plan', () => {
  it('imports only source-parsed questions and keeps pedagogical state explicit', () => {
    const plan = buildEnemImportPlan({
      downloads: { artifacts: [{
        year: 2025, exam: 'ENEM', application: 'REGULAR', day: 'D2', booklet: 'CD5',
        sourceReference: 'https://www.gov.br/inep', examUrl: 'https://download.inep.gov.br/exam.pdf', answerKeyUrl: 'https://download.inep.gov.br/key.pdf',
        examPath: '', answerKeyPath: '', examSha256: 'a'.repeat(64), answerKeySha256: 'b'.repeat(64), examBytes: 1, answerKeyBytes: 1, retrievedAt: '2026-10-03T00:00:00.000Z',
      }] },
      parsed: { schemaVersion: 1, parsedAt: '2026-10-03T00:00:00.000Z', issues: [], artifacts: [{
        year: 2025, day: 'D2', booklet: 'CD5', examPath: '', answerKeyPath: '', answerKey: [], qualityState: 'PARSED', issues: [], questions: [{
          questionNumber: 136, language: null, page: 2, area: 'MATEMATICA', statement: 'Qual é o resultado?', supportText: null,
          options: ['1', '2', '3', '4', '5'], officialAnswer: 'C', mediaStatus: 'NOT_DETECTED', qualityState: 'PARSED', reviewReasons: [],
        }],
      }] },
      canonical: { canonicalQuestions: [{
        canonicalId: 'canonical-1', year: 2025, day: 'D2', language: null, area: 'MATEMATICA', statement: 'Qual é o resultado?', options: ['1', '2', '3', '4', '5'], officialAnswer: 'C', qualityState: 'PARSED',
        occurrences: [{ year: 2025, day: 'D2', booklet: 'CD5', questionNumber: 136, language: null, officialAnswer: 'C' }],
      }] },
      manifest: { manifestFingerprint: 'f'.repeat(64), manifestVersion: 'TEST', years: [2025], artifactCount: 1, canonicalQuestionCount: 1, occurrenceCount: 1 },
    });
    expect(plan.playableQuestions).toBe(1);
    expect(plan.simulations).toBe(15);
    expect(plan.sql).toContain("source_integrity");
    expect(plan.sql).toContain("pedagogical_enrichment");
    expect(plan.sql).toContain('\'"3"\'::jsonb');
    expect(plan.sql).toContain("source_year, question_count");
    expect(plan.sql).toContain("'Matemática e suas Tecnologias'");
  });

  it('selects a small deterministic canary across areas', () => {
    const questions = Array.from({ length: 20 }, (_, index) => ({
      canonicalId: `q-${index}`, year: 2025, day: 'D2', language: null, area: index < 5 ? 'MATEMATICA' : index < 10 ? 'LINGUAGENS' : index < 15 ? 'CIENCIAS_NATUREZA' : 'CIENCIAS_HUMANAS', statement: `Questão ${index} válida`, options: ['1', '2', '3', '4', '5'], officialAnswer: 'A' as const, qualityState: 'PARSED' as const,
      occurrences: [],
    }));
    expect(selectCanaryQuestions(questions)).toHaveLength(12);
    expect(new Set(selectCanaryQuestions(questions).map((question) => question.area))).toHaveProperty('size', 4);
  });
});
