import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  },
}));

import { registerStudentForInclusiveEducation } from './inclusiveEducationService';

function queryBuilder({
  maybeSingle = { data: null, error: null },
  single = { data: null, error: null },
}: {
  maybeSingle?: { data: unknown; error: unknown };
  single?: { data: unknown; error: unknown };
} = {}) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(maybeSingle);
  builder.single = vi.fn().mockResolvedValue(single);
  return builder;
}

function activeEnrollmentQueries() {
  return [
    queryBuilder({ maybeSingle: { data: { academic_year_id: 'year-1', class_id: 'class-1' }, error: null } }),
    queryBuilder({ maybeSingle: { data: { id: 'year-1' }, error: null } }),
  ];
}

describe('registerStudentForInclusiveEducation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'director-profile' } }, error: null });
  });

  it('creates an empty PEI draft for the active enrollment without copying health data', async () => {
    const [enrollmentQuery, yearQuery] = activeEnrollmentQueries();
    const existingPlanQuery = queryBuilder();
    const insertQuery = queryBuilder({ single: { data: { id: 'pei-1' }, error: null } });
    mocks.from
      .mockReturnValueOnce(enrollmentQuery)
      .mockReturnValueOnce(yearQuery)
      .mockReturnValueOnce(existingPlanQuery)
      .mockReturnValueOnce(insertQuery);

    await registerStudentForInclusiveEducation('institution-1', 'student-1');

    expect(enrollmentQuery.eq).toHaveBeenCalledWith('academic_years.institution_id', 'institution-1');
    expect(enrollmentQuery.eq).toHaveBeenCalledWith('academic_years.active', true);
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      institution_id: 'institution-1',
      student_id: 'student-1',
      academic_year_id: 'year-1',
      class_id: 'class-1',
      status: 'DRAFT',
      created_by: 'director-profile',
      updated_by: 'director-profile',
      strengths: '',
      pedagogical_evaluation: '',
    }));
    expect(mocks.from).not.toHaveBeenCalledWith('student_health_information');
  });

  it('reopens an archived PEI for the active year instead of creating a duplicate', async () => {
    const [enrollmentQuery, yearQuery] = activeEnrollmentQueries();
    const existingPlanQuery = queryBuilder({
      maybeSingle: { data: { id: 'pei-archived', status: 'ARCHIVED' }, error: null },
    });
    const updateQuery = queryBuilder({ maybeSingle: { data: { id: 'pei-archived' }, error: null } });
    mocks.from
      .mockReturnValueOnce(enrollmentQuery)
      .mockReturnValueOnce(yearQuery)
      .mockReturnValueOnce(existingPlanQuery)
      .mockReturnValueOnce(updateQuery);

    await registerStudentForInclusiveEducation('institution-1', 'student-1');

    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFT',
      class_id: 'class-1',
      updated_by: 'director-profile',
    }));
    expect(mocks.from).not.toHaveBeenCalledWith('student_health_information');
  });

  it('requires an active enrollment before attempting registration', async () => {
    const enrollmentQuery = queryBuilder({ maybeSingle: { data: null, error: null } });
    mocks.from.mockReturnValueOnce(enrollmentQuery);

    await expect(registerStudentForInclusiveEducation('institution-1', 'student-1'))
      .rejects.toThrow('O aluno precisa ter uma matrícula ativa');
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
