import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  academicDocumentService,
  selectCurrentActiveEnrollment,
} from './academicDocumentService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function queryBuilder(response: { data: unknown; error: null }) {
  const builder: Record<string, any> = {};
  for (const method of ['select', 'eq', 'order']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(response);
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve(response));
  return builder;
}

describe('academicDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seleciona somente a matrícula ativa mais recente', () => {
    expect(selectCurrentActiveEnrollment([
      {
        id: 'old',
        classId: 'class-old',
        className: '1º A',
        academicYearId: 'year-old',
        academicYearName: '2025',
        status: 'ACTIVE',
        active: true,
        enrolledAt: '2025-02-01',
      },
      {
        id: 'cancelled',
        classId: 'class-cancelled',
        className: '2º A',
        academicYearId: 'year-new',
        academicYearName: '2026',
        status: 'CANCELLED',
        active: false,
        enrolledAt: '2026-02-01',
      },
      {
        id: 'current',
        classId: 'class-current',
        className: '2º A',
        academicYearId: 'year-new',
        academicYearName: '2026',
        status: 'active',
        active: true,
        enrolledAt: '2026-02-01',
      },
    ])?.id).toBe('current');
  });

  it('carrega ficha com escopo institucional, histórico e responsáveis ativos', async () => {
    const queries = {
      students: queryBuilder({
        data: {
          id: 'student-1',
          profile_id: 'profile-1',
          institution_id: 'institution-1',
          registration_number: '20260001',
          birth_date: '2010-05-10',
          cpf: '000.000.000-00',
          active: true,
          profiles: { full_name: 'Ana Silva', email: 'ana@example.com', phone: '(00) 99999-0000' },
        },
        error: null,
      }),
      student_registration_details: queryBuilder({
        data: { social_name: null, sex: 'Feminino', nationality: 'Brasileira' },
        error: null,
      }),
      student_addresses: queryBuilder({
        data: { street: 'Rua A', number: '10', city: 'Salvador', state: 'BA' },
        error: null,
      }),
      guardianships: queryBuilder({
        data: [{
          guardian_profile_id: 'guardian-1',
          relationship: 'Mãe',
          is_primary: true,
          active: true,
          profiles: { full_name: 'Maria Silva', email: 'maria@example.com', phone: null, active: true },
        }],
        error: null,
      }),
      enrollments: queryBuilder({
        data: [{
          id: 'enrollment-1',
          student_id: 'student-1',
          class_id: 'class-1',
          academic_year_id: 'year-1',
          status: 'ACTIVE',
          active: true,
          enrolled_at: '2026-02-01',
          created_at: '2026-02-01',
          classes: { id: 'class-1', institution_id: 'institution-1', name: '1º A' },
          academic_years: { id: 'year-1', institution_id: 'institution-1', name: '2026' },
        }],
        error: null,
      }),
    };

    vi.mocked(supabase.from).mockImplementation((table) => queries[table as keyof typeof queries] as never);

    const result = await academicDocumentService.getStudent('institution-1', 'student-1');

    expect(result.currentEnrollment?.className).toBe('1º A');
    expect(result.guardians).toHaveLength(1);
    expect(result.address?.city).toBe('Salvador');
    expect(queries.students.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(queries.student_registration_details.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(queries.student_addresses.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
  });

  it('recusa estudante retornado fora da instituição solicitada', async () => {
    const empty = queryBuilder({ data: null, error: null });
    const foreignStudent = queryBuilder({
      data: { id: 'student-1', institution_id: 'institution-2' },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'students') return foreignStudent as never;
      return empty as never;
    });

    await expect(
      academicDocumentService.getStudent('institution-1', 'student-1'),
    ).rejects.toThrow('Aluno não encontrado nesta instituição.');
  });
});
