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
import {
  getDateForAttendancePeriod,
  getTodayDateInputValue,
} from './attendanceDisplay';

const mutateAsync = vi.fn();
const useTeacherAttendanceOfferings = vi.fn();
const useAttendanceRollCall = vi.fn();
const useSaveAttendanceRollCall = vi.fn();
const useSubjectOfferingWorkloadProgress = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
}));

vi.mock('../../hooks/useAttendance', () => ({
  useTeacherAttendanceOfferings: (
    ...args: unknown[]
  ) => useTeacherAttendanceOfferings(...args),
  useAttendanceRollCall: (...args: unknown[]) =>
    useAttendanceRollCall(...args),
  useSaveAttendanceRollCall: () =>
    useSaveAttendanceRollCall(),
}));

vi.mock('../../hooks/useWorkload', () => ({
  useSubjectOfferingWorkloadProgress: (
    ...args: unknown[]
  ) => useSubjectOfferingWorkloadProgress(...args),
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
  scheduleSlot: {
    dayOfWeek: 1,
    startTime: '07:00:00',
    endTime: '07:50:00',
  },
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

  useSubjectOfferingWorkloadProgress.mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
        'Período "1º bimestre" permitido: 09/02/2026 a 09/05/2026.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Aula prevista: 07:00 a 07:50'),
    ).toBeTruthy();
    expect(
      screen.getByText('Ana Silva'),
    ).toBeTruthy();
    expect(
      screen.getByText('Bruno Lima'),
    ).toBeTruthy();
  });

  it('prioriza a atribuição com aula no dia e exibe o período no rótulo', async () => {
    const secondOffering = {
      ...offering,
      id: 'offering-2',
      termId: 'term-3',
      termName: '3º bimestre',
      termStartDate: null,
      termEndDate: null,
      scheduleSlots: [
        {
          dayOfWeek: 3,
          startTime: '10:50:00',
          endTime: '11:40:00',
        },
      ],
    };
    useTeacherAttendanceOfferings.mockReturnValue({
      data: [{ ...offering, termStartDate: null, termEndDate: null }, secondOffering],
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

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Atribuição') as HTMLSelectElement).value,
      ).toBe('offering-2');
    });
    expect(screen.getByRole('option', {
      name: 'Matemática · Turma 1A · 3º bimestre',
    })).toBeTruthy();
  });

  it('prepara uma data válida quando a atribuição não cobre hoje', async () => {
    render(
      <TeacherAttendancePanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    const expectedDate = getDateForAttendancePeriod(
      getTodayDateInputValue(),
      offering.termStartDate,
      offering.termEndDate,
    );

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Data') as HTMLInputElement).value,
      ).toBe(expectedDate);
    });

    if (expectedDate !== getTodayDateInputValue()) {
      expect(
        screen.getByRole('status').textContent,
      ).toMatch(/A data de hoje está fora do período/);
    }
  });

  it('não exibe aviso quando a data civil de hoje está no período atual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 21, 30));

    const currentOffering = {
      ...offering,
      termName: '3º bimestre',
      termStartDate: '2026-06-26',
      termEndDate: '2026-09-17',
    };
    useTeacherAttendanceOfferings.mockReturnValue({
      data: [currentOffering],
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
      (screen.getByLabelText('Data') as HTMLInputElement).value,
    ).toBe('2026-09-09');
    expect(screen.queryByRole('status')).toBeNull();
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

  it('mostra aula suspensa e desabilita edição quando não há sessão histórica', () => {
    useAttendanceRollCall.mockReturnValue({
      data: {
        ...rollCall,
        session: null,
        records: [],
        calendarStatus: {
          date: '2026-02-02',
          state: 'BLOCKED',
          blocked: true,
          blockers: [
            { event_id: 'event-1', event_type: 'HOLIDAY' },
          ],
        },
        attendanceAllowed: false,
      },
      dataUpdatedAt: 2,
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

    expect(screen.getByText('Aula suspensa')).toBeTruthy();
    expect(screen.getByText('Feriado')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: /Marcar presentes/ })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByText(/Nenhuma chamada editável/),
    ).toBeTruthy();
  });

  it('exibe e troca o horário da chamada quando há dois slots no dia', async () => {
    const multiSlotOffering = {
      ...offering,
      scheduleSlots: [
        {
          dayOfWeek: 1,
          startTime: '07:00:00',
          endTime: '07:50:00',
        },
        {
          dayOfWeek: 1,
          startTime: '08:00:00',
          endTime: '08:50:00',
        },
      ],
    };
    const secondSlotRollCall = {
      ...rollCall,
      scheduleSlot: {
        dayOfWeek: 1,
        startTime: '08:00:00',
        endTime: '08:50:00',
      },
      records: [rollCall.records[1]],
    };

    useTeacherAttendanceOfferings.mockReturnValue({
      data: [multiSlotOffering],
      isLoading: false,
      isError: false,
      error: null,
    });
    useAttendanceRollCall.mockImplementation(
      (...args: unknown[]) => {
        const slot = args[3] as
          | { startTime: string; endTime: string }
          | undefined;

        return {
          data:
            slot?.startTime === '08:00:00'
              ? secondSlotRollCall
              : slot?.startTime === '07:00:00'
                ? rollCall
                : undefined,
          dataUpdatedAt: slot?.startTime === '08:00:00' ? 2 : 1,
          isLoading: false,
          isError: false,
          error: null,
        };
      },
    );

    render(
      <TeacherAttendancePanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    const slotSelect = await screen.findByLabelText(
      'Horário da aula',
    );
    expect(
      screen.getByRole('option', {
        name: '07:00 a 07:50',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('option', {
        name: '08:00 a 08:50',
      }),
    ).toBeTruthy();

    fireEvent.change(slotSelect, {
      target: { value: '08:00:00|08:50:00' },
    });

    await waitFor(() => {
      expect(screen.getByText('Bruno Lima')).toBeTruthy();
      expect(
        useAttendanceRollCall,
      ).toHaveBeenCalledWith(
        'institution-1',
        'offering-1',
        expect.any(String),
        {
          startTime: '08:00:00',
          endTime: '08:50:00',
        },
        true,
      );
    });
    expect(screen.queryByText('Ana Silva')).toBeNull();

    fireEvent.change(
      screen.getByLabelText(/Status de Bruno Lima/),
      { target: { value: 'PRESENT' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Salvar chamada/ }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleSlot: {
            startTime: '08:00:00',
            endTime: '08:50:00',
          },
        }),
      );
    });
  });

  it('navega por slots históricos sem timetable e mantém a chamada somente leitura', async () => {
    const historicalOffering = {
      ...offering,
      scheduleSlots: [],
      selectableSlots: [
        {
          dayOfWeek: 1,
          startTime: '07:00:00',
          endTime: '07:50:00',
          source: 'HISTORICAL' as const,
        },
        {
          dayOfWeek: 1,
          startTime: '08:00:00',
          endTime: '08:50:00',
          source: 'HISTORICAL' as const,
        },
      ],
    };
    const historical08RollCall = {
      ...rollCall,
      scheduleSlot: {
        dayOfWeek: 1,
        startTime: '08:00:00',
        endTime: '08:50:00',
      },
      session: {
        ...rollCall.session,
        id: 'session-08',
        startsAt: '08:00:00',
        endsAt: '08:50:00',
      },
      records: [rollCall.records[1]],
    };

    useTeacherAttendanceOfferings.mockReturnValue({
      data: [historicalOffering],
      isLoading: false,
      isError: false,
      error: null,
    });
    useAttendanceRollCall.mockImplementation(
      (...args: unknown[]) => ({
        data:
          (args[3] as { startTime?: string } | undefined)
            ?.startTime === '08:00:00'
            ? historical08RollCall
            : undefined,
        dataUpdatedAt:
          (args[3] as { startTime?: string } | undefined)
            ?.startTime === '08:00:00'
            ? 2
            : 1,
        isLoading: false,
        isError: false,
        error: null,
      }),
    );

    render(
      <TeacherAttendancePanel
        profileId="teacher-1"
        institutionId="institution-1"
      />,
    );

    const slotSelect = await screen.findByLabelText(
      'Horário da aula',
    );
    expect(
      screen.getByRole('option', {
        name: '07:00 a 07:50 · Histórico',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('option', {
        name: '08:00 a 08:50 · Histórico',
      }),
    ).toBeTruthy();

    fireEvent.change(slotSelect, {
      target: { value: '08:00:00|08:50:00' },
    });

    await waitFor(() => {
      expect(screen.getByText('Bruno Lima')).toBeTruthy();
    });
    expect(
      screen.getByText(
        'Esta chamada pertence a um horário histórico que não está mais na grade publicada.',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByLabelText(/Status de Bruno Lima/)
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByLabelText(/Observação de Bruno Lima/)
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: /Marcar presentes/ })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: /Salvar chamada/ })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('torna sessão histórica somente leitura quando o calendário bloqueia a data', () => {
    useAttendanceRollCall.mockReturnValue({
      data: {
        ...rollCall,
        calendarStatus: {
          date: '2026-02-02',
          state: 'BLOCKED',
          blocked: true,
          blockers: [
            { event_id: 'event-1', event_type: 'HOLIDAY' },
          ],
        },
        attendanceAllowed: false,
      },
      dataUpdatedAt: 3,
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

    expect(screen.getByText('Ana Silva')).toBeTruthy();
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.getByText(/já existe uma chamada registrada/)).toBeTruthy();
    expect(
      screen
        .getByLabelText(/Status de Ana Silva/)
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByLabelText(/Observação de Ana Silva/)
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: /Marcar presentes/ })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: /Salvar chamada/ })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('exibe o progresso da carga horária da atribuição', () => {
    useSubjectOfferingWorkloadProgress.mockReturnValue({
      data: {
        subjectOfferingId: 'offering-1',
        termStartDate: '2026-02-01',
        termEndDate: '2026-04-30',
        referenceDate: '2026-03-01',
        plannedOccurrences: 10,
        plannedOccurrencesToDate: 5,
        suspendedOccurrences: 1,
        deliveredSessions: 7,
        plannedMinutes: 450,
        plannedMinutesToDate: 250,
        deliveredMinutes: 350,
        completionPercent: 77.78,
        deliveryVsPlanToDatePercent: 140,
      },
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

    expect(screen.getByText('Carga prevista no período')).toBeTruthy();
    expect(screen.getByText('7h 30min')).toBeTruthy();
    expect(screen.getByText('77.78%')).toBeTruthy();
    expect(screen.getByText('140%')).toBeTruthy();
  });
});
