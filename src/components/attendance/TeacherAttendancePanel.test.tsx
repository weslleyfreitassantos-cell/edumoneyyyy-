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

import TeacherAttendancePanel from './TeacherAttendancePanel';

const mutateAsync = vi.fn();
const useTeacherAttendanceOfferings = vi.fn();
const useAttendanceRollCall = vi.fn();
const useSaveAttendanceRollCall = vi.fn();

vi.mock('../../hooks/useAttendance', () => ({
  useTeacherAttendanceOfferings: (
    ...args: unknown[]
  ) => useTeacherAttendanceOfferings(...args),
  useAttendanceRollCall: (...args: unknown[]) =>
    useAttendanceRollCall(...args),
  useSaveAttendanceRollCall: () =>
    useSaveAttendanceRollCall(),
}));

const offering = {
  id: 'offering-1',
  institutionId: 'institution-1',
  classId: 'class-1',
  subjectId: 'subject-1',
  teacherProfileId: 'teacher-1',
  termId: 'term-1',
  className: '1A',
  gradeLevel: '1º ano',
  shift: 'Manhã',
  subjectName: 'Matemática',
  subjectCode: 'MAT',
  workload: 80,
  teacherName: 'Professora Ana',
  teacherEmail: 'ana@escola.com',
  termName: '1º bimestre',
  termStartDate: '2026-02-09',
  termEndDate: '2026-05-09',
};

const rollCall = {
  offering,
  session: {
    id: 'session-1',
    institutionId: 'institution-1',
    subjectOfferingId: 'offering-1',
    sessionDate: '2026-02-02',
    startsAt: null,
    endsAt: null,
    topic: null,
    notes: null,
    status: 'CLOSED',
    createdBy: 'teacher-1',
    closedAt: '2026-02-02T10:00:00.000Z',
    createdAt: '2026-02-02T10:00:00.000Z',
    updatedAt: '2026-02-02T10:00:00.000Z',
  },
  records: [
    {
      recordId: 'record-1',
      student: {
        id: 'student-1',
        profileId: 'profile-1',
        fullName: 'Ana Silva',
        email: 'ana@escola.com',
        registrationNumber: 'RA-001',
        enrollmentId: 'enrollment-1',
      },
      status: 'ABSENT',
      notes: null,
      recordedAt: '2026-02-02T10:00:00.000Z',
    },
    {
      recordId: 'record-2',
      student: {
        id: 'student-2',
        profileId: 'profile-2',
        fullName: 'Bruno Lima',
        email: 'bruno@escola.com',
        registrationNumber: 'RA-002',
        enrollmentId: 'enrollment-2',
      },
      status: 'LATE',
      notes: null,
      recordedAt: '2026-02-02T10:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(rollCall);

  useTeacherAttendanceOfferings.mockReturnValue({
    data: [offering],
    isLoading: false,
    isError: false,
    error: null,
  });

  useAttendanceRollCall.mockReturnValue({
    data: rollCall,
    dataUpdatedAt: 1,
    isLoading: false,
    isError: false,
    error: null,
  });

  useSaveAttendanceRollCall.mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

describe('TeacherAttendancePanel', () => {
  it('mostra estado vazio para professor sem atribuição', () => {
    useTeacherAttendanceOfferings.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TeacherAttendancePanel
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

  it('carrega chamada existente para correção', () => {
    render(
      <TeacherAttendancePanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    expect(
      screen.getByText(
        /Sessão carregada para correção/,
      ),
    ).toBeTruthy();
    const dateInput = screen.getByLabelText('Data');
    expect(dateInput.getAttribute('lang')).toBe('pt-BR');
    expect(dateInput.getAttribute('min')).toBe('2026-02-09');
    expect(dateInput.getAttribute('max')).toBe('2026-05-09');
    expect(
      screen.getByText(
        'Período permitido: 09/02/2026 a 09/05/2026.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Ana Silva'),
    ).toBeTruthy();
    expect(
      screen.getByText('Bruno Lima'),
    ).toBeTruthy();
  });

  it('marca todos presentes e permite sobrescrever aluno individual', async () => {
    render(
      <TeacherAttendancePanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    fireEvent.change(screen.getByLabelText('Data'), {
      target: { value: '2026-03-02' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Marcar presentes/,
      }),
    );

    fireEvent.change(
      screen.getByLabelText(/Status de Bruno Lima/),
      {
        target: {
          value: 'ABSENT',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar chamada/,
      }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: 'institution-1',
          subjectOfferingId: 'offering-1',
          profileId: 'teacher-1',
          records: [
            {
              studentId: 'student-1',
              status: 'PRESENT',
              notes: '',
            },
            {
              studentId: 'student-2',
              status: 'ABSENT',
              notes: '',
            },
          ],
        }),
      );
    });
  });

  it('bloqueia submit enquanto salva', () => {
    useSaveAttendanceRollCall.mockReturnValue({
      mutateAsync,
      isPending: true,
      isError: false,
      error: null,
    });

    render(
      <TeacherAttendancePanel
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
