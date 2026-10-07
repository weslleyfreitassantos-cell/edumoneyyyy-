import { describe, expect, it } from 'vitest';

import { buildEnemReadinessReport } from './readiness';
import type { CanonicalEnemQuestion } from './canonicalize';
import type { SubjectClassificationRecord } from './classification';

const baseQuestion = (id: string, language: CanonicalEnemQuestion['language'] = null): CanonicalEnemQuestion => ({
  canonicalId: id,
  year: 2025,
  day: 'D2',
  language,
  area: language ? 'LINGUAGENS' : 'MATEMATICA',
  statement: id,
  options: ['A', 'B', 'C', 'D', 'E'],
  officialAnswer: 'A',
  qualityState: 'PARSED',
  occurrences: [{ year: 2025, day: 'D2', booklet: 'CD5', questionNumber: Number(id.replace(/\D/g, '') || 1), language, officialAnswer: 'A' }],
});

const record = (question: CanonicalEnemQuestion, subject: SubjectClassificationRecord['subject']): SubjectClassificationRecord => ({
  canonical_id: question.canonicalId,
  area: question.area,
  subject,
  area_verified: true,
  subject_verified: Boolean(subject),
  review_state: subject ? 'VERIFIED' : 'REVIEW_REQUIRED',
  reason_code: 'TEST',
  source_fingerprint: 'x',
});

describe('ENEM readiness gates', () => {
  it('does not count a question without a rendered statement asset', () => {
    const question = baseQuestion('q-1');
    const report = buildEnemReadinessReport([question], [record(question, 'MATEMATICA')], {
      artifacts: [{ schemaVersion: 1, generatedAt: '', year: 2025, day: 'D2', booklet: 'CD5', examPath: '', artifactKey: '', questions: [{ questionNumber: 1, language: null, renderReady: false, sourceIntegrity: 'VERIFIED', excludedOptionLabels: [], planReason: null, statementAssets: [] }] }],
    });
    expect(report.subjectCounts.MATEMATICA).toBe(0);
    expect(report.eligible).toEqual([]);
  });
});
