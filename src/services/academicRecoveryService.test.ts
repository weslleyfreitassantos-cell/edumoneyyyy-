import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { termClosingService } from './termClosingService';
import { academicRecoveryService } from './academicRecoveryService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('./termClosingService', () => ({
  termClosingService: {
    getPreview: vi.fn(),
  },
}));

function queryResult(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };

  return query;
}

describe('academicRecoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista apenas alunos elegíveis e carrega a recuperação em lote', async () => {
    vi.mocked(termClosingService.getPreview).mockResolvedValue({
      offering: { termId: 'term-1' },
      policy: {
        minimumGradePercentage: 60,
        minimumAttendancePercentage: 75,
        decimalPlaces: 1,
      },
      closure: { status: 'REOPENED' },
      students: [
        {
          student: { id: 'student-1', fullName: 'Ana' },
          gradePercentage: 50,
          attendancePercentage: 90,
          resultStatus: 'FAILED_BY_GRADE',
        },
        {
          student: { id: 'student-2', fullName: 'Bia' },
          gradePercentage: 80,
          attendancePercentage: 90,
          resultStatus: 'APPROVED',
        },
      ],
    } as never);
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === 'student_term_results') {
        return queryResult([{
          student_id: 'student-1',
          grade_percentage: 50,
          attendance_percentage: 90,
          original_result_status: 'FAILED_BY_GRADE',
          result_status: 'FAILED_BY_GRADE',
          finalized_at: '2026-08-01T00:00:00Z',
        }]) as never;
      }

      return queryResult([{
        id: 'recovery-1',
        institution_id: 'inst-1',
        academic_year_id: 'year-1',
        term_id: 'term-1',
        subject_offering_id: 'offering-1',
        student_id: 'student-1',
        status: 'PUBLISHED',
        recovery_percentage: 75,
        composition_rule: 'HIGHEST_SCORE_V1',
        notes: null,
        recorded_by: 'teacher-1',
        published_at: '2026-09-01T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      }]);
    }) as never);

    const candidates = await academicRecoveryService.listCandidates('inst-1', 'offering-1');

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      student: { id: 'student-1' },
      originalGradePercentage: 50,
      recovery: { status: 'PUBLISHED', recoveryPercentage: 75 },
      closureStatus: 'REOPENED',
    });
  });

  it('nao lista reprovacao calculada apenas no preview sem snapshot oficial', async () => {
    vi.mocked(termClosingService.getPreview).mockResolvedValue({
      offering: { termId: 'term-1' },
      policy: null,
      closure: null,
      students: [{
        student: { id: 'student-1', fullName: 'Ana' },
        gradePercentage: 50,
        attendancePercentage: 90,
        resultStatus: 'FAILED_BY_GRADE',
      }],
    } as never);
    vi.mocked(supabase.from).mockImplementation(() => queryResult([]) as never);

    await expect(academicRecoveryService.listCandidates('inst-1', 'offering-1'))
      .resolves.toEqual([]);
  });

  it('salva e publica pela RPC transacional do domínio', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        id: 'recovery-1',
        institution_id: 'inst-1',
        academic_year_id: 'year-1',
        term_id: 'term-1',
        subject_offering_id: 'offering-1',
        student_id: 'student-1',
        status: 'PUBLISHED',
        recovery_percentage: 74,
        composition_rule: 'HIGHEST_SCORE_V1',
        notes: null,
        recorded_by: 'teacher-1',
        published_at: '2026-09-01T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      error: null,
    } as never);

    const recovery = await academicRecoveryService.save({
      institutionId: 'inst-1',
      academicYearId: 'year-1',
      termId: 'term-1',
      subjectOfferingId: 'offering-1',
      studentId: 'student-1',
      recoveryPercentage: 74,
      status: 'PUBLISHED',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('save_academic_recovery', expect.objectContaining({
      p_recovery_percentage: 74,
      p_status: 'PUBLISHED',
    }));
    expect(recovery).toMatchObject({ status: 'PUBLISHED', recoveryPercentage: 74 });
  });
});
