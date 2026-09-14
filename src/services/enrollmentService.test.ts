import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
  };

  for (const method of ['select', 'eq', 'in']) {
    query[method as keyof typeof query].mockReturnValue(query);
  }

  return {
    from: vi.fn(() => query),
    query,
  };
});

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { enrollmentService } from './enrollmentService';

describe('enrollmentService tenant scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.order.mockResolvedValue({ data: [], error: null });
  });

  it('envia os filtros de instituição nas relações antes de receber as matrículas', async () => {
    await enrollmentService.list('institution-a');

    expect(mocks.from).toHaveBeenCalledWith('enrollments');
    expect(mocks.query.select.mock.calls[0][0]).toContain(
      'students:student_id!inner',
    );
    expect(mocks.query.select.mock.calls[0][0]).toContain(
      'classes:class_id!inner',
    );
    expect(mocks.query.select.mock.calls[0][0]).toContain(
      'academic_years:academic_year_id!inner',
    );
    expect(mocks.query.eq).toHaveBeenCalledWith(
      'students.institution_id',
      'institution-a',
    );
    expect(mocks.query.eq).toHaveBeenCalledWith(
      'classes.institution_id',
      'institution-a',
    );
    expect(mocks.query.eq).toHaveBeenCalledWith(
      'academic_years.institution_id',
      'institution-a',
    );
  });
});
