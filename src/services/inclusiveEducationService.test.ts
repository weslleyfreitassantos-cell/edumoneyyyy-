import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: mocks.from },
}));

import { listInclusiveProgressStudents } from './inclusiveEducationService';

type QueryResponse = { data: unknown[]; error: unknown };
type QueryBuilder = Record<string, ReturnType<typeof vi.fn>> & {
  then: (resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
};

const responses: Record<string, QueryResponse> = {};
const builders = new Map<string, QueryBuilder>();

function queryBuilder(response: QueryResponse): QueryBuilder {
  const builder = {} as QueryBuilder;
  for (const method of ['select', 'eq', 'neq', 'in', 'order']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
  return builder;
}

describe('listInclusiveProgressStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(responses).forEach((table) => delete responses[table]);
    builders.clear();
    mocks.from.mockImplementation((table: string) => {
      const builder = queryBuilder(responses[table] ?? { data: [], error: null });
      builders.set(table, builder);
      return builder;
    });
  });

  it('returns current students with a current PEI/AEE plan or active AEE assignment', async () => {
    responses.academic_years = { data: [{ id: '2026' }], error: null };
    responses.enrollments = {
      data: ['student-1', 'student-2', 'student-3'].map((student_id) => ({
        student_id,
        academic_year_id: '2026',
        classes: { academic_year_id: '2026' },
      })),
      error: null,
    };
    responses.inclusive_pei_plans = {
      data: [
        { student_id: 'student-1', academic_year_id: '2026', status: 'ACTIVE' },
        { student_id: 'student-2', academic_year_id: '2025', status: 'ACTIVE' },
        { student_id: 'student-4', academic_year_id: '2026', status: 'ARCHIVED' },
      ],
      error: null,
    };
    responses.inclusive_aee_plans = { data: [], error: null };
    responses.inclusive_aee_assignments = {
      data: [{ student_id: 'student-3' }, { student_id: 'student-4' }],
      error: null,
    };
    responses.students = {
      data: [
        { id: 'student-1', profile: { full_name: 'Ana' } },
        { id: 'student-3', profile: { full_name: 'Cecilia' } },
      ],
      error: null,
    };

    await expect(listInclusiveProgressStudents('institution-1')).resolves.toEqual([
      { id: 'student-1', name: 'Ana' },
      { id: 'student-3', name: 'Cecilia' },
    ]);

    expect(builders.get('academic_years')?.eq).toHaveBeenCalledWith('active', true);
    expect(builders.get('inclusive_pei_plans')?.in).toHaveBeenCalledWith('status', ['DRAFT', 'ACTIVE']);
    expect(builders.get('inclusive_aee_assignments')?.eq).toHaveBeenCalledWith('active', true);
    expect(builders.get('students')?.in).toHaveBeenCalledWith('id', ['student-1', 'student-3']);
    expect(builders.get('students')?.eq).toHaveBeenCalledWith('active', true);
  });

  it('does not query student names when there are no current inclusive support records', async () => {
    responses.academic_years = { data: [{ id: '2026' }], error: null };
    await expect(listInclusiveProgressStudents('institution-1')).resolves.toEqual([]);
    expect(mocks.from).toHaveBeenCalledTimes(5);
    expect(builders.has('students')).toBe(false);
  });
});
