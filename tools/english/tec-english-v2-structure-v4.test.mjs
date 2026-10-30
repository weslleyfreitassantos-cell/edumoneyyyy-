import { describe, expect, it } from 'vitest';
import { course as version3 } from '../../content/english/tec-english-everyday-v2.mjs';
import { course as version4 } from '../../content/english/tec-english-everyday-v2-v4.mjs';

describe('Tec Inglês V2 structure version 4', () => {
  const lessonsV3 = version3.units.flatMap((unit) => unit.lessons);
  const lessonsV4 = version4.units.flatMap((unit) => unit.lessons);

  it('keeps the V2 course in staging, versioned for human review, with 8 lessons and 56 exercises', () => {
    expect(version4.course.code).toBe('TEC_ENGLISH_FOUNDATIONS_V2');
    expect(version4.course.version).toBe(4);
    expect(version4.course.publicationStatus).toBe('STAGING');
    expect(version4.course.reviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(lessonsV4).toHaveLength(8);
    expect(lessonsV4.reduce((sum, lesson) => sum + lesson.exercises.length, 0)).toBe(56);
  });

  it('replaces only the duplicate second exercise in the eight affected lessons', () => {
    expect(lessonsV3).toHaveLength(8);
    for (let index = 0; index < lessonsV4.length; index += 1) {
      expect(lessonsV4[index].exercises[1].type).not.toBe('MULTIPLE_CHOICE');
      expect(lessonsV4[index].exercises.filter((_, exerciseIndex) => exerciseIndex !== 1))
        .toEqual(lessonsV3[index].exercises.filter((_, exerciseIndex) => exerciseIndex !== 1));
      expect(lessonsV4[index].exercises.map((item) => item.type).sort()).toEqual([
        'FILL_BLANK', 'LISTENING', 'MATCHING', 'MULTIPLE_CHOICE', 'SPEAKING', 'TRANSLATION', 'WORD_ORDER',
      ]);
    }
    expect(lessonsV4.map((lesson) => lesson.exercises[1].type)).toEqual([
      'SPEAKING', 'FILL_BLANK', 'MATCHING', 'LISTENING',
      'TRANSLATION', 'WORD_ORDER', 'MATCHING', 'FILL_BLANK',
    ]);
  });

  it('keeps all absolute-beginner V4 courses on their actual lighter profile', async () => {
    const { courses } = await import('../../content/languages/tec-idiomas-v4.mjs');
    const beginnerCodes = new Set([
      'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
      'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
      'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER',
    ]);
    const beginners = courses.filter((course) => beginnerCodes.has(course.code));
    expect(beginners).toHaveLength(3);
    for (const beginner of beginners) {
      const lessons = beginner.units.flatMap((unit) => unit.lessons);
      const exerciseCount = lessons.reduce((count, lesson) => count + lesson.activities.length, 0);
      expect(beginner.units).toHaveLength(4);
      expect(lessons).toHaveLength(16);
      expect(exerciseCount).toBe(beginner.code === 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER' ? 72 : 76);
      expect(lessons.every((lesson) => lesson.activities.length >= 4 && lesson.activities.length <= 5)).toBe(true);
      expect(lessons.every((lesson) => {
        const distinctTypes = new Set(lesson.activities.map((item) => item.type)).size;
        return distinctTypes >= 3 && distinctTypes <= 4
          && lesson.activities.every((item) => ['MULTIPLE_CHOICE', 'MATCHING', 'FILL_BLANK', 'WORD_ORDER'].includes(item.type));
      })).toBe(true);
    }
  });
});
