import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';

import {
  curriculumService,
  curriculumCreateSchema,
  curriculumUpdateSchema,
} from './curriculumService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const UUID = '00000000-0000-0000-0000-000000000000';
const baseItem = {
  id: UUID,
  institution_id: UUID,
  class_id: UUID,
  subject_id: UUID,
  weekly_lessons: 3,
  lesson_duration_minutes: 50,
  needs_review: false,
  active: true,
  created_at: null,
  updated_at: null,
  classes: { name: '1A', academic_year_id: UUID },
  subjects: { name: 'Português', code: 'LP' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSupabaseOnce(handlers: Record<string, (...args: any[]) => any>) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const [method, impl] of Object.entries(handlers)) {
    builder[method] = vi.fn(impl);
  }
  vi.mocked(supabase.from).mockReturnValue(builder as never);
}

describe('curriculumService.list', () => {
  it('retorna itens da matriz para uma instituicao', async () => {
    mockSupabaseOnce({
      select: () => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [baseItem], error: null }),
        })),
      }),
    });
    const result = await curriculumService.list(UUID);
    expect(result).toHaveLength(1);
    expect(result[0].class_name).toBe('1A');
    expect(result[0].subject_name).toBe('Português');
  });

  it('retorna lista vazia quando nao ha itens', async () => {
    mockSupabaseOnce({
      select: () => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }),
    });
    const result = await curriculumService.list(UUID);
    expect(result).toEqual([]);
  });
});

describe('curriculumService.create', () => {
  function mockCreateDeps() {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: UUID }, error: null });
    const assertEq2 = vi.fn().mockReturnValue({ maybeSingle });
    const assertEq1 = vi.fn().mockReturnValue({ eq: assertEq2 });
    const assertSelect = vi.fn().mockReturnValue({ eq: assertEq1 });

    const single = vi.fn().mockResolvedValue({ data: baseItem, error: null });
    const insertSelect = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    vi.mocked(supabase.from).mockReturnValue({
      select: assertSelect,
      insert,
    } as never);
  }

  it('cria item da matriz com dados validos', async () => {
    mockCreateDeps();
    const result = await curriculumService.create({
      institution_id: UUID,
      class_id: UUID,
      subject_id: UUID,
      weekly_lessons: 3,
      lesson_duration_minutes: 50,
    });
    expect(result.subject_name).toBe('Português');
  });

  it('rejeita duplicidade com erro amigavel', async () => {
    const dupeError = new Error('duplicate key value violates unique constraint "class_curriculum_items_class_subject_unique"');
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: UUID }, error: null });
    const assertEq2 = vi.fn().mockReturnValue({ maybeSingle });
    const assertEq1 = vi.fn().mockReturnValue({ eq: assertEq2 });
    const assertSelect = vi.fn().mockReturnValue({ eq: assertEq1 });

    const single = vi.fn().mockResolvedValue({ data: null, error: dupeError });
    const insertSelect = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    vi.mocked(supabase.from).mockReturnValue({
      select: assertSelect,
      insert,
    } as never);

    await expect(
      curriculumService.create({
        institution_id: UUID,
        class_id: UUID,
        subject_id: UUID,
        weekly_lessons: 3,
        lesson_duration_minutes: 50,
      }),
    ).rejects.toThrow('A disciplina já está presente na matriz desta turma.');
  });
});

describe('curriculumService.update', () => {
  it('atualiza weekly_lessons e lesson_duration', async () => {
    const eq2 = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);
    await curriculumService.update(UUID, UUID, {
      weekly_lessons: 4,
      lesson_duration_minutes: 45,
    });
    expect(update).toHaveBeenCalled();
  });
});

describe('curriculumService.setActive', () => {
  it('desativa item da matriz', async () => {
    const eq2 = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);
    await curriculumService.setActive(UUID, UUID, false);
    expect(update.mock.calls[0][0].active).toBe(false);
  });

  it('rejeita CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS com erro amigavel', async () => {
    const err = new Error('CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS');
    const eq2 = vi.fn().mockResolvedValue({ data: null, error: err });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);
    await expect(
      curriculumService.setActive(UUID, UUID, false),
    ).rejects.toThrow('Desative primeiro as atribuições ativas desta disciplina.');
  });
});

describe('curriculum schemas', () => {
  it('valida curriculumCreateSchema', () => {
    const result = curriculumCreateSchema.safeParse({
      institution_id: UUID,
      class_id: UUID,
      subject_id: UUID,
      weekly_lessons: 3,
      lesson_duration_minutes: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita weekly_lessons fora do limite', () => {
    const result = curriculumCreateSchema.safeParse({
      institution_id: UUID,
      class_id: UUID,
      subject_id: UUID,
      weekly_lessons: 0,
      lesson_duration_minutes: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita lesson_duration_minutes fora do limite', () => {
    const result = curriculumUpdateSchema.safeParse({
      weekly_lessons: 2,
      lesson_duration_minutes: 200,
    });
    expect(result.success).toBe(false);
  });
});
