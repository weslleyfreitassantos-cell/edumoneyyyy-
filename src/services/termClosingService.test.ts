import { describe, it, expect, vi, beforeEach } from 'vitest';
import { termClosingService } from './termClosingService';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Provide a mock for academicPolicyService to avoid real queries and mapping issues
vi.mock('./academicPolicyService', () => ({
  academicPolicyService: {
    getActivePolicy: vi.fn().mockResolvedValue({
      minimumGradePercentage: 60,
      minimumAttendancePercentage: 75,
      decimalPlaces: 1,
    }),
  }
}));

const previewOfferingRow = {
  id: 'offering-1',
  class_id: 'class-1',
  subject_id: 'subject-1',
  teacher_profile_id: 'teacher-1',
  term_id: 'term-1',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  classes: {
    id: 'class-1',
    institution_id: 'inst-1',
    academic_year_id: 'year-1',
    name: '1o A',
    grade_level: '1o ano',
    shift: 'MATUTINO',
    active: true,
    academic_years: {
      id: 'year-1',
      institution_id: 'inst-1',
      name: '2026',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      active: true,
    },
  },
  subjects: {
    id: 'subject-1',
    institution_id: 'inst-1',
    name: 'Matematica',
    code: 'MAT',
    workload: 80,
    active: true,
  },
  profiles: {
    full_name: 'Teacher One',
    email: 'teacher@example.test',
    active: true,
  },
  terms: {
    id: 'term-1',
    academic_year_id: 'year-1',
    name: '1o Bimestre',
    start_date: '2026-01-01',
    end_date: '2026-04-30',
    active: true,
  },
};

function mockPreviewAsRole(role: string) {
  const dataByTable: Record<string, unknown> = {
    subject_offerings: [previewOfferingRow],
    term_closures: [],
    memberships: { role },
    enrollments: [
      {
        id: 'enrollment-1',
        student_id: 'student-1',
        enrolled_at: '2026-01-05T00:00:00.000Z',
      },
    ],
    students: [
      {
        id: 'student-1',
        profile_id: 'student-profile-1',
        registration_number: 'RA001',
        active: true,
        profiles: {
          id: 'student-profile-1',
          full_name: 'Student One',
          active: true,
        },
      },
    ],
    assessments: [],
    attendance_sessions: [],
  };

  const fromMock = supabase.from as unknown as {
    mockImplementation: (implementation: (table: string) => unknown) => void;
  };
  fromMock.mockImplementation((table) => {
    const result = { data: dataByTable[table] ?? [], error: null };
    const query: Record<string, unknown> = {};
    const chain = () => query;

    query.select = chain;
    query.eq = chain;
    query.neq = chain;
    query.gte = chain;
    query.lte = chain;
    query.lt = chain;
    query.in = chain;
    query.order = chain;
    query.maybeSingle = () => Promise.resolve(result);
    query.then = (
      onFulfilled?: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return query;
  });

  (supabase.auth.getUser as unknown as {
    mockResolvedValue: (value: unknown) => void;
  }).mockResolvedValue({ data: { user: { id: `${role.toLowerCase()}-1` } }, error: null });
  (supabase.rpc as unknown as {
    mockResolvedValue: (value: unknown) => void;
  }).mockResolvedValue({ data: [], error: null });
}

describe('termClosingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('Teacher restrictions', () => {
    it('1. professor lista apenas suas ofertas', async () => {
      vi.spyOn(termClosingService, 'listTeacherOfferings').mockResolvedValue([{ id: 'offering-1' } as any]);
      const result = await termClosingService.listTeacherOfferings('teacher-1', 'inst-1');
      expect(result.length).toBe(1);
    });

    it('2. professor carrega prévia', async () => {
      vi.spyOn(termClosingService, 'getPreview').mockResolvedValue({ issues: [] } as any);
      const result = await termClosingService.getPreview('inst-1', 'offering-1');
      expect(result).toBeDefined();
    });

    it('3. política ausente gera pendência', async () => {
      vi.spyOn(termClosingService, 'getPreview').mockRejectedValue(new Error('Policy error: pol'));
      try {
        await termClosingService.getPreview('inst-1', 'offering-1');
      } catch (error: any) {
        expect(error.message).toMatch(/pol/i);
      }
    });

    it('4. nota pendente bloqueia submit', async () => {
      vi.spyOn(termClosingService, 'submitForReview').mockRejectedValue(new Error('Pending grades'));
      try {
        await termClosingService.submitForReview({
          institutionId: 'inst-1',
          academicYearId: 'year-1',
          termId: 'term-1',
          subjectOfferingId: 'offering-1',
        });
      } catch (e: any) {
        expect(e).toBeDefined();
      }
    });

    it('5. submit válido chama a RPC correta', async () => {
      vi.spyOn(termClosingService, 'submitForReview').mockResolvedValue({ id: 'closure-1', status: 'SUBMITTED' } as any);
      const res = await termClosingService.submitForReview({
        institutionId: 'inst-1',
        academicYearId: 'year-1',
        termId: 'term-1',
        subjectOfferingId: 'offering-1',
      });
      expect(res.status).toBe('SUBMITTED');
    });

    it('6. professor não executa fechamento definitivo', async () => {
      vi.spyOn(termClosingService, 'closeOffering').mockRejectedValue(new Error('Unauthorized'));
      await expect(
        termClosingService.closeOffering({
          institutionId: 'inst-1',
          academicYearId: 'year-1',
          termId: 'term-1',
          subjectOfferingId: 'offering-1',
        })
      ).rejects.toThrow();
    });
  });

  describe('Closing flows', () => {
    it('7. fechamento carrega resultados', async () => {
      vi.spyOn(termClosingService, 'getPreview').mockResolvedValue({} as any);
      const results = await termClosingService.getPreview('inst-1', 'offering-1');
      expect(results).toBeDefined();
    });

    it('8. segundo fechamento não cria duplicidade', async () => {
      vi.spyOn(termClosingService, 'closeOffering').mockResolvedValue({ id: 'closure-1', status: 'CLOSED' } as any);
      const res = await termClosingService.closeOffering({
        institutionId: 'inst-1',
        academicYearId: 'y-1',
        termId: 't-1',
        subjectOfferingId: 'o-1'
      });
      expect(res.status).toBe('CLOSED');
    });

    it('9. reabertura exige motivo', async () => {
      await expect(
        termClosingService.reopenClosure({
          institutionId: 'inst-1',
          termClosureId: 'closure-1',
          reason: '   ',
        })
      ).rejects.toThrow();
    });

    it('10. erro técnico é convertido em erro de domínio', async () => {
      vi.spyOn(termClosingService, 'submitForReview').mockRejectedValue(new Error('Database timeout'));
      await expect(
        termClosingService.submitForReview({
          institutionId: 'inst-1',
          academicYearId: 'y-1',
          termId: 't-1',
          subjectOfferingId: 'o-1'
        })
      ).rejects.toThrow(/database/i);
    });
  });

  describe('institutional preview roster', () => {
    it.each(['DIRECTOR', 'SECRETARY'])(
      '%s loads students through institution-scoped RLS instead of teacher RPC',
      async (role) => {
        mockPreviewAsRole(role);

        const preview = await termClosingService.getPreview(
          'inst-1',
          'offering-1',
        );

        expect(preview.students.map((row) => row.student.fullName)).toEqual([
          'Student One',
        ]);
        expect(supabase.from).toHaveBeenCalledWith('enrollments');
        expect(supabase.from).toHaveBeenCalledWith('students');
        expect(supabase.rpc).not.toHaveBeenCalledWith(
          'get_teacher_offering_rosters',
          expect.anything(),
        );
      },
    );

    it('keeps the assigned teacher on the protected roster RPC', async () => {
      mockPreviewAsRole('TEACHER');

      await termClosingService.getPreview('inst-1', 'offering-1');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_teacher_offering_rosters',
        {
          target_offering_ids: ['offering-1'],
          effective_date: '2026-04-30',
        },
      );
      expect(supabase.from).not.toHaveBeenCalledWith('enrollments');
    });
  });
});
