import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  results: {} as Record<string, unknown>,
  queries: [] as Array<{ table: string; filters: Array<[string, ...unknown[]]> }>,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: supabaseState.from, rpc: vi.fn() },
}));

import { learningCenterService } from './learningCenterService';

describe('learningCenterService student subject offerings', () => {
  beforeEach(() => {
    supabaseState.queries.length = 0;
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
      for (const method of ['eq', 'in']) {
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
    expect(enrollmentQuery?.filters).toContainEqual(['eq', 'status', 'ACTIVE']);
    expect(enrollmentQuery?.filters).toContainEqual(['in', 'academic_year_id', ['year-current']]);
  });

  it('returns no subjects when the institution has no active academic year', async () => {
    supabaseState.results.academic_years = [];

    await expect(learningCenterService.studentSubjects('institution-1', 'profile-1')).resolves.toEqual([]);
    expect(supabaseState.queries.map((query) => query.table)).toEqual(['students', 'academic_years']);
  });
});
