// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import TeacherAssessmentsPanel from './TeacherAssessmentsPanel';

const createAssessment = vi.fn();
const saveGrades = vi.fn();
const useTeacherGradeOfferings = vi.fn();
const useAssessments = vi.fn();
const useGradeEntry = vi.fn();
const useCreateAssessment = vi.fn();
const useSaveGrades = vi.fn();

vi.mock('../../hooks/useGrades', () => ({
  useTeacherGradeOfferings: (
    ...args: unknown[]
  ) => useTeacherGradeOfferings(...args),
  useAssessments: (...args: unknown[]) =>
    useAssessments(...args),
  useGradeEntry: (...args: unknown[]) =>
    useGradeEntry(...args),
  useCreateAssessment: () => useCreateAssessment(),
  useSaveGrades: () => useSaveGrades(),
}));

const offering = {
  id: 'offering-1',
  institutionId: 'institution-1',
  classId: 'class-1',
  subjectId: 'subject-1',
  teacherProfileId: 'teacher-1',
  termId: 'term-1',
  academicYearId: 'year-1',
  className: '1A',
  gradeLevel: '1º ano',
  shift: 'Manhã',
  subjectName: 'Matemática',
  subjectCode: 'MAT',
  workload: 80,
  teacherName: 'Professora Ana',
  teacherEmail: 'ana@escola.com',
  termName: '1º bimestre',
};

const assessment = {
  id: 'assessment-1',
  institutionId: 'institution-1',
  subjectOfferingId: 'offering-1',
  termId: 'term-1',
  title: 'Prova 1',
  description: null,
  assessmentType: 'EXAM',
  assessmentDate: '2026-03-02',
  maxScore: 10,
  weight: 1,
  status: 'PUBLISHED',
  createdBy: 'teacher-1',
  publishedAt: null,
  createdAt: '2026-03-02T10:00:00.000Z',
  updatedAt: '2026-03-02T10:00:00.000Z',
  offering,
};

const gradeEntry = {
  assessment,
  records: [
    {
      gradeId: null,
      student: {
        id: 'student-1',
        profileId: 'profile-1',
        fullName: 'Ana Silva',
        email: 'ana@escola.com',
        registrationNumber: 'RA-001',
        enrollmentId: 'enrollment-1',
      },
      score: null,
      status: 'PENDING',
      feedback: null,
      recordedAt: null,
    },
    {
      gradeId: 'grade-2',
      student: {
        id: 'student-2',
        profileId: 'profile-2',
        fullName: 'Bruno Lima',
        email: 'bruno@escola.com',
        registrationNumber: 'RA-002',
        enrollmentId: 'enrollment-2',
      },
      score: 7,
      status: 'GRADED',
      feedback: null,
      recordedAt: '2026-03-02T10:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  createAssessment.mockReset();
  saveGrades.mockReset();
  createAssessment.mockResolvedValue(assessment);
  saveGrades.mockResolvedValue(gradeEntry);

  useTeacherGradeOfferings.mockReturnValue({
    data: [offering],
    isLoading: false,
    isError: false,
    error: null,
  });
  useAssessments.mockReturnValue({
    data: [assessment],
    isLoading: false,
    isError: false,
    error: null,
  });
  useGradeEntry.mockReturnValue({
    data: gradeEntry,
    dataUpdatedAt: 1,
    isLoading: false,
    isError: false,
    error: null,
  });
  useCreateAssessment.mockReturnValue({
    mutateAsync: createAssessment,
    isPending: false,
    isError: false,
    error: null,
  });
  useSaveGrades.mockReturnValue({
    mutateAsync: saveGrades,
    isPending: false,
    isError: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

describe('TeacherAssessmentsPanel', () => {
  it('mostra estado vazio para professor sem atribuição', () => {
    useTeacherGradeOfferings.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TeacherAssessmentsPanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    expect(
      screen.getByText(
        /Nenhuma turma ou disciplina ativa/,
      ),
    ).toBeTruthy();
  });

  it('cria avaliação válida', async () => {
    render(
      <TeacherAssessmentsPanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/Título/),
      {
        target: {
          value: 'Trabalho de leitura',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar avaliação/,
      }),
    );

    await waitFor(() => {
      expect(createAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: 'institution-1',
          subjectOfferingId: 'offering-1',
          termId: 'term-1',
          title: 'Trabalho de leitura',
          maxScore: 10,
          weight: 1,
          profileId: 'teacher-1',
        }),
      );
    });
  });

  it('aceita zero como nota lançada e mantém vazio pendente', async () => {
    render(
      <TeacherAssessmentsPanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/Nota de Ana Silva/),
      {
        target: {
          value: '0',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar notas/,
      }),
    );

    await waitFor(() => {
      expect(saveGrades).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentId: 'assessment-1',
          grades: [
            {
              studentId: 'student-1',
              score: 0,
              status: 'GRADED',
              feedback: '',
            },
            {
              studentId: 'student-2',
              score: 7,
              status: 'GRADED',
              feedback: '',
            },
          ],
        }),
      );
    });
  });

  it('bloqueia submit com nota acima do máximo', () => {
    render(
      <TeacherAssessmentsPanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/Nota de Ana Silva/),
      {
        target: {
          value: '11',
        },
      },
    );

    expect(
      screen
        .getByRole('button', {
          name: /Salvar notas/,
        })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('bloqueia submit duplicado durante salvamento', () => {
    useSaveGrades.mockReturnValue({
      mutateAsync: saveGrades,
      isPending: true,
      isError: false,
      error: null,
    });

    render(
      <TeacherAssessmentsPanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    expect(
      screen
        .getByRole('button', {
          name: /Salvando/,
        })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
