import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc } }));

import { tecEnglishService, tecLanguageLocale } from './tecEnglishService';

const baseMap = {
  course: { code: 'TEC_ENGLISH_FOUNDATIONS', title: 'Inglês para começar', description: 'V1', version: 1, publication_status: 'PUBLISHED', review_status: 'PEDAGOGICAL_REVIEWED' },
  units: [],
  stats: { xp: 10, current_streak: 2, longest_streak: 3, last_study_date: '2026-10-26' },
  completed_lessons: 1,
  total_lessons: 12,
  continue_lesson_id: null,
};

describe('tecEnglishService.getMap', () => {
  beforeEach(() => rpc.mockReset());

  it('keeps V1 usable and silently omits V2 only while unpublished or its RPC is not installed', async () => {
    rpc
      .mockResolvedValueOnce({ data: baseMap, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.course.code).toBe('TEC_ENGLISH_FOUNDATIONS');
    expect(result.additional_courses).toEqual([]);
    expect(result.additional_courses_error).toBe(false);
  });

  it('preserves the V1 map and surfaces unexpected V2 RPC failures', async () => {
    rpc
      .mockResolvedValueOnce({ data: baseMap, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'statement timeout' } })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.course.code).toBe('TEC_ENGLISH_FOUNDATIONS');
    expect(result.additional_courses).toEqual([]);
    expect(result.additional_courses_error).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('includes V2 only when the backend returns its available course map', async () => {
    const v2Map = { ...baseMap, course: { ...baseMap.course, code: 'TEC_ENGLISH_FOUNDATIONS_V2' } };
    rpc
      .mockResolvedValueOnce({ data: baseMap, error: null })
      .mockResolvedValueOnce({ data: v2Map, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' } });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.additional_courses?.map((course) => course.course.code)).toEqual(['TEC_ENGLISH_FOUNDATIONS_V2']);
  });

  it('loads approved language course maps through the shared gated runtime', async () => {
    const englishExpansion = { ...baseMap, course: { ...baseMap.course, code: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION' } };
    const spanish = { ...baseMap, course: { ...baseMap.course, code: 'TEC_SPANISH_FOUNDATIONS_V1' } };
    const korean = { ...baseMap, course: { ...baseMap.course, code: 'TEC_KOREAN_FOUNDATIONS_V1' } };
    rpc
      .mockResolvedValueOnce({ data: baseMap, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      .mockResolvedValueOnce({ data: englishExpansion, error: null })
      .mockResolvedValueOnce({ data: spanish, error: null })
      .mockResolvedValueOnce({ data: korean, error: null });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.additional_courses?.map((course) => course.course.code)).toEqual([
      'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1',
    ]);
    expect(rpc).toHaveBeenCalledWith('get_tec_language_course_map_v1', {
      p_institution_id: 'school-1', p_course_code: 'TEC_KOREAN_FOUNDATIONS_V1',
    });
  });

  it('routes starts, resumptions, and answers for the three new courses to the shared RPCs', async () => {
    rpc.mockResolvedValue({ data: { session_id: 'session-1' }, error: null });

    await tecEnglishService.startLesson('school-1', 'es-v1-lesson-1', 'TEC_SPANISH_FOUNDATIONS_V1');
    expect(rpc).toHaveBeenLastCalledWith('start_tec_language_lesson_v1', {
      p_institution_id: 'school-1', p_course_code: 'TEC_SPANISH_FOUNDATIONS_V1', p_lesson_id: 'es-v1-lesson-1',
    });
    await tecEnglishService.getSession('school-1', 'session-1', 'TEC_KOREAN_FOUNDATIONS_V1');
    expect(rpc).toHaveBeenLastCalledWith('get_tec_language_session_v1', {
      p_institution_id: 'school-1', p_course_code: 'TEC_KOREAN_FOUNDATIONS_V1', p_session_id: 'session-1',
    });
    await tecEnglishService.submitAnswer('school-1', 'session-1', 'en-v2x-e1', { choice: 'x' }, 'attempt-1', 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION');
    expect(rpc).toHaveBeenLastCalledWith('submit_tec_language_answer_v1', {
      p_institution_id: 'school-1', p_course_code: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', p_session_id: 'session-1',
      p_exercise_id: 'en-v2x-e1', p_response: { choice: 'x' }, p_idempotency_key: 'attempt-1',
    });
  });

  it('maps each language to a distinct browser speech locale', () => {
    expect(tecLanguageLocale('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION')).toBe('en-US');
    expect(tecLanguageLocale('TEC_SPANISH_FOUNDATIONS_V1')).toBe('es-ES');
    expect(tecLanguageLocale(undefined, 'ko_v1_greetings_speaking')).toBe('ko-KR');
  });
});
