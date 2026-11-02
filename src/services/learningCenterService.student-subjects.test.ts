import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  results: {} as Record<string, unknown>,
  queries: [] as Array<{ table: string; filters: Array<[string, ...unknown[]]> }>,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: supabaseState.from, rpc: supabaseState.rpc },
}));

import { learningCenterService } from './learningCenterService';

describe('learningCenterService student subject offerings', () => {
  beforeEach(() => {
    supabaseState.queries.length = 0;
    supabaseState.rpc.mockReset();
    supabaseState.results = {
      students: { id: 'student-1', profile_id: 'profile-1' },
      academic_years: [{ id: 'year-current' }],
      enrollments: [{ class_id: 'class-current' }],
      subject_offerings: [{ subject_id: 'subject-math' }],
      subjects: [{ id: 'subject-math', name: 'Matemática', code: 'MAT' }],
    };
    supabaseState.from.mockImplementation((table: string) => {
      const record = { table, filters: [] as Array<[string, ...unknown[]]> };
      supabaseState.queries.push(record);
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'order', 'single']) {
        builder[method] = (...args: unknown[]) => {
          record.filters.push([method, ...args]);
          return builder;
        };
      }
      for (const method of ['eq', 'ilike', 'in']) {
        builder[method] = (...args: unknown[]) => {
          record.filters.push([method, ...args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: supabaseState.results[table], error: null }).then(resolve, reject);
      return builder;
    });
  });

  it('uses only active academic-year enrollment offerings', async () => {
    const subjects = await learningCenterService.studentSubjects('institution-1', 'profile-1');

    expect(subjects).toEqual([{ id: 'subject-math', name: 'Matemática', code: 'MAT' }]);
    const academicYearQuery = supabaseState.queries.find((query) => query.table === 'academic_years');
    expect(academicYearQuery?.filters).toContainEqual(['eq', 'institution_id', 'institution-1']);
    expect(academicYearQuery?.filters).toContainEqual(['eq', 'active', true]);

    const enrollmentQuery = supabaseState.queries.find((query) => query.table === 'enrollments');
    expect(enrollmentQuery?.filters).toContainEqual(['ilike', 'status', 'active']);
    expect(enrollmentQuery?.filters).toContainEqual(['in', 'academic_year_id', ['year-current']]);
  });

  it('returns no subjects when the institution has no active academic year', async () => {
    supabaseState.results.academic_years = [];

    await expect(learningCenterService.studentSubjects('institution-1', 'profile-1')).resolves.toEqual([]);
    expect(supabaseState.queries.map((query) => query.table)).toEqual(['students', 'academic_years']);
  });

  it('merges released Central Studies V2 journeys with the existing V9 journeys', async () => {
    supabaseState.rpc
      .mockResolvedValueOnce({ data: [{ journey_id: 'legacy-journey' }], error: null })
      .mockResolvedValueOnce({ data: [{ journey_id: 'v2-journey', publication_status: 'PUBLISHED' }], error: null });

    await expect(learningCenterService.guidedDisciplineJourneysV9('institution-1', 'student-1'))
      .resolves.toEqual([
        { journey_id: 'legacy-journey', source: 'V9' },
        { journey_id: 'v2-journey', publication_status: 'PUBLISHED', source: 'CENTRAL_STUDIES_V2' },
      ]);
    expect(supabaseState.rpc).toHaveBeenNthCalledWith(1, 'list_student_guided_discipline_journeys_v9', {
      p_institution_id: 'institution-1', p_student_id: 'student-1',
    });
    expect(supabaseState.rpc).toHaveBeenNthCalledWith(2, 'list_student_central_studies_v2_journeys_v1', {
      p_institution_id: 'institution-1', p_student_id: 'student-1',
    });
  });

  it('keeps existing V9 journeys available before the V2 publication migration exists', async () => {
    supabaseState.rpc
      .mockResolvedValueOnce({ data: [{ journey_id: 'legacy-journey' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'function not found' } });

    await expect(learningCenterService.guidedDisciplineJourneysV9('institution-1', 'student-1'))
      .resolves.toEqual([{ journey_id: 'legacy-journey', source: 'V9' }]);
  });
});
