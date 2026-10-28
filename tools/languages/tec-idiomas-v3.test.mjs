import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { compileCourses, generateCorrectionSql, generateInsertSql, generateArtifacts, validateCourses } from './tec-idiomas-v3.mjs';
import { seededExerciseOrder } from '../../src/lib/tecEnglishExerciseOrder';

const expected = new Map([
  ['TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', [4, 16, 112, 'en_v2x_']],
  ['TEC_SPANISH_FOUNDATIONS_V1', [2, 8, 56, 'es_v1_']],
  ['TEC_KOREAN_FOUNDATIONS_V1', [2, 8, 56, 'ko_v1_']],
]);
const expectedProductionFingerprints = {
  TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION: 'a'.repeat(32),
  TEC_SPANISH_FOUNDATIONS_V1: 'b'.repeat(32),
  TEC_KOREAN_FOUNDATIONS_V1: 'c'.repeat(32),
};

describe('Tec Idiomas V3 content package', () => {
  const courses = compileCourses();

  it('contains the three authored courses at their exact target counts', () => {
    expect(validateCourses(courses)).toEqual([]);
    expect(courses.map(({ course, units, manifest }) => [course.code, units.length, manifest.lesson_count, manifest.exercise_count]))
      .toEqual([...expected].map(([code, [units, lessons, exercises]]) => [code, units, lessons, exercises]));
  });

  it('keeps IDs and skill domains unique and gives every lesson all seven exercise modes', () => {
    const ids = new Set();
    for (const item of courses) {
      const [, , , skillPrefix] = expected.get(item.course.code);
      for (const unit of item.units) for (const lesson of unit.lessons) {
        expect(lesson.exercises.map((exercise) => exercise.exercise_type).sort()).toEqual([
          'FILL_BLANK', 'LISTENING', 'MATCHING', 'MULTIPLE_CHOICE', 'SPEAKING', 'TRANSLATION', 'WORD_ORDER',
        ]);
        for (const record of [lesson, ...lesson.exercises]) {
          expect(ids.has(record.id)).toBe(false);
          ids.add(record.id);
        }
        for (const exercise of lesson.exercises) expect(exercise.skill_code.startsWith(skillPrefix)).toBe(true);
      }
    }
  });

  it('keeps 224 STAGING exercises, aligns all listening answers with Portuguese prompts, and preserves grading keys', () => {
    const exercises = courses.flatMap((course) => course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises)));
    expect(exercises).toHaveLength(224);
    expect(exercises.filter((exercise) => exercise.exercise_type === 'LISTENING')).toHaveLength(32);
    expect(exercises.filter((exercise) => ['MULTIPLE_CHOICE', 'FILL_BLANK'].includes(exercise.exercise_type))).toHaveLength(64);
    for (const exercise of exercises) {
      expect(exercise.publication_status).toBe('STAGING');
      expect(exercise.review_status).toBe('PEDAGOGICAL_REVIEW_PENDING');
      if (exercise.exercise_type === 'LISTENING') {
        expect(exercise.instruction).toBe('Ouça e responda em português.');
        expect(exercise.accepted_answers).not.toEqual(expect.arrayContaining([expect.stringMatching(/[가-힣]/u)]));
      }
      if (exercise.exercise_type !== 'MATCHING') expect(exercise.answer_key.accepted).toEqual(exercise.accepted_answers);
      if (['MULTIPLE_CHOICE', 'FILL_BLANK'].includes(exercise.exercise_type)) {
        expect(exercise.options.length).toBeGreaterThanOrEqual(3);
        expect(new Set(exercise.options).size).toBe(exercise.options.length);
        expect(exercise.answer_key.accepted.every((answer) => exercise.options.includes(answer))).toBe(true);
      }
    }
  });

  it('generates every word bank as a reproducible Fisher–Yates permutation, preserving repeated tokens', () => {
    const exercises = courses.flatMap((course) => course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises)))
      .filter((exercise) => exercise.exercise_type === 'WORD_ORDER');
    const rerun = compileCourses().flatMap((course) => course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises)))
      .filter((exercise) => exercise.exercise_type === 'WORD_ORDER');
    expect(exercises).toHaveLength(32);
    for (let index = 0; index < exercises.length; index += 1) {
      const answerTokens = [...exercises[index].answer_key.accepted[0].trim().split(/\s+/)].sort();
      expect([...exercises[index].word_bank].sort()).toEqual(answerTokens);
      expect(rerun[index].word_bank).toEqual(exercises[index].word_bank);
    }
    expect(exercises.some((exercise) => exercise.word_bank.join(' ') !== exercise.answer_key.accepted[0])).toBe(true);
  });

  it('does not put every objective answer in the same displayed position in one session', () => {
    const exercises = courses.flatMap((course) => course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises)))
      .filter((exercise) => ['MULTIPLE_CHOICE', 'FILL_BLANK'].includes(exercise.exercise_type));
    const correctPositions = exercises.map((exercise) => {
      const correctIndex = exercise.options.findIndex((option) => exercise.accepted_answers.includes(option));
      return seededExerciseOrder(exercise.options.length, `same-session:${exercise.id}:options`).indexOf(correctIndex);
    });
    expect(new Set(correctPositions).size).toBeGreaterThan(1);
  });

  it('never places the expected answer in the pre-response dialogue', () => {
    const dialogues = courses.flatMap((course) => course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises)))
      .filter((exercise) => exercise.exercise_type === 'MULTIPLE_CHOICE');
    expect(dialogues).toHaveLength(32);
    for (const exercise of dialogues) {
      const expectedAnswer = exercise.answer_key.accepted[0];
      expect(exercise.dialogue_context.length).toBeLessThanOrEqual(1);
      expect(JSON.stringify(exercise.dialogue_context)).not.toContain(expectedAnswer);
      if (exercise.dialogue_context.length) expect(exercise.dialogue_context[0].speaker).not.toBe('Você');
    }
  });

  it('rejects a pre-response dialogue that contains the full expected answer as a token sequence', () => {
    const leakedCourses = structuredClone(courses);
    const exercise = leakedCourses[0].units[0].lessons[0].exercises.find((item) => item.exercise_type === 'MULTIPLE_CHOICE');
    exercise.dialogue_context[0].text += `  ${exercise.answer_key.accepted[0].toLocaleLowerCase()} `;
    expect(validateCourses(leakedCourses)).toContain(`${exercise.id}: diálogo pré-resposta inconsistente ou revela o gabarito.`);
  });

  it('supports all accepted fill-in answers and keeps them in the grading key', () => {
    const exercise = courses[0].units[0].lessons[1].exercises.find((item) => item.exercise_type === 'FILL_BLANK');
    expect(exercise.accepted_answers).toEqual(['catch', 'board']);
    expect(exercise.answer_key.accepted).toEqual(['catch', 'board']);
  });

  it('generates an additive, conflict-checked SQL load that leaves every course staged', () => {
    const sql = generateInsertSql(courses).toLowerCase();
    expect(sql).toContain('set local lock_timeout');
    expect(sql).toContain('content_load_read_only_transaction');
    expect(sql).toContain('on conflict (course_code) do nothing');
    expect(sql).toContain('tec_language_course_conflict');
    expect(sql).toContain('tec_language_content_count_mismatch');
    expect(sql).toContain('is not distinct from row(e.lesson_id,e.position');
    expect(sql).not.toMatch(/\)\s*=\s*row\(/);
    expect(sql).toContain("'staging'");
    expect(sql).toContain("'pedagogical_review_pending'");
    expect(sql).not.toMatch(/\b(delete\s+from|truncate\s+|drop\s+table\s+public\.)/i);
    expect(sql).not.toContain('tec_english_pedagogical_reviews');
    expect(sql).not.toContain('tec_english_course_releases');
  });

  it('requires the exact preflight fingerprint set and fails closed on remote drift', () => {
    const previous = structuredClone(courses);
    previous[0].units[0].lessons[0].exercises[0].dialogue_context.push({ speaker: 'Você', text: 'extra' });
    expect(() => generateCorrectionSql(previous, courses)).toThrow(/fingerprints esperados devem corresponder exatamente/);
    const sql = generateCorrectionSql(previous, courses, { expectedProductionFingerprints });
    expect(sql).toContain('TEC_IDIOMAS_V3_COURSE_FINGERPRINT_DRIFT');
    expect(sql).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(sql).toContain('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(sql).toContain('cccccccccccccccccccccccccccccccc');
    expect(sql).toContain('in share row exclusive mode');
  });

  it('generates private review files with per-question before/after and safe decision retention', async () => {
    const outputRoot = await mkdtemp(path.join(tmpdir(), 'tec-idiomas-v3-'));
    try {
      const previous = structuredClone(courses);
      const first = previous[0].units[0].lessons[0].exercises[0];
      first.dialogue_context.push({ speaker: 'Você', text: first.answer_key.accepted[0] });
      const result = await generateArtifacts(courses, { outputRoot, previousCourses: previous, expectedProductionFingerprints });
      expect(result).toMatchObject({ courses: 3, lessons: 32, exercises: 224, changedQuestions: 1 });
      const html = await readFile(path.join(result.reportsDir, 'tec-english-foundations-v2-expansion-v1.html'), 'utf8');
      const review = JSON.parse(await readFile(path.join(result.reportsDir, 'tec-english-foundations-v2-expansion-v1.json'), 'utf8'));
      expect(review.questions).toHaveLength(112);
      expect(review.questions.every((question) => question.decision === 'NOT_REVIEWED')).toBe(true);
      expect(review.audit).toHaveLength(112);
      expect(review.audit.every((finding) => finding.human_review_required)).toBe(true);
      expect(html).toContain('ALTERADO');
      expect(html).toContain('before_after');
      expect(html).toContain('Achados automáticos');
      expect(html).toContain('previousFingerprints');
      expect(html).toContain('fingerprint:r.content_fingerprint');
      expect(html).toContain('Gabarito:');
      expect(html).not.toContain('fetch(');
      expect(html).not.toContain('supabase');
      const sql = await readFile(path.join(result.generatedDir, 'tec-idiomas-v3-staging-correction.sql'), 'utf8');
      expect(sql).toContain('TEC_IDIOMAS_V3_REVIEW_EXISTS');
      expect(sql).toContain('TEC_IDIOMAS_V3_STUDENT_PROGRESS_EXISTS');
      expect(sql).toContain('TEC_IDIOMAS_V3_CORRECTION_DRIFT');
      expect(sql).toContain('TEC_IDIOMAS_V3_COURSE_FINGERPRINT_DRIFT');
      expect(sql).toContain('private.tec_english_course_fingerprint');
      expect(sql).toContain('where unit.course_code = \'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION\') = 16');
      expect(sql).not.toContain('20261027000100');
      expect(sql).not.toContain('TEC_IDIOMAS_V3_COURSE_STATE:TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION\n');
      const correctionSql = generateCorrectionSql(previous, courses, { expectedProductionFingerprints });
      expect(correctionSql).toContain('dialogue_context');
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });
});
