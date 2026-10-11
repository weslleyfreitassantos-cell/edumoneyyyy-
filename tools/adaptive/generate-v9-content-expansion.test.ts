import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildV9ContentExpansionMigration, validateV9Expansion } from './generate-v9-content-expansion';

const questionPacks = [1, 2, 3].map((version) => JSON.parse(readFileSync(new URL(`../../content/adaptive/tec-escola-core-v9/question-expansion-v${version}.json`, import.meta.url), 'utf8')) as {
  pedagogicalReviewStatus: string;
  questions: Array<{ id: string; skill: string; purpose: string; statement: string; options: string[]; correctAnswer: string; explanation: string; errorFocus: string; remediationHint: string }>;
});
const pack = { ...questionPacks[0], questions: questionPacks.flatMap((content) => content.questions) };
const lessonPacks = [1, 2].map((version) => JSON.parse(readFileSync(new URL(`../../content/adaptive/tec-escola-core-v9/lesson-expansion-v${version}.json`, import.meta.url), 'utf8')) as {
  pedagogicalReviewStatus: string;
  lessons: Array<{ skill: string; title: string; objective: string; priorKnowledge: string[]; keyConcepts: string[]; progressiveExplanation: string[]; workedExample: string; everydayApplication: string; commonErrors: string[]; summary: string; practiceGuidance: string; remediations: Array<{ explanation: string; workedExample: string; selfCheck: string }> }>;
});
const lessonPack = { ...lessonPacks[0], lessons: lessonPacks.flatMap((content) => content.lessons) };
const migrationPath = new URL('../../supabase/migrations/20261011000500_bncc_v9_content_expansion_v1.sql', import.meta.url);

describe('V9 authored content expansion', () => {
  it('validates distinct authored purpose pools for all twelve school subjects without claiming human review', () => {
    expect(validateV9Expansion()).toEqual([]);
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.questions).toHaveLength(152);
    expect(new Set(pack.questions.map((question) => question.skill)).size).toBe(12);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(152);
    expect(new Set(pack.questions.map((question) => question.statement.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())).size).toBe(152);
    for (const skill of new Set(pack.questions.map((question) => question.skill))) {
      const questions = pack.questions.filter((question) => question.skill === skill);
      const expectedCount = ['ART_COMPARE_COMPOSITIONS', 'BIOLOGY_CELL_FUNCTION', 'CHEMISTRY_STOICHIOMETRY', 'GEOGRAPHY_INTERPRET_TERRITORY', 'HISTORY_INTERPRET_EVIDENCE', 'PHILOSOPHY_EVALUATE_ARGUMENT', 'PE_ANALYZE_MOVEMENT', 'SOCIOLOGY_EXPLAIN_INSTITUTIONS'].includes(skill) ? 13 : 12;
      expect(questions).toHaveLength(expectedCount);
      expect(questions.filter((question) => question.purpose === 'PRACTICE')).toHaveLength(expectedCount === 13 ? 5 : 4);
      expect(questions.every((question) => question.options.length === 4 && question.options.includes(question.correctAnswer))).toBe(true);
      expect(questions.every((question) => question.explanation && question.errorFocus && question.remediationHint)).toBe(true);
    }
  });

  it('provides twelve structured lessons with worked examples and two targeted remediation cards each', () => {
    expect(lessonPack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(lessonPack.lessons).toHaveLength(12);
    for (const lesson of lessonPack.lessons) {
      expect(lesson.objective.length).toBeGreaterThan(50);
      expect(lesson.priorKnowledge.length).toBeGreaterThanOrEqual(2);
      expect(lesson.keyConcepts.length).toBeGreaterThanOrEqual(3);
      expect(lesson.progressiveExplanation.length).toBeGreaterThanOrEqual(3);
      expect(lesson.workedExample.length).toBeGreaterThan(240);
      expect(lesson.commonErrors.length).toBeGreaterThanOrEqual(3);
      expect(lesson.remediations).toHaveLength(2);
      expect(lesson.remediations.every((remediation) => remediation.explanation && remediation.workedExample && remediation.selfCheck)).toBe(true);
    }
  });

  it('checks independently calculated answer keys for stoichiometry and average speed', () => {
    const answerById = new Map(pack.questions.map((question) => [question.id, question.correctAnswer]));
    const checkedAnswers: Record<string, string> = {
      'v9-chem-stoich-01': '4 mol',
      'v9-chem-stoich-02': '3 mol de H₂ para 2 mol de NH₃.',
      'v9-chem-stoich-03': '4 mol',
      'v9-chem-stoich-04': 'Cl₂ limita; formam-se 4 mol de NaCl.',
      'v9-chem-stoich-05': 'A equação precisa ser balanceada como 2 H₂ + O₂ → 2 H₂O para conservar o número de átomos de cada elemento.',
      'v9-chem-stoich-06': '3 mol',
      'v9-chem-stoich-07': '3 mol',
      'v9-chem-stoich-08': '5 mol',
      'v9-chem-stoich-09': '75%',
      'v9-chem-stoich-10': '14 mol',
      'v9-chem-stoich-11': '44 g',
      'v9-chem-stoich-12': '2 mol',
      'v9-chem-stoich-13': 'B é limitante, formam-se 2 mol de AB₂ e sobra 1 mol de A.',
      'v9-physics-speed-09': '60 m/min',
      'v9-physics-speed-10': '12 km/h',
      'v9-physics-speed-11': '36 km/h',
      'v9-physics-speed-12': '26,67 km/h',
      'v9-physics-speed-13': '12 km/h',
      'v9-physics-speed-14': '48 km/h, pois a distância total é dividida pelo tempo total de 1 h.',
      'v9-physics-speed-15': '36 km/h',
      'v9-physics-speed-16': '3 km/h',
      'v9-physics-speed-17': '36 km/h',
      'v9-physics-speed-18': '60 km/h, porque 2,5 h é o intervalo e 150 ÷ 2,5 = 60.',
      'v9-physics-speed-19': '2,67 m/s',
      'v9-physics-speed-20': 'A velocidade média de A é 60 km/h e a de B é 45 km/h.',
    };
    for (const [questionId, expected] of Object.entries(checkedAnswers)) expect(answerById.get(questionId)).toBe(expected);
  });

  it('keeps the SQL migration reproducible and labels content as authored demo preview', () => {
    const checkedIn = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
    const generated = buildV9ContentExpansionMigration().replace(/\r\n/g, '\n');
    expect(generated).toBe(checkedIn);
    expect(generated.match(/'TECESCOLA_V9_AUTHORIAL_V1'/g)).toHaveLength(152);
    expect(generated).toContain("'pedagogical_review_status','PEDAGOGICAL_REVIEW_PENDING'");
    expect(generated).toContain('"demo_preview_only":true');
    expect(generated).not.toContain('PEDAGOGICAL_REVIEWED');
    expect(generated).not.toContain("'bncc_alignment_status','MAPPED'");
  });
});
