import { describe, expect, it } from 'vitest';

import { courses as v4Courses } from '../../content/languages/tec-idiomas-v4.mjs';
import { courses as v3Courses } from '../../content/languages/tec-idiomas-v3.mjs';
import { getPlacementQuestion } from '../../src/lib/tecIdiomasPlacement.ts';
import { koreanRomanizationParts } from '../../src/lib/koreanRomanization.ts';

const HANGUL_RUN = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+/gu;
const legacyKoreanCourse = v3Courses.find(({ course }) => course.code === 'TEC_KOREAN_FOUNDATIONS_V1');
const currentKoreanCourse = v4Courses.find(({ locale }) => locale === 'ko-KR');
const placementQuestions = [
  'ko-greeting',
  'ko-thanks',
  'ko-library',
  'ko-food',
  'ko-weekend-study',
  'ko-after-rain',
].map((questionId) => getPlacementQuestion('ko-KR', questionId));

function findUnromanizedHangul(value, path = 'content') {
  if (typeof value === 'string') {
    return [...value.matchAll(HANGUL_RUN)]
      .filter((match) => !koreanRomanizationParts(match[0]).some((part) => part.text === match[0] && part.romanization))
      .map((match) => `${path}: ${match[0]}`);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findUnromanizedHangul(item, `${path}[${index}]`));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findUnromanizedHangul(item, `${path}.${key}`));
  }

  return [];
}

describe('Tec Idiomas V9 Korean romanization coverage', () => {
  it('covers Hangul in both course versions and every Korean placement question', () => {
    const content = [legacyKoreanCourse, currentKoreanCourse, placementQuestions];

    expect(legacyKoreanCourse).toBeDefined();
    expect(currentKoreanCourse).toBeDefined();
    expect(placementQuestions.every(Boolean)).toBe(true);
    expect(findUnromanizedHangul(content)).toEqual([]);
  });
});
