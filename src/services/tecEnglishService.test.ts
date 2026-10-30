import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc } }));

import {
  orderTecLanguageCourses,
  TEC_IDIOMAS_V3_COURSES,
  TEC_IDIOMAS_V4_COURSES,
  tecLanguagePlacementCourseCode,
  tecEnglishService,
  tecLanguageLocale,
  type EnglishCourseMap,
  type EnglishLessonStatus,
} from './tecEnglishService';

const coursePairs = [
  [TEC_IDIOMAS_V4_COURSES[0], TEC_IDIOMAS_V3_COURSES[0]],
  [TEC_IDIOMAS_V4_COURSES[1], TEC_IDIOMAS_V3_COURSES[1]],
  [TEC_IDIOMAS_V4_COURSES[2], TEC_IDIOMAS_V3_COURSES[2]],
] as const;
const runtimeCourses = [...TEC_IDIOMAS_V4_COURSES, ...TEC_IDIOMAS_V3_COURSES];
const placementResult = {
  version: 1,
  kind: 'ASSESSMENT',
  score: 4,
  questionCount: 5,
  highestDifficulty: 3,
  recommendedUnitPosition: 3,
  completedAt: '2026-10-29T12:00:00.000Z',
} as const;

function makeCourse(code: string, options: {
  completed?: number;
  xp?: number;
  status?: EnglishLessonStatus;
  activeSessionId?: string | null;
} = {}): EnglishCourseMap {
  const status = options.status ?? 'AVAILABLE';
  const lessons = Array.from({ length: 16 }, (_, index) => ({
    id: `${code}-lesson-${index + 1}`,
    course_code: code,
    position: index + 1,
    title: `Etapa ${index + 1}`,
    status,
    exercise_count: 4,
    xp_reward: 30,
    active_session_id: index === 0 ? options.activeSessionId ?? null : null,
    completed_at: status === 'COMPLETED' ? '2026-10-29T12:00:00Z' : null,
  }));
  return {
    course: {
      code,
      title: code,
      description: 'Percurso de teste',
      version: 1,
      publication_status: 'STAGING',
      review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    },
    units: [{ id: `${code}-unit-1`, position: 1, title: 'Unidade 1', description: '', lessons }],
    stats: { xp: options.xp ?? 0, current_streak: 0, longest_streak: 0, last_study_date: null },
    completed_lessons: options.completed ?? (status === 'COMPLETED' ? lessons.length : 0),
    total_lessons: 16,
    continue_lesson_id: options.activeSessionId ? lessons[0].id : null,
  };
}

describe('tecEnglishService placement synchronization', () => {
  beforeEach(() => rpc.mockReset());

  it('maps locale to the isolated V4 course and reads the persisted attempt', async () => {
    expect(tecLanguagePlacementCourseCode('en-US')).toBe('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER');
    expect(tecLanguagePlacementCourseCode('es-ES')).toBe('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER');
    expect(tecLanguagePlacementCourseCode('ko-KR')).toBe('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER');
    rpc.mockResolvedValue({ data: { attemptId: '11111111-1111-4111-8111-111111111111', record: placementResult }, error: null });

    await expect(tecEnglishService.getPlacement('school-1', 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER'))
      .resolves.toEqual({ attemptId: '11111111-1111-4111-8111-111111111111', record: placementResult });
    expect(rpc).toHaveBeenCalledWith('get_tec_language_placement_v1', {
      p_institution_id: 'school-1', p_course_code: 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
    });
  });

  it('saves the same attempt id for safe retries and rejects malformed server responses', async () => {
    const attemptId = '22222222-2222-4222-8222-222222222222';
    rpc.mockResolvedValue({ data: { attemptId, record: placementResult }, error: null });

    await expect(tecEnglishService.savePlacement('school-1', 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', attemptId, placementResult))
      .resolves.toEqual({ attemptId, record: placementResult });
    expect(rpc).toHaveBeenCalledWith('save_tec_language_placement_v1', {
      p_institution_id: 'school-1',
      p_course_code: 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
      p_attempt_id: attemptId,
      p_record: placementResult,
    });

    rpc.mockResolvedValueOnce({ data: { attemptId, record: { ...placementResult, score: 99 } }, error: null });
    await expect(tecEnglishService.savePlacement('school-1', 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', attemptId, placementResult))
      .rejects.toThrow('TEC_IDIOMAS_PLACEMENT_INVALID_RESPONSE');
  });
});

describe('tecEnglishService reset operations', () => {
  beforeEach(() => rpc.mockReset());

  it('sends only the selected institution, course, lesson, and activity session to the reset RPCs', async () => {
    const restarted = {
      session_id: 'session-new', lesson_id: 'lesson-1', lesson_title: 'Cumprimentos',
      lesson_intro: 'Introdução', unit_title: 'Unidade 1', status: 'IN_PROGRESS',
      current_position: 1, total_exercises: 7, exercise: null,
    };
    rpc.mockResolvedValueOnce({ data: restarted, error: null });
    await expect(tecEnglishService.resetActivity('school-1', TEC_IDIOMAS_V4_COURSES[1], 'lesson-1', 'session-old'))
      .resolves.toMatchObject({ session_id: 'session-new', course_code: TEC_IDIOMAS_V4_COURSES[1] });
    expect(rpc).toHaveBeenLastCalledWith('reset_tec_language_activity_v1', {
      p_institution_id: 'school-1', p_course_code: TEC_IDIOMAS_V4_COURSES[1],
      p_lesson_id: 'lesson-1', p_session_id: 'session-old',
    });

    rpc.mockResolvedValueOnce({ data: { reset: true, locale: 'ko', course_codes: [TEC_IDIOMAS_V4_COURSES[2]], replayed: false }, error: null });
    await expect(tecEnglishService.resetCourse('school-1', 'ko-KR')).resolves.toMatchObject({ reset: true, locale: 'ko' });
    expect(rpc).toHaveBeenLastCalledWith('reset_tec_language_course_v1', { p_institution_id: 'school-1', p_locale: 'ko' });
  });
});

describe('tecEnglishService.getMap', () => {
  beforeEach(() => rpc.mockReset());

  it('loads the V4 and legacy maps for all languages while preserving STAGING metadata', async () => {
    for (const courseCode of runtimeCourses) rpc.mockResolvedValueOnce({ data: makeCourse(courseCode), error: null });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.course.code).toBe(TEC_IDIOMAS_V4_COURSES[0]);
    expect(result.course.publication_status).toBe('STAGING');
    expect(result.course.review_status).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(result.additional_courses?.map((course) => course.course.code)).toEqual([
      TEC_IDIOMAS_V3_COURSES[0],
      TEC_IDIOMAS_V4_COURSES[1], TEC_IDIOMAS_V3_COURSES[1],
      TEC_IDIOMAS_V4_COURSES[2], TEC_IDIOMAS_V3_COURSES[2],
    ]);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(Array(6).fill('get_tec_language_course_map_v1'));
    expect(rpc.mock.calls.map(([, args]) => args.p_course_code)).toEqual(runtimeCourses);
    expect(rpc.mock.calls.every(([, args]) => args.p_institution_id === 'school-1')).toBe(true);
  });

  it('omits institution-unavailable maps and reports unexpected load failures', async () => {
    rpc
      .mockResolvedValueOnce({ data: makeCourse(TEC_IDIOMAS_V4_COURSES[0]), error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' } })
      .mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'statement timeout' } })
      .mockResolvedValueOnce({ data: makeCourse(TEC_IDIOMAS_V3_COURSES[0]), error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' } })
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' } });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.additional_courses?.map((course) => course.course.code)).toContain(TEC_IDIOMAS_V3_COURSES[0]);
    expect(result.additional_courses_error).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(6);
  });

  it('explains when the language runtime is not installed instead of falling back to another course', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

    await expect(tecEnglishService.getMap('school-1')).rejects.toThrow(/Tec Idiomas ainda não está instalado/i);
    expect(rpc).toHaveBeenCalledTimes(6);
    expect(rpc.mock.calls.map(([, args]) => args.p_course_code)).toEqual(runtimeCourses);
  });

  it('routes starts, resumptions, and answers for every course through the scoped runtime RPCs', async () => {
    rpc.mockResolvedValue({ data: { session_id: 'session-1' }, error: null });

    for (const courseCode of runtimeCourses) {
      await tecEnglishService.startLesson('school-1', 'lesson-1', courseCode);
      expect(rpc).toHaveBeenLastCalledWith('start_tec_language_lesson_v1', {
        p_institution_id: 'school-1', p_course_code: courseCode, p_lesson_id: 'lesson-1',
      });
      await tecEnglishService.getSession('school-1', 'session-1', courseCode);
      expect(rpc).toHaveBeenLastCalledWith('get_tec_language_session_v1', {
        p_institution_id: 'school-1', p_course_code: courseCode, p_session_id: 'session-1',
      });
      await tecEnglishService.submitAnswer('school-1', 'session-1', 'exercise-1', { choice: 'x' }, 'attempt-1', courseCode);
      expect(rpc).toHaveBeenLastCalledWith('submit_tec_language_answer_v1', {
        p_institution_id: 'school-1', p_course_code: courseCode, p_session_id: 'session-1',
        p_exercise_id: 'exercise-1', p_response: { choice: 'x' }, p_idempotency_key: 'attempt-1',
      });
    }
  });

  it('maps every supported language course to its speech locale', () => {
    expect(tecLanguageLocale(TEC_IDIOMAS_V4_COURSES[0])).toBe('en-US');
    expect(tecLanguageLocale(TEC_IDIOMAS_V4_COURSES[1])).toBe('es-ES');
    expect(tecLanguageLocale(TEC_IDIOMAS_V4_COURSES[2])).toBe('ko-KR');
    expect(tecLanguageLocale(TEC_IDIOMAS_V3_COURSES[0])).toBe('en-US');
    expect(tecLanguageLocale(TEC_IDIOMAS_V3_COURSES[1])).toBe('es-ES');
    expect(tecLanguageLocale(TEC_IDIOMAS_V3_COURSES[2])).toBe('ko-KR');
  });
});

describe('Tec Idiomas beginner path compatibility', () => {
  it.each(coursePairs)('starts a new learner in %s and locks the unstarted legacy path', (beginnerCode, legacyCode) => {
    const beginner = makeCourse(beginnerCode);
    const legacy = makeCourse(legacyCode);
    const [first, second] = orderTecLanguageCourses([legacy, beginner]);

    expect(first.course.code).toBe(beginnerCode);
    expect(first.units[0].lessons[0].status).toBe('AVAILABLE');
    expect(second.course.code).toBe(legacyCode);
    expect(second.units.flatMap((unit) => unit.lessons).every((lesson) => lesson.status === 'LOCKED')).toBe(true);
    expect(second.continue_lesson_id).toBeNull();
  });

  it.each(coursePairs)('preserves a legacy learner session and progress for %s', (_beginnerCode, legacyCode) => {
    const beginner = makeCourse(_beginnerCode);
    const legacy = makeCourse(legacyCode, { completed: 3, xp: 90, status: 'IN_PROGRESS', activeSessionId: 'active-session-1' });
    const [first, second] = orderTecLanguageCourses([beginner, legacy]);

    expect(first).toBe(legacy);
    expect(first.completed_lessons).toBe(3);
    expect(first.stats.xp).toBe(90);
    expect(first.continue_lesson_id).toBe(`${legacyCode}-lesson-1`);
    expect(first.units[0].lessons[0].active_session_id).toBe('active-session-1');
    expect(second.course.code).toBe(_beginnerCode);
  });

  it.each(coursePairs)('unlocks legacy content only after all beginner lessons are complete for %s', (beginnerCode, legacyCode) => {
    const beginner = makeCourse(beginnerCode, { completed: 16, xp: 480, status: 'COMPLETED' });
    const legacy = makeCourse(legacyCode);
    const [first, second] = orderTecLanguageCourses([legacy, beginner]);

    expect(first.course.code).toBe(beginnerCode);
    expect(second.course.code).toBe(legacyCode);
    expect(second.units[0].lessons[0].status).toBe('AVAILABLE');
    expect(second.stats.xp).toBe(0);
  });
});
