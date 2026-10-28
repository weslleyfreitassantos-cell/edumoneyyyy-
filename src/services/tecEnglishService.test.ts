import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc } }));

import { tecEnglishService } from './tecEnglishService';

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
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' } })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.course.code).toBe('TEC_ENGLISH_FOUNDATIONS');
    expect(result.additional_courses).toEqual([]);
    expect(result.additional_courses_error).toBe(false);
  });

  it('preserves the V1 map and surfaces unexpected V2 RPC failures', async () => {
    rpc
      .mockResolvedValueOnce({ data: baseMap, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'statement timeout' } });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.course.code).toBe('TEC_ENGLISH_FOUNDATIONS');
    expect(result.additional_courses).toEqual([]);
    expect(result.additional_courses_error).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('includes V2 only when the backend returns its available course map', async () => {
    const v2Map = { ...baseMap, course: { ...baseMap.course, code: 'TEC_ENGLISH_FOUNDATIONS_V2' } };
    rpc
      .mockResolvedValueOnce({ data: baseMap, error: null })
      .mockResolvedValueOnce({ data: v2Map, error: null });

    const result = await tecEnglishService.getMap('school-1');

    expect(result.additional_courses?.map((course) => course.course.code)).toEqual(['TEC_ENGLISH_FOUNDATIONS_V2']);
  });
});
