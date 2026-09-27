import { describe, expect, it, vi } from 'vitest';

const { supabaseFrom } = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: supabaseFrom },
}));

import {
  filterStudentOfferingsToCurrentTerm,
  studentDashboardService,
  type StudentDashboardOffering,
} from './studentDashboardService';

const baseOffering: StudentDashboardOffering = {
  id: 'offering-1',
  subject_id: 'subject-1',
  subject_name: 'Matemática',
  subject_code: 'MAT',
  workload: 5,
  teacher_profile_id: 'teacher-1',
  teacher_name: 'Professor 1',
  teacher_email: 'professor@example.com',
  term_id: 'term-1',
  term_name: '1º Bimestre',
  term_start_date: '2026-01-01',
  term_end_date: '2026-04-02',
};

describe('filterStudentOfferingsToCurrentTerm', () => {
  it('retorna somente as disciplinas do período vigente', () => {
    const result = filterStudentOfferingsToCurrentTerm(
      [
        baseOffering,
        {
          ...baseOffering,
          id: 'offering-2',
          subject_name: 'Arte',
          term_id: 'term-2',
          term_name: '2º Bimestre',
          term_start_date: '2026-04-03',
          term_end_date: '2026-06-25',
        },
        {
          ...baseOffering,
          id: 'offering-3',
          subject_name: 'Biologia',
          term_id: 'term-3',
          term_name: '3º Bimestre',
          term_start_date: '2026-06-26',
          term_end_date: '2026-09-17',
        },
      ],
      '2026-08-26',
    );

    expect(result.map((offering) => offering.term_id)).toEqual([
      'term-3',
    ]);
  });

  it('usa o primeiro período como fallback fora do calendário', () => {
    const result = filterStudentOfferingsToCurrentTerm(
      [
        baseOffering,
        {
          ...baseOffering,
          id: 'offering-2',
          term_id: 'term-2',
          term_name: '2º Bimestre',
          term_start_date: '2026-04-03',
          term_end_date: '2026-06-25',
        },
      ],
      '2025-12-20',
    );

    expect(result.map((offering) => offering.term_id)).toEqual([
      'term-1',
    ]);
  });
});

describe('studentDashboardService dependent profile mapping', () => {
  it('mapeia o nome real vindo da relação profiles do aluno vinculado', async () => {
    const studentQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    studentQuery.select.mockReturnValue(studentQuery);
    studentQuery.eq.mockReturnValue(studentQuery);
    studentQuery.maybeSingle.mockResolvedValue({
      data: {
        id: 'student-1',
        profile_id: 'profile-student-1',
        institution_id: 'institution-1',
        registration_number: 'RA-001',
        birth_date: null,
        active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        profiles: {
          full_name: 'Maria da Silva',
          email: 'maria@example.test',
          avatar_url: null,
        },
      },
      error: null,
    });

    const enrollmentQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    enrollmentQuery.select.mockReturnValue(enrollmentQuery);
    enrollmentQuery.eq.mockReturnValue(enrollmentQuery);
    enrollmentQuery.order.mockResolvedValue({ data: [], error: null });

    supabaseFrom.mockImplementation((table: string) =>
      table === 'students' ? studentQuery : enrollmentQuery,
    );

    const result = await studentDashboardService.getDashboardByStudentId(
      'student-1',
      'institution-1',
    );

    expect(result.student.profile?.full_name).toBe('Maria da Silva');
    expect(supabaseFrom).toHaveBeenCalledWith('students');
    expect(supabaseFrom).toHaveBeenCalledWith('enrollments');
  });
});
