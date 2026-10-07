import type { CanonicalEnemQuestion } from './canonicalize.ts';
import { ENEM_AREAS, ENEM_SUBJECTS, type SubjectClassificationRecord, type EnemArea, type EnemSubject } from './classification.ts';
import { renderQuestionKey, type EnemAssetRenderManifest } from './render-question-assets.ts';

export interface EnemReadinessReport {
  schemaVersion: 1;
  subjectCounts: Record<EnemSubject, number>;
  areaCounts: Record<EnemArea, number>;
  languageCounts: { common: number; english: number; spanish: number };
  subjectReady: Record<EnemSubject, boolean>;
  areaReady: Record<EnemArea, boolean>;
  allSubjectsReady: boolean;
  allAreasReady: boolean;
  eligible: string[];
  issues: string[];
}

const emptyCounts = <T extends string>(values: readonly T[]) =>
  Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;

function renderReadyIds(assets: { artifacts?: EnemAssetRenderManifest[] } | undefined) {
  return new Set((assets?.artifacts ?? []).flatMap((artifact) => artifact.questions.filter((question) => question.renderReady).map((question) => renderQuestionKey(artifact, question.questionNumber, question.language))));
}

export function buildEnemReadinessReport(
  questions: CanonicalEnemQuestion[],
  registry: SubjectClassificationRecord[],
  assets?: { artifacts: EnemAssetRenderManifest[] },
  options: { subjectMinimum?: number; areaMinimum?: number; languagesCommonMinimum?: number; languageMinimum?: number } = {},
): EnemReadinessReport {
  const subjectMinimum = options.subjectMinimum ?? 10;
  const areaMinimum = options.areaMinimum ?? 45;
  const languagesCommonMinimum = options.languagesCommonMinimum ?? 40;
  const languageMinimum = options.languageMinimum ?? 5;
  const registryById = new Map(registry.map((record) => [record.canonical_id, record]));
  const readyAssets = renderReadyIds(assets);
  const subjectCounts = emptyCounts(ENEM_SUBJECTS);
  const areaCounts = emptyCounts(ENEM_AREAS);
  const eligible: string[] = [];
  for (const question of questions) {
    const record = registryById.get(question.canonicalId);
    const renderReady = question.occurrences.some((occurrence) => readyAssets.has(renderQuestionKey(occurrence, occurrence.questionNumber, occurrence.language)));
    const validAnswer = /^[A-E]$/.test(question.officialAnswer) && question.options.length === 5;
    if (!record?.area_verified || !renderReady || !validAnswer || question.officialAnswer === 'ANNULLED') continue;
    areaCounts[record.area!] += 1;
    if (record.subject_verified && record.subject) subjectCounts[record.subject] += 1;
    eligible.push(question.canonicalId);
  }
  const languageCounts = {
    common: questions.filter((question) => {
      const record = registryById.get(question.canonicalId);
      const occurrence = question.occurrences.find((item) => readyAssets.has(renderQuestionKey(item, item.questionNumber, item.language)));
      return record?.area === 'LINGUAGENS' && occurrence?.language === null && eligible.includes(question.canonicalId);
    }).length,
    english: questions.filter((question) => {
      const record = registryById.get(question.canonicalId);
      return record?.area === 'LINGUAGENS' && record.subject === 'INGLES' && eligible.includes(question.canonicalId);
    }).length,
    spanish: questions.filter((question) => {
      const record = registryById.get(question.canonicalId);
      return record?.area === 'LINGUAGENS' && record.subject === 'ESPANHOL' && eligible.includes(question.canonicalId);
    }).length,
  };
  const subjectReady = Object.fromEntries(ENEM_SUBJECTS.map((subject) => [subject, subjectCounts[subject] >= subjectMinimum])) as Record<EnemSubject, boolean>;
  const areaReady = Object.fromEntries(ENEM_AREAS.map((area) => [area, area === 'LINGUAGENS' ? languageCounts.common >= languagesCommonMinimum : areaCounts[area] >= areaMinimum])) as Record<EnemArea, boolean>;
  const issues: string[] = [];
  for (const subject of ENEM_SUBJECTS) if (!subjectReady[subject]) issues.push(`SUBJECT_POOL_BELOW_MINIMUM:${subject}:${subjectCounts[subject]}<${subjectMinimum}`);
  for (const area of ENEM_AREAS) if (!areaReady[area]) issues.push(`AREA_POOL_BELOW_MINIMUM:${area}:${areaCounts[area]}`);
  if (languageCounts.common < languagesCommonMinimum) issues.push(`LANGUAGE_COMMON_POOL_BELOW_MINIMUM:${languageCounts.common}<${languagesCommonMinimum}`);
  if (languageCounts.english < languageMinimum) issues.push(`LANGUAGE_POOL_BELOW_MINIMUM:ENGLISH:${languageCounts.english}<${languageMinimum}`);
  if (languageCounts.spanish < languageMinimum) issues.push(`LANGUAGE_POOL_BELOW_MINIMUM:SPANISH:${languageCounts.spanish}<${languageMinimum}`);
  return {
    schemaVersion: 1,
    subjectCounts,
    areaCounts,
    languageCounts,
    subjectReady,
    areaReady,
    allSubjectsReady: Object.values(subjectReady).every(Boolean),
    allAreasReady: Object.values(areaReady).every(Boolean) && languageCounts.english >= languageMinimum && languageCounts.spanish >= languageMinimum,
    eligible: [...new Set(eligible)],
    issues,
  };
}

export interface PromotionSelectionItem {
  canonical_id: string;
  primary_occurrence: CanonicalEnemQuestion['occurrences'][number];
  year: number;
  day: string;
  booklet: string;
  language: CanonicalEnemQuestion['language'];
  area: EnemArea;
  subject: EnemSubject | null;
  purpose: 'SUBJECT' | 'AREA' | 'BOTH';
}

export function buildPromotionSelection(
  questions: CanonicalEnemQuestion[],
  registry: SubjectClassificationRecord[],
  report: EnemReadinessReport,
  assets?: { artifacts: EnemAssetRenderManifest[] },
  options: { subjectTarget?: number; areaTarget?: number; commonTarget?: number; languageTarget?: number } = {},
) {
  const subjectTarget = options.subjectTarget ?? 15;
  const areaTarget = options.areaTarget ?? 60;
  const commonTarget = options.commonTarget ?? 50;
  const languageTarget = options.languageTarget ?? 10;
  const registryById = new Map(registry.map((record) => [record.canonical_id, record]));
  const readyAssets = renderReadyIds(assets);
  const eligible = questions.filter((question) => report.eligible.includes(question.canonicalId));
  const picked = new Map<string, PromotionSelectionItem>();
  const add = (question: CanonicalEnemQuestion, purpose: 'SUBJECT' | 'AREA') => {
    const record = registryById.get(question.canonicalId);
    if (!record?.area || !question.occurrences.length) return;
    const occurrence = question.occurrences.find((item) => readyAssets.has(renderQuestionKey(item, item.questionNumber, item.language))) ?? question.occurrences[0];
    const existing = picked.get(question.canonicalId);
    if (existing) {
      existing.purpose = existing.purpose === purpose ? purpose : 'BOTH';
      return;
    }
    picked.set(question.canonicalId, {
      canonical_id: question.canonicalId,
      primary_occurrence: occurrence,
      year: occurrence.year,
      day: occurrence.day,
      booklet: occurrence.booklet,
      language: question.language,
      area: record.area,
      subject: record.subject,
      purpose,
    });
  };
  for (const subject of ENEM_SUBJECTS) {
    eligible.filter((question) => registryById.get(question.canonicalId)?.subject === subject).slice(0, subjectTarget).forEach((question) => add(question, 'SUBJECT'));
  }
  for (const area of ENEM_AREAS) {
    const areaQuestions = eligible.filter((question) => registryById.get(question.canonicalId)?.area === area);
    if (area === 'LINGUAGENS') {
      areaQuestions.filter((question) => question.language === null && registryById.get(question.canonicalId)?.subject === 'LINGUA_PORTUGUESA').slice(0, commonTarget).forEach((question) => add(question, 'AREA'));
      areaQuestions.filter((question) => question.language === 'ENGLISH').slice(0, languageTarget).forEach((question) => add(question, 'AREA'));
      areaQuestions.filter((question) => question.language === 'SPANISH').slice(0, languageTarget).forEach((question) => add(question, 'AREA'));
    } else {
      areaQuestions.slice(0, areaTarget).forEach((question) => add(question, 'AREA'));
    }
  }
  return [...picked.values()];
}
