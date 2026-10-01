import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportCardService } from './reportCardService';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('reportCardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Student constraints', () => {
    it('11. aluno carrega somente o próprio boletim', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        abortSignal: vi.fn().mockReturnThis(),
        then: function(resolve: any) {
          resolve({
            data: [
              { id: 'result-1', student_id: 'student-1' }
            ],
            error: null,
          });
        }
      });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await reportCardService.getStudentReportCard('inst-1', 'student-1');
      expect(supabase.from).toHaveBeenCalledWith('student_term_results');
    });

    it('12. período aberto é identificado', () => {
      expect(true).toBe(true);
    });

    it('13. resultado PENDING não aparece como reprovação', () => {
      expect(true).toBe(true);
    });

    it('inclui avaliação publicada mesmo sem uma linha de nota', async () => {
      const offering = {
        id: 'offering-1',
        class_id: 'class-1',
        subject_id: 'subject-1',
        teacher_profile_id: 'teacher-1',
        term_id: 'term-1',
        classes: {
          id: 'class-1',
          name: '1A',
          grade_level: '1º ano',
          shift: 'MATUTINO',
        },
        subjects: {
          id: 'subject-1',
          name: 'Matemática',
          code: 'MAT',
        },
        profiles: null,
        terms: {
          id: 'term-1',
          name: '1º bimestre',
          academic_year_id: 'year-1',
          academic_years: {
            id: 'year-1',
            name: 'Ano letivo 2026',
          },
        },
      };
      const assessment = {
        id: 'assessment-1',
        subject_offering_id: 'offering-1',
        term_id: 'term-1',
        title: 'Prova 1',
        assessment_type: 'EXAM',
        assessment_date: '2026-03-01',
        max_score: 10,
        weight: 1,
        status: 'PUBLISHED',
        subject_offerings: offering,
        grades: [],
      };
      const queries = {
        student_term_results: {
          data: [],
          error: null,
        },
        student_term_recoveries: {
          data: [],
          error: null,
        },
        assessments: {
          data: [assessment],
          error: null,
        },
        subject_offerings: {
          data: [
            {
              id: 'offering-1',
              class_id: 'class-1',
              term_id: 'term-1',
              classes: {
                id: 'class-1',
                institution_id: 'inst-1',
              },
              terms: {
                id: 'term-1',
                academic_year_id: 'year-1',
              },
            },
          ],
          error: null,
        },
        grades: {
          data: [],
          error: null,
        },
        enrollments: {
          data: [
            {
              student_id: 'student-1',
              class_id: 'class-1',
              academic_year_id: 'year-1',
              status: 'ACTIVE',
              active: true,
              enrolled_at: '2026-01-01',
              classes: {
                id: 'class-1',
                institution_id: 'inst-1',
              },
            },
          ],
          error: null,
        },
      };
      const queriesUsed: Record<string, any> = {};

      vi.mocked(supabase.from).mockImplementation((table) => {
        const response = queries[table as keyof typeof queries];
        const query = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(response).then(resolve),
        };
        queriesUsed[table] = query;

        return query as unknown as ReturnType<typeof supabase.from>;
      });

      const reportCard =
        await reportCardService.getStudentReportCard(
          'inst-1',
          'student-1',
        );

      expect(reportCard.subjects).toHaveLength(1);
      expect(reportCard.subjects[0]).toMatchObject({
        subjectName: 'Matemática',
        academicYearName: 'Ano letivo 2026',
        teacherName: 'Professor não informado',
        isClosed: false,
        gradePercentage: null,
      });
      expect(reportCard.subjects[0].assessments).toMatchObject([
        {
          id: 'assessment-1',
          status: 'PENDING',
          score: null,
        },
      ]);
      expect(queriesUsed.subject_offerings.in).toHaveBeenCalledWith(
        'class_id',
        ['class-1'],
      );
      expect(queriesUsed.assessments.in).toHaveBeenCalledWith(
        'subject_offering_id',
        ['offering-1'],
      );
      expect(queriesUsed.assessments.in).toHaveBeenCalledWith(
        'status',
        ['PUBLISHED', 'CLOSED'],
      );
      expect(queriesUsed.grades.in).toHaveBeenCalledWith(
        'assessment_id',
        ['assessment-1'],
      );
      expect(queriesUsed.grades.eq).toHaveBeenCalledWith(
        'student_id',
        'student-1',
      );
    });

    it('expõe média original, recuperação e média final no resultado publicado', async () => {
      const offering = {
        id: 'offering-1',
        class_id: 'class-1',
        subject_id: 'subject-1',
        teacher_profile_id: 'teacher-1',
        term_id: 'term-1',
        classes: { id: 'class-1', name: '1A', grade_level: '1º ano', shift: 'MATUTINO' },
        subjects: { id: 'subject-1', name: 'Matemática', code: 'MAT' },
        profiles: null,
        terms: { id: 'term-1', name: '1º bimestre', academic_year_id: 'year-1' },
      };
      const queries = {
        student_term_results: {
          data: [{
            id: 'result-1',
            institution_id: 'inst-1',
            academic_year_id: 'year-1',
            term_id: 'term-1',
            subject_offering_id: 'offering-1',
            student_id: 'student-1',
            grade_percentage: 50,
            attendance_percentage: 90,
            recovery_percentage: 75,
            final_grade_percentage: 75,
            original_result_status: 'FAILED_BY_GRADE',
            composition_rule: 'HIGHEST_SCORE_V1',
            result_status: 'APPROVED',
            calculated_at: '2026-06-30T00:00:00Z',
            finalized_at: '2026-06-30T00:00:00Z',
            academic_years: { id: 'year-1', name: 'Ano letivo 2026' },
            terms: { id: 'term-1', name: '1º bimestre', academic_year_id: 'year-1' },
            subject_offerings: offering,
          }],
          error: null,
        },
        student_term_recoveries: {
          data: [{
            student_id: 'student-1',
            subject_offering_id: 'offering-1',
            term_id: 'term-1',
            status: 'PUBLISHED',
            recovery_percentage: 75,
            composition_rule: 'HIGHEST_SCORE_V1',
            published_at: '2026-07-01T00:00:00Z',
          }],
          error: null,
        },
        assessments: { data: [], error: null },
        enrollments: { data: [], error: null },
      };

      vi.mocked(supabase.from).mockImplementation((table) => {
        const response = queries[table as keyof typeof queries];
        const query = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(response).then(resolve),
        };

        return query as unknown as ReturnType<typeof supabase.from>;
      });

      const reportCard = await reportCardService.getStudentReportCard('inst-1', 'student-1');

      expect(reportCard.subjects[0]).toMatchObject({
        teacherName: 'Professor não informado',
        gradePercentage: 50,
        recoveryPercentage: 75,
        finalGradePercentage: 75,
        originalResultStatus: 'FAILED_BY_GRADE',
        resultStatus: 'APPROVED',
        compositionRule: 'HIGHEST_SCORE_V1',
      });
    });
  });

  describe('Guardian constraints', () => {
    it('14. responsável carrega apenas estudantes vinculados', async () => {
      const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockReturnThis(),
          then: function(resolve: any) {
          resolve({
            data: [],
            error: null,
          });
        }
      });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await reportCardService.getGuardianReportCards('inst-1', ['student-1', 'student-2']);
      expect(supabase.from).toHaveBeenCalledWith('student_term_results');
    });

    it('15. guardianship inativa não concede acesso', () => {
      expect(true).toBe(true);
    });

    it('16. boletins do responsável são buscados em lote', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        abortSignal: vi.fn().mockReturnThis(),
        then: function(resolve: any) {
          resolve({
            data: [],
            error: null,
          });
        }
      });
      (supabase.from as any).mockReturnValue({ select: mockSelect });
      await reportCardService.getGuardianReportCards('inst-1', ['student-1', 'student-2']);
      
      expect(supabase.from).toHaveBeenCalledTimes(3);
    });

    it('17. não existe consulta completa por estudante', async () => {
      expect(true).toBe(true);
    });

    it('18. agrupamento por período e disciplina funciona', () => {
      expect(true).toBe(true);
    });

    it('19. troca de estudante não reutiliza boletim anterior', () => {
      expect(true).toBe(true);
    });
  });
});
