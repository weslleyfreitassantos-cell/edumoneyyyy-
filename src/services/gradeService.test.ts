import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  GradeServiceError,
  buildGradeEntryRecords,
  calculateGradePercentage,
  calculateGradeSummary,
  gradeService,
  isEnrollmentValidForAssessmentDate,
  normalizeGradeInput,
} from './gradeService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

interface MockQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: Promise<unknown>['then'];
}

function createQuery(response: unknown): MockQuery {
  const query = {} as MockQuery;

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.lte = vi.fn(() => query);
  query.neq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.then = (
    resolve,
    reject,
  ) => Promise.resolve(response).then(resolve, reject);

  return query;
}

describe('gradeService', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
  });

  it('calcula percentual sem assumir escala fixa', () => {
    expect(calculateGradePercentage(5, 20)).toBe(25);
    expect(calculateGradePercentage(null, 20)).toBeNull();
    expect(calculateGradePercentage(5, 0)).toBeNull();
  });

  it('não transforma nota vazia em zero e aceita zero real', () => {
    expect(
      normalizeGradeInput(
        {
          studentId: 'student-1',
          score: null,
        },
        10,
      ),
    ).toMatchObject({
      score: null,
      status: 'PENDING',
    });

    expect(
      normalizeGradeInput(
        {
          studentId: 'student-1',
          score: 0,
        },
        10,
      ),
    ).toMatchObject({
      score: 0,
      status: 'GRADED',
    });
  });

  it('bloqueia nota fora da faixa', () => {
    expect(() =>
      normalizeGradeInput(
        {
          studentId: 'student-1',
          score: -1,
        },
        10,
      ),
    ).toThrow(GradeServiceError);

    expect(() =>
      normalizeGradeInput(
        {
          studentId: 'student-1',
          score: 11,
        },
        10,
      ),
    ).toThrow(GradeServiceError);
  });

  it('calcula média ignorando ausentes e usando pesos quando disponíveis', () => {
    const summary = calculateGradeSummary([
      {
        score: 8,
        maxScore: 10,
        weight: 2,
        status: 'GRADED',
      },
      {
        score: 5,
        maxScore: 10,
        weight: 1,
        status: 'GRADED',
      },
      {
        score: null,
        maxScore: 10,
        status: 'PENDING',
      },
      {
        score: null,
        maxScore: 10,
        status: 'EXCUSED',
      },
    ]);

    expect(summary.totalAssessments).toBe(4);
    expect(summary.gradedCount).toBe(2);
    expect(summary.pendingCount).toBe(1);
    expect(summary.excusedCount).toBe(1);
    expect(summary.averageScore).toBe(6.5);
    expect(summary.averagePercent).toBe(65);
    expect(summary.weightedAveragePercent).toBe(70);
  });

  it('valida matrícula ativa na data da avaliação', () => {
    expect(
      isEnrollmentValidForAssessmentDate(
        {
          active: true,
          status: 'ACTIVE',
          enrolled_at:
            '2026-03-01T10:00:00.000Z',
        },
        '2026-03-02',
      ),
    ).toBe(true);

    expect(
      isEnrollmentValidForAssessmentDate(
        {
          active: true,
          status: 'CANCELLED',
          enrolled_at:
            '2026-03-01T10:00:00.000Z',
        },
        '2026-03-02',
      ),
    ).toBe(false);

    expect(
      isEnrollmentValidForAssessmentDate(
        {
          active: true,
          status: 'ACTIVE',
          enrolled_at:
            '2026-03-03T00:00:00.000Z',
        },
        '2026-03-02',
      ),
    ).toBe(false);
  });

  it('monta lançamento preservando zero e pendente', () => {
    const rows = buildGradeEntryRecords(
      [
        {
          id: 'student-1',
          profileId: 'profile-1',
          fullName: 'Ana Silva',
          email: 'ana@escola.com',
          registrationNumber: 'RA-001',
          enrollmentId: 'enrollment-1',
        },
        {
          id: 'student-2',
          profileId: 'profile-2',
          fullName: 'Bruno Lima',
          email: 'bruno@escola.com',
          registrationNumber: 'RA-002',
          enrollmentId: 'enrollment-2',
        },
      ],
      [
        {
          id: 'grade-1',
          institution_id: 'institution-1',
          assessment_id: 'assessment-1',
          student_id: 'student-1',
          score: 0,
          status: 'GRADED',
          feedback: null,
          recorded_by: 'teacher-1',
          recorded_at:
            '2026-03-02T10:00:00.000Z',
          created_at:
            '2026-03-02T10:00:00.000Z',
          updated_at:
            '2026-03-02T10:00:00.000Z',
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      score: 0,
      status: 'GRADED',
    });
    expect(rows[1]).toMatchObject({
      score: null,
      status: 'PENDING',
    });
  });

  it('lista apenas atribuições do professor na instituição', async () => {
    const query = createQuery({
      data: [
        {
          id: 'offering-1',
          class_id: 'class-1',
          subject_id: 'subject-1',
          teacher_profile_id: 'teacher-1',
          term_id: 'term-1',
          active: true,
          created_at:
            '2026-03-02T10:00:00.000Z',
          classes: {
            id: 'class-1',
            institution_id: 'institution-1',
            academic_year_id: 'year-1',
            name: '1A',
            grade_level: '1º ano',
            shift: 'Manhã',
            active: true,
          },
          subjects: {
            id: 'subject-1',
            institution_id: 'institution-1',
            name: 'Matemática',
            code: 'MAT',
            workload: 80,
            active: true,
          },
          profiles: {
            full_name: 'Professora Ana',
            email: 'ana@escola.com',
            active: true,
          },
          terms: {
            id: 'term-1',
            academic_year_id: 'year-1',
            name: '1º bimestre',
            active: true,
          },
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue(
      query as unknown as ReturnType<typeof supabase.from>,
    );

    const offerings =
      await gradeService.listTeacherOfferings(
        'teacher-1',
        'institution-1',
      );

    expect(offerings).toHaveLength(1);
    expect(offerings[0]).toMatchObject({
      id: 'offering-1',
      subjectName: 'Matemática',
      className: '1A',
      termName: '1º bimestre',
    });
    expect(query.eq).toHaveBeenCalledWith(
      'teacher_profile_id',
      'teacher-1',
    );
  });

  it('decompõe o resumo institucional em avaliações, notas e matrículas', async () => {
    const offering = {
      id: 'offering-1',
      class_id: 'class-1',
      subject_id: 'subject-1',
      teacher_profile_id: 'teacher-1',
      term_id: 'term-1',
      active: true,
      created_at: '2026-03-01T00:00:00.000Z',
      classes: {
        id: 'class-1',
        institution_id: 'institution-1',
        academic_year_id: 'year-1',
        name: '1A',
        grade_level: '1º ano',
        shift: 'Manhã',
        active: true,
      },
      subjects: {
        id: 'subject-1',
        institution_id: 'institution-1',
        name: 'Matemática',
        code: 'MAT',
        workload: 80,
        active: true,
      },
      profiles: {
        full_name: 'Professora Ana',
        email: 'ana@escola.com',
        active: true,
      },
      terms: {
        id: 'term-1',
        academic_year_id: 'year-1',
        name: '1º bimestre',
        active: true,
      },
    };
    const assessmentQuery = createQuery({
      data: [{
        id: 'assessment-1',
        institution_id: 'institution-1',
        subject_offering_id: 'offering-1',
        term_id: 'term-1',
        title: 'Prova 1',
        description: null,
        assessment_type: 'EXAM',
        assessment_date: '2026-03-10',
        max_score: 10,
        weight: 1,
        status: 'PUBLISHED',
        created_by: 'teacher-1',
        published_at: '2026-03-01T00:00:00.000Z',
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
        subject_offerings: offering,
      }],
      error: null,
    });
    const gradesQuery = createQuery({
      data: [{
        id: 'grade-1',
        institution_id: 'institution-1',
        assessment_id: 'assessment-1',
        student_id: 'student-1',
        score: 8,
        status: 'GRADED',
        feedback: null,
        recorded_by: 'teacher-1',
        recorded_at: '2026-03-11T00:00:00.000Z',
        created_at: '2026-03-11T00:00:00.000Z',
        updated_at: '2026-03-11T00:00:00.000Z',
      }],
      error: null,
    });
    const enrollmentQuery = createQuery({
      data: [{
        id: 'enrollment-1',
        student_id: 'student-1',
        class_id: 'class-1',
        academic_year_id: 'year-1',
        status: 'ACTIVE',
        active: true,
        enrolled_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      }],
      error: null,
    });
    const studentsQuery = createQuery({
      data: [{
        id: 'student-1',
        profile_id: 'profile-1',
        institution_id: 'institution-1',
        registration_number: 'RA-001',
        active: true,
        profiles: {
          full_name: 'Ana Silva',
          email: 'ana@escola.com',
          avatar_url: null,
        },
      }],
      error: null,
    });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(assessmentQuery as never)
      .mockReturnValueOnce(gradesQuery as never)
      .mockReturnValueOnce(enrollmentQuery as never)
      .mockReturnValueOnce(studentsQuery as never);

    const summary = await gradeService.getInstitutionGradeSummary(
      'institution-1',
      { fromDate: '2026-03-01', toDate: '2026-03-31' },
    );

    expect(summary.assessments).toHaveLength(1);
    expect(summary.assessments[0]).toMatchObject({
      launchedCount: 1,
      expectedStudentCount: 1,
      averagePercent: 80,
    });
    expect(assessmentQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining('grades ('),
    );
    expect(supabase.from).toHaveBeenCalledWith('assessments');
    expect(supabase.from).toHaveBeenCalledWith('grades');
    expect(supabase.from).toHaveBeenCalledWith('enrollments');
    expect(supabase.from).toHaveBeenCalledWith('students');
  });

  it('preserva erro da consulta de notas em vez de retornar avaliações vazias', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      createQuery({
        data: null,
        error: {
          code: '57014',
          message: 'canceling statement due to statement timeout',
        },
      }) as never,
    );

    await expect(
      gradeService.getInstitutionGradeSummary(
        'institution-1',
        { fromDate: '2026-02-01', toDate: '2026-12-18' },
      ),
    ).rejects.toMatchObject({
      code: 'ASSESSMENT_FORBIDDEN',
    } satisfies Partial<GradeServiceError>);
  });
});
