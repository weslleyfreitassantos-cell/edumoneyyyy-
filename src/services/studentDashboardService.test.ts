import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {},
}));

import {
  filterStudentOfferingsToCurrentTerm,
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
