import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

import { studentService } from './studentService';

describe('studentService.listPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: 'student-1',
          profile_id: 'profile-1',
          institution_id: 'institution-a',
          registration_number: '20260001',
          active: true,
          full_name: 'Ana Silva',
          email: 'ana@example.com',
          total_count: 31,
        },
      ],
      error: null,
    });
  });

  it('usa a RPC paginada e não projeta dados sensíveis', async () => {
    const result = await studentService.listPage({
      institutionId: 'institution-a',
      page: 1,
      pageSize: 25,
    });

    expect(result.total).toBe(31);
    expect(result.rows[0]).toMatchObject({
      id: 'student-1',
      registration_number: '20260001',
      profiles: {
        full_name: 'Ana Silva',
        email: 'ana@example.com',
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith('list_students_page', {
      p_institution_id: 'institution-a',
      p_search: null,
      p_limit: 25,
      p_offset: 0,
    });
    expect(JSON.stringify(result.rows[0])).not.toContain('cpf');
    expect(JSON.stringify(result.rows[0])).not.toContain('birth_date');
    expect(JSON.stringify(result.rows[0])).not.toContain('avatar_url');
  });

  it('envia busca por nome, e-mail ou RA e offset ao banco', async () => {
    await studentService.listPage({
      institutionId: 'institution-a',
      page: 2,
      pageSize: 25,
      search: 'Ana Silva',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('list_students_page', {
      p_institution_id: 'institution-a',
      p_search: 'Ana Silva',
      p_limit: 25,
      p_offset: 25,
    });
  });
});
