import { describe, expect, it } from 'vitest';

import { buildEnemPromotionParity, buildEnemReadinessReport, buildPromotionSelection } from './readiness';
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
  sourceIntegrity: 'VERIFIED',
  statementIntegrity: 'VERIFIED',
  optionsIntegrity: 'VERIFIED',
  controlCharCount: 0,
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

  it('includes an unclassified common-language question in the area pool only', () => {
    const question = baseQuestion('common-1', null);
    question.area = 'LINGUAGENS';
    const classification = record(question, null);
    const assets = {
      artifacts: [{
        schemaVersion: 1,
        generatedAt: '',
        year: 2025,
        day: 'D2',
        booklet: 'CD5',
        examPath: '',
        artifactKey: '',
        questions: [{ questionNumber: 1, language: null, renderReady: true, sourceIntegrity: 'VERIFIED' as const, excludedOptionLabels: ['A', 'B', 'C', 'D', 'E'], planReason: null, statementAssets: [] }],
      }],
    };
    const report = buildEnemReadinessReport([question], [classification], assets, { subjectMinimum: 1, areaMinimum: 1, languagesCommonMinimum: 1, languageMinimum: 1 });
    const selection = buildPromotionSelection([question], [classification], report, assets, { subjectTarget: 0, areaTarget: 0, commonTarget: 1, languageTarget: 0 });
    expect(selection).toHaveLength(1);
    expect(selection[0].area).toBe('LINGUAGENS');
    expect(selection[0].subject).toBeNull();
    expect(report.subjectCounts.LINGUA_PORTUGUESA).toBe(0);
  });

  it('preserves forty common-language questions through selection and asset planning', () => {
    const questions = Array.from({ length: 40 }, (_, index) => {
      const item = baseQuestion(`common-${index + 1}`, null);
      item.area = 'LINGUAGENS';
      item.occurrences[0].questionNumber = index + 1;
      return item;
    });
    const classifications = questions.map((item) => record(item, null));
    const assets = {
      artifacts: [{
        schemaVersion: 1,
        generatedAt: '',
        year: 2025,
        day: 'D2',
        booklet: 'CD5',
        examPath: '',
        artifactKey: '',
        questions: questions.map((item) => ({ questionNumber: item.occurrences[0].questionNumber, language: null, renderReady: true, sourceIntegrity: 'VERIFIED' as const, excludedOptionLabels: ['A', 'B', 'C', 'D', 'E'], planReason: null, statementAssets: [] })),
      }],
    };
    const report = buildEnemReadinessReport(questions, classifications, assets, { subjectMinimum: 1, areaMinimum: 1, languagesCommonMinimum: 40, languageMinimum: 1 });
    const selection = buildPromotionSelection(questions, classifications, report, assets, { subjectTarget: 0, areaTarget: 0, commonTarget: 40, languageTarget: 0 });
    const assetPlan = selection.map((item) => ({ canonical_id: item.canonical_id, area: item.area, language: item.language }));
    const parity = buildEnemPromotionParity(report, selection, assetPlan);
    expect(report.languageCounts.common).toBe(40);
    expect(parity.selected.languagesCommon).toBe(40);
    expect(parity.assetPlanned.languagesCommon).toBe(40);
    expect(parity.issues).not.toContain('PROMOTION_LANGUAGENS_COMMON_BELOW_TARGET:40<40');
  });

  it('keeps English and Spanish pools separated by official language', () => {
    const questions = ['ENGLISH', 'SPANISH'].flatMap((language) => Array.from({ length: 5 }, (_, index) => {
      const item = baseQuestion(`${language}-${index + 1}`, language as CanonicalEnemQuestion['language']);
      item.area = 'LINGUAGENS';
      item.occurrences[0].questionNumber = index + 1;
      return item;
    }));
    const classifications = questions.map((item) => record(item, item.language === 'ENGLISH' ? 'INGLES' : 'ESPANHOL'));
    const assets = {
      artifacts: ['ENGLISH', 'SPANISH'].map((language) => ({
        schemaVersion: 1,
        generatedAt: '',
        year: 2025,
        day: 'D2',
        booklet: 'CD5',
        examPath: '',
        artifactKey: '',
        questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, language, renderReady: true, sourceIntegrity: 'VERIFIED' as const, excludedOptionLabels: ['A', 'B', 'C', 'D', 'E'], planReason: null, statementAssets: [] })),
      })),
    };
    const report = buildEnemReadinessReport(questions, classifications, assets, { subjectMinimum: 1, areaMinimum: 1, languagesCommonMinimum: 1, languageMinimum: 5 });
    const selection = buildPromotionSelection(questions, classifications, report, assets, { subjectTarget: 0, areaTarget: 0, commonTarget: 0, languageTarget: 5 });
    expect(selection.filter((item) => item.language === 'ENGLISH')).toHaveLength(5);
    expect(selection.filter((item) => item.language === 'SPANISH')).toHaveLength(5);
  });
});
