import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

import { courses as beginnerSource } from '../../content/languages/tec-idiomas-v4.mjs';
import { courses as legacySource } from '../../content/languages/tec-idiomas-v3.mjs';
import { buildManifest, compileCourses, validateCourses } from './tec-idiomas-v4.mjs';

const compiled = compileCourses();
const flatten = (courses) => courses.flatMap((course) => course.units.flatMap((unit) => unit.lessons));

describe('Tec Idiomas V4 absolute beginner content', () => {
  it('adds 16 lessons to each language while preserving all legacy lesson identifiers', () => {
    expect(validateCourses(compiled)).toEqual([]);
    expect(compiled.map(({ course, manifest }) => [course.code, manifest.lesson_count])).toEqual([
      ['TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 16],
      ['TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 16],
      ['TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 16],
    ]);
    expect(flatten(legacySource)).toHaveLength(32);
    expect(flatten(beginnerSource)).toHaveLength(48);
    expect(new Set([
      ...flatten(legacySource).map((lesson) => lesson.id),
      ...flatten(beginnerSource).map((lesson) => lesson.id),
    ]).size).toBe(80);
    expect(compiled.reduce((sum, course) => sum + course.manifest.exercise_count, 0)).toBe(224);
  });

  it('keeps the three catalogs staged and starts each language with recognition activities', () => {
    for (const course of compiled) {
      expect(course.course.publication_status).toBe('STAGING');
      expect(course.course.review_status).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(course.course.is_test_fixture).toBe(false);
      const firstUnit = course.units[0];
      expect(firstUnit.lessons).toHaveLength(4);
      for (const lesson of firstUnit.lessons) {
        expect(lesson.exercises.every((exercise) => ['MULTIPLE_CHOICE', 'MATCHING', 'FILL_BLANK'].includes(exercise.exercise_type))).toBe(true);
        expect(lesson.exercises.every((exercise) => !['TRANSLATION', 'SPEAKING'].includes(exercise.exercise_type))).toBe(true);
        for (const exercise of lesson.exercises.filter((item) => item.exercise_type === 'FILL_BLANK')) {
          expect(exercise.options.length).toBeGreaterThanOrEqual(3);
        }
      }
    }
    expect(compiled.map((course) => course.units[0].lessons[0].title)).toEqual(['Olá!', 'Hola y adiós', 'Meu primeiro olá']);
    expect(compiled[0].units[0].lessons[0].introduction).toMatch(/Hello/u);
    expect(compiled[0].units[0].lessons[0].introduction).toMatch(/Hi/u);
    expect(compiled[1].units[0].lessons[0].introduction).toMatch(/Hola/u);
    expect(compiled[2].units[0].lessons[0].introduction).toMatch(/안녕하세요/u);
  });

  it('uses only taught answers, unambiguous matching, and seeded word banks', () => {
    const exercises = compiled.flatMap((course) => course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises)));
    expect(exercises).toHaveLength(224);
    for (const exercise of exercises) {
      expect(exercise.publication_status).toBe('STAGING');
      expect(exercise.review_status).toBe('PEDAGOGICAL_REVIEW_PENDING');
      expect(exercise.dialogue_context).toEqual([]);
      if (exercise.exercise_type === 'MATCHING') {
        expect(new Set(Object.values(exercise.answer_key.pairs)).size).toBe(Object.keys(exercise.answer_key.pairs).length);
      }
      if (exercise.exercise_type === 'WORD_ORDER') {
        expect([...exercise.word_bank].sort()).toEqual([...exercise.answer_key.accepted[0].trim().split(/\s+/u)].sort());
      }
    }
  });

  it('introduces Hangul with romanization support then fades that aid in later units', () => {
    const korean = compiled.find((course) => course.course.language_code === 'ko-KR');
    expect(korean).toBeDefined();
    if (!korean) throw new Error('Korean course is missing.');
    const firstEight = korean.units.slice(0, 2).flatMap((unit) => unit.lessons);
    for (const lesson of firstEight) expect(lesson.introduction).toMatch(/[가-힣ㄱ-ㅎㅏ-ㅣ]/u);
    expect(firstEight[0].introduction).toContain('annyeonghaseyo');
    expect(firstEight[4].introduction).toContain('eo');
    const laterLessons = korean.units.slice(2).flatMap((unit) => unit.lessons);
    for (const lesson of laterLessons) {
      const visibleContent = JSON.stringify(lesson);
      expect(visibleContent).not.toMatch(/\((?:annyeonghaseyo|gamsahamnida|mul juseyo|juseyo|jeoneun|sam|pal|chaek|hakgyo|jip|bangawoyo|keopi)\)/iu);
    }
  });

  it('raises exercise difficulty gradually from unit to unit', () => {
    for (const course of compiled) {
      const unitRanges = course.units.map((unit) => {
        const levels = unit.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.difficulty_level));
        return [Math.min(...levels), Math.max(...levels)];
      });
      for (let index = 1; index < unitRanges.length; index += 1) {
        expect(unitRanges[index][0]).toBeGreaterThanOrEqual(unitRanges[index - 1][0]);
      }
    }
  });

  it('reports review-pending manifests with all new lessons and no automatic release', () => {
    const manifest = buildManifest(compiled);
    expect(manifest.status).toBe('STAGING');
    expect(manifest.pedagogical_review).toBe('PENDING');
    expect(manifest.courses.reduce((sum, course) => sum + course.lesson_count, 0)).toBe(48);
    expect(manifest.courses.every((course) => course.content_fingerprint.length === 64)).toBe(true);
  });

  it('stores the runtime fingerprint format in SQL while keeping source manifests SHA-256', async () => {
    const migration = await readFile(new URL('../../supabase/migrations/20261029000100_tec_idiomas_v4_absolute_beginners.sql', import.meta.url), 'utf8');
    expect(migration).toContain("content_fingerprint ~ '^[a-f0-9]{32}$'");
    expect(migration).toContain('private.tec_english_course_fingerprint');
    expect(buildManifest(compiled).courses.every((course) => /^[a-f0-9]{64}$/u.test(course.content_fingerprint))).toBe(true);
  });
});
