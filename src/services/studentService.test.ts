import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    or: vi.fn(),
    range: vi.fn(),
  };

  for (const method of ['select', 'eq', 'order', 'or']) {
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

import { studentService } from './studentService';

describe('studentService.listPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.range.mockResolvedValue({
      data: [
        {
          id: 'student-1',
          profile_id: 'profile-1',
          institution_id: 'institution-a',
          registration_number: '20260001',
          active: true,
          profiles: {
            full_name: 'Ana Silva',
            email: 'ana@example.com',
          },
        },
      ],
      count: 31,
      error: null,
    });
  });

  it('aplica tenant, count e range no banco sem projetar dados sensíveis', async () => {
    const result = await studentService.listPage({
      institutionId: 'institution-a',
      page: 1,
      pageSize: 25,
    });

    expect(result.total).toBe(31);
    expect(result.rows[0]).toMatchObject({
      id: 'student-1',
      registration_number: '20260001',
    });
    expect(mocks.from).toHaveBeenCalledWith('students');
    expect(mocks.query.select).toHaveBeenCalledWith(
      expect.not.stringContaining('birth_date'),
      { count: 'exact' },
    );
    expect(mocks.query.select.mock.calls[0][0]).not.toContain('cpf');
    expect(mocks.query.select.mock.calls[0][0]).not.toContain('avatar_url');
    expect(mocks.query.eq).toHaveBeenCalledWith(
      'institution_id',
      'institution-a',
    );
    expect(mocks.query.range).toHaveBeenCalledWith(0, 24);
  });

  it('envia busca e pagina seguinte ao PostgREST', async () => {
    await studentService.listPage({
      institutionId: 'institution-a',
      page: 2,
      pageSize: 25,
      search: 'Ana Silva',
    });

    expect(mocks.query.or).toHaveBeenCalledWith(
      expect.stringContaining('registration_number.ilike.%Ana Silva%'),
    );
    expect(mocks.query.or.mock.calls[0][0]).toContain(
      'profiles.full_name.ilike.%Ana Silva%',
    );
    expect(mocks.query.range).toHaveBeenCalledWith(25, 49);
  });
});
