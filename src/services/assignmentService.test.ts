import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';

import { assignmentService } from './assignmentService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const institutionId = 'institution-1';

function createOffering(id: string) {
  return {
    id,
    class_id: 'class-1',
    subject_id: 'subject-1',
    teacher_profile_id: 'teacher-1',
    term_id: 'term-1',
    active: true,
    created_at: null,
    updated_at: null,
    classes: {
      id: 'class-1',
      institution_id: institutionId,
      academic_year_id: 'year-1',
      name: '1º ano A',
      grade_level: '1',
      shift: 'MATUTINO',
      active: true,
    },
    subjects: {
      id: 'subject-1',
      institution_id: institutionId,
      name: 'Matemática',
      code: 'MAT',
      active: true,
    },
    profiles: {
      full_name: 'Professor QA',
      email: 'professor@example.com',
      active: true,
    },
    terms: {
      id: 'term-1',
      academic_year_id: 'year-1',
      name: '1º Bimestre',
      active: true,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assignmentService.list', () => {
  it('carrega todas as páginas de ofertas além do limite padrão do Supabase', async () => {
    const firstPage = Array.from(
      { length: 1000 },
      (_, index) => createOffering(`offering-${index}`),
    );
    const secondPage = [createOffering('offering-last')];
    const range = vi.fn()
      .mockResolvedValueOnce({
        data: firstPage,
        error: null,
      })
      .mockResolvedValueOnce({
        data: secondPage,
        error: null,
      });
    const order = vi.fn().mockReturnValue({ range });
    const select = vi.fn().mockReturnValue({ order });

    vi.mocked(supabase.from).mockReturnValue({
      select,
    } as never);

    const result = await assignmentService.list(institutionId);

    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(result).toHaveLength(1001);
    expect(result.some(({ id }) => id === 'offering-last')).toBe(true);
  });
});
