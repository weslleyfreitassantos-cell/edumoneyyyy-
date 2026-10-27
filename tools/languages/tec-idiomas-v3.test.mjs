import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { compileCourses, generateInsertSql, validateCourses } from './tec-idiomas-v3.mjs';

const expected = new Map([
  ['TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', [4, 16, 112, 'en_v2x_']],
  ['TEC_SPANISH_FOUNDATIONS_V1', [2, 8, 56, 'es_v1_']],
  ['TEC_KOREAN_FOUNDATIONS_V1', [2, 8, 56, 'ko_v1_']],
]);

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

  it('ships complete offline review packages with every answer and an unreviewed initial state', () => {
    for (const item of courses) {
      const stem = item.course.code.toLowerCase().replaceAll('_', '-');
      const reportBase = fileURLToPath(new URL(`../../reports/tec-idiomas-v3/${stem}-v${item.course.version}`, import.meta.url));
      const html = readFileSync(`${reportBase}.html`, 'utf8');
      const review = JSON.parse(readFileSync(`${reportBase}.json`, 'utf8'));
      const questionIds = item.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.id)));
      expect(review.questions).toHaveLength(item.manifest.exercise_count);
      expect(review.questions.every((question) => question.decision === 'NOT_REVIEWED')).toBe(true);
      expect(html).toContain(item.manifest.content_fingerprint);
      expect(html).toContain('Gabarito:');
      expect(html).toContain('Solicitar correção');
      expect(html).not.toContain('fetch(');
      expect(html).not.toContain('supabase');
      for (const id of questionIds) expect(html).toContain(id);
    }
  });
});
