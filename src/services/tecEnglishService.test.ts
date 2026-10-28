import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc } }));

import { TEC_IDIOMAS_V3_COURSES, tecEnglishService, tecLanguageLocale } from './tecEnglishService';

function courseMap(courseCode: string) {
  return {
    course: { code: courseCode, title: courseCode, description: 'Curso V3', version: 1, publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' },
    units: [],
    stats: { xp: 10, current_streak: 2, longest_streak: 3, last_study_date: '2026-10-26' },
    completed_lessons: 1,
    total_lessons: 8,
    continue_lesson_id: null,
  };
}

describe('tecEnglishService.getMap', () => {
  beforeEach(() => rpc.mockReset());

  it('loads only the three V3 language courses, including STAGING snapshots without review flags', async () => {
    rpc
      .mockResolvedValueOnce({ data: courseMap(TEC_IDIOMAS_V3_COURSES[0]), error: null })
      .mockResolvedValueOnce({ data: courseMap(TEC_IDIOMAS_V3_COURSES[1]), error: null })
      .mockResolvedValueOnce({ data: courseMap(TEC_IDIOMAS_V3_COURSES[2]), error: null });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.course.code).toBe(TEC_IDIOMAS_V3_COURSES[0]);
    expect(result.course.publication_status).toBe('STAGING');
    expect(result.course.review_status).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(result.additional_courses?.map((course) => course.course.code)).toEqual(TEC_IDIOMAS_V3_COURSES.slice(1));
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(Array(3).fill('get_tec_language_course_map_v1'));
    expect(rpc.mock.calls.map(([, args]) => args.p_course_code)).toEqual(TEC_IDIOMAS_V3_COURSES);
    expect(rpc.mock.calls.every(([, args]) => args.p_institution_id === 'school-1')).toBe(true);
  });

  it('omits a course explicitly unavailable to this institution and reports unexpected failures', async () => {
    rpc
      .mockResolvedValueOnce({ data: courseMap(TEC_IDIOMAS_V3_COURSES[0]), error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' } })
      .mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'statement timeout' } });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.additional_courses).toEqual([]);
    expect(result.additional_courses_error).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('explains when the V3 runtime is not installed instead of falling back to legacy courses', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

    await expect(tecEnglishService.getMap('school-1')).rejects.toThrow(/Tec Idiomas ainda não está instalado/i);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls.map(([, args]) => args.p_course_code)).toEqual(TEC_IDIOMAS_V3_COURSES);
  });

  it('routes starts, resumptions, and answers for each language through course-scoped RPCs', async () => {
    rpc.mockResolvedValue({ data: { session_id: 'session-1' }, error: null });

    for (const courseCode of TEC_IDIOMAS_V3_COURSES) {
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

  it('maps each supported course to its own speech locale', () => {
    expect(tecLanguageLocale(TEC_IDIOMAS_V3_COURSES[0])).toBe('en-US');
    expect(tecLanguageLocale(TEC_IDIOMAS_V3_COURSES[1])).toBe('es-ES');
    expect(tecLanguageLocale(TEC_IDIOMAS_V3_COURSES[2])).toBe('ko-KR');
  });
});
