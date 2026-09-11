import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  AttendanceServiceError,
  attendanceService,
  buildRollCallRecords,
  calculateAttendanceSummary,
  getAttendanceDayOfWeek,
  isEnrollmentValidForAttendanceDate,
  resolveAttendanceScheduleSlot,
  selectAttendanceOfferingForDate,
} from './attendanceService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

interface MockQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: Promise<unknown>['then'];
}

function createQuery(response: unknown): MockQuery {
  const query = {} as MockQuery;

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.neq = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.maybeSingle = vi.fn(() =>
    Promise.resolve(response),
  );
  query.then = (
    resolve,
    reject,
  ) => Promise.resolve(response).then(resolve, reject);

  return query;
}

const attendanceOfferingRow = {
  id: 'offering-1',
  class_id: 'class-1',
  subject_id: 'subject-1',
  teacher_profile_id: 'teacher-1',
  term_id: 'term-1',
  active: true,
  created_at: '2026-02-02T10:00:00.000Z',
  classes: {
    id: 'class-1',
    institution_id: 'institution-1',
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
    start_date: '2026-02-01',
    end_date: '2026-04-30',
    active: true,
  },
};

function createSession(
  startTime: string | null = '07:00:00',
  endTime: string | null = '07:50:00',
  id = 'session-1',
) {
  return {
    id,
    institution_id: 'institution-1',
    subject_offering_id: 'offering-1',
    session_date: '2026-02-02',
    starts_at: startTime,
    ends_at: endTime,
    topic: null,
    notes: null,
    status: 'CLOSED',
    created_by: 'teacher-1',
    closed_at: '2026-02-02T10:00:00.000Z',
    created_at: '2026-02-02T10:00:00.000Z',
    updated_at: '2026-02-02T10:00:00.000Z',
  };
}

function setupRollCallQueries({
  blockers = [],
  session = null,
  sessions,
  schedule = [
    {
      day_of_week: 1,
      start_time: '07:00:00',
      end_time: '07:50:00',
    },
  ],
  records = [],
  roster = [
    {
      student_id: 'student-1',
      profile_id: 'profile-1',
      full_name: 'Ana Silva',
      registration_number: 'RA-001',
      enrollment_id: 'enrollment-1',
    },
  ],
}: {
  blockers?: unknown[];
  session?: unknown;
  sessions?: unknown[];
  schedule?: unknown[];
  records?: unknown[];
  roster?: unknown[];
} = {}) {
  const offeringQuery = createQuery({
    data: attendanceOfferingRow,
    error: null,
  });
  const sessionsQuery = createQuery({
    data: sessions ?? (session ? [session] : []),
    error: null,
  });
  const scheduleQuery = createQuery({
    data: schedule,
    error: null,
  });
  const recordsQuery = createQuery({
    data: records,
    error: null,
  });

  vi.mocked(supabase.from)
    .mockReturnValueOnce(offeringQuery as never)
    .mockReturnValueOnce(scheduleQuery as never)
    .mockReturnValueOnce(sessionsQuery as never);

  if ((sessions ?? (session ? [session] : [])).length > 0) {
    vi.mocked(supabase.from).mockReturnValueOnce(
      recordsQuery as never,
    );
  }

  vi.mocked(supabase.rpc)
    .mockResolvedValueOnce({
      data: blockers,
      error: null,
    } as never);

  if (roster.length > 0) {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: roster,
      error: null,
    } as never);
  }

  return {
    offeringQuery,
    sessionsQuery,
    scheduleQuery,
    recordsQuery,
  };
}

describe('attendanceService', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
    vi.mocked(supabase.rpc).mockReset();
  });

  it('calcula percentual com atraso contando como presença', () => {
    const summary = calculateAttendanceSummary([
      { status: 'PRESENT' },
      { status: 'LATE' },
      { status: 'ABSENT' },
      { status: 'EXCUSED' },
    ]);

    expect(summary.totalRecords).toBe(4);
    expect(summary.presentRecords).toBe(2);
    expect(summary.lateRecords).toBe(1);
    expect(summary.absentRecords).toBe(1);
    expect(summary.excusedRecords).toBe(1);
    expect(summary.attendanceRate).toBe(50);
  });

  it('trata divisão por zero no resumo', () => {
    expect(
      calculateAttendanceSummary([]).attendanceRate,
    ).toBe(0);
  });

  it('converte a data para o padrão de dias da grade', () => {
    expect(getAttendanceDayOfWeek('2026-02-02')).toBe(1);
    expect(getAttendanceDayOfWeek('2026-02-07')).toBe(6);
    expect(getAttendanceDayOfWeek('2026-02-08')).toBe(7);
    expect(getAttendanceDayOfWeek('data-inválida')).toBe(0);
  });

  it('valida matrícula ativa na data da chamada', () => {
    expect(
      isEnrollmentValidForAttendanceDate(
        {
          active: true,
          status: 'ACTIVE',
          enrolled_at:
            '2026-02-01T12:00:00.000Z',
        },
        '2026-02-02',
      ),
    ).toBe(true);

    expect(
      isEnrollmentValidForAttendanceDate(
        {
          active: false,
          status: 'ACTIVE',
          enrolled_at:
            '2026-02-01T12:00:00.000Z',
        },
        '2026-02-02',
      ),
    ).toBe(false);

    expect(
      isEnrollmentValidForAttendanceDate(
        {
          active: true,
          status: 'TRANSFERRED',
          enrolled_at:
            '2026-02-01T12:00:00.000Z',
        },
        '2026-02-02',
      ),
    ).toBe(false);

    expect(
      isEnrollmentValidForAttendanceDate(
        {
          active: true,
          status: 'ACTIVE',
          enrolled_at:
            '2026-02-03T00:00:00.000Z',
        },
        '2026-02-02',
      ),
    ).toBe(false);
  });

  it('monta chamada com presença padrão e registros existentes', () => {
    const rollCall = buildRollCallRecords(
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
          id: 'record-2',
          institution_id: 'institution-1',
          attendance_session_id: 'session-1',
          student_id: 'student-2',
          status: 'ABSENT',
          notes: 'Atestado pendente',
          recorded_by: 'teacher-1',
          recorded_at:
            '2026-02-02T10:00:00.000Z',
          created_at:
            '2026-02-02T10:00:00.000Z',
          updated_at:
            '2026-02-02T10:00:00.000Z',
        },
      ],
    );

    expect(rollCall).toEqual([
      expect.objectContaining({
        student: expect.objectContaining({
          id: 'student-1',
        }),
        status: 'PRESENT',
      }),
      expect.objectContaining({
        recordId: 'record-2',
        student: expect.objectContaining({
          id: 'student-2',
        }),
        status: 'ABSENT',
        notes: 'Atestado pendente',
      }),
    ]);
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
            '2026-02-02T10:00:00.000Z',
          classes: {
            id: 'class-1',
            institution_id: 'institution-1',
            name: '1A',
            grade_level: '1º ano',
            shift: 'Manhã',
            capacity: 30,
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
        {
          id: 'offering-2',
          class_id: 'class-2',
          subject_id: 'subject-2',
          teacher_profile_id: 'teacher-1',
          term_id: 'term-1',
          active: true,
          created_at:
            '2026-02-02T10:00:00.000Z',
          classes: {
            id: 'class-2',
            institution_id: 'other-institution',
            name: '2A',
            grade_level: null,
            shift: null,
            capacity: 30,
            active: true,
          },
          subjects: {
            id: 'subject-2',
            institution_id: 'other-institution',
            name: 'História',
            code: null,
            workload: null,
            active: true,
          },
          profiles: {
            full_name: 'Professora Ana',
            email: 'ana@escola.com',
            active: true,
          },
          terms: null,
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue(
      query as unknown as ReturnType<typeof supabase.from>,
    );

    const offerings =
      await attendanceService.listTeacherOfferings(
        'teacher-1',
        'institution-1',
      );

    expect(offerings).toHaveLength(1);
    expect(offerings[0]).toMatchObject({
      id: 'offering-1',
      subjectName: 'Matemática',
      className: '1A',
    });
    expect(query.eq).toHaveBeenCalledWith(
      'teacher_profile_id',
      'teacher-1',
    );
    expect(query.eq).toHaveBeenCalledWith(
      'active',
      true,
    );
  });

  it('associa os horários do dia ao offering exato e prioriza a atribuição com aula', async () => {
    const offeringRows = [
      {
        id: 'offering-term-1',
        class_id: 'class-2',
        subject_id: 'subject-sociology',
        teacher_profile_id: 'teacher-1',
        term_id: 'term-1',
        active: true,
        created_at: '2026-02-02T10:00:00.000Z',
        classes: {
          id: 'class-2',
          institution_id: 'institution-1',
          name: '2',
          grade_level: '2º ano',
          shift: 'Manhã',
          active: true,
        },
        subjects: {
          id: 'subject-sociology',
          institution_id: 'institution-1',
          name: 'Sociologia',
          code: 'SOC',
          workload: 80,
          active: true,
        },
        profiles: {
          full_name: 'Isabela Monteiro',
          email: 'isabela@escola.com',
          active: true,
        },
        terms: {
          id: 'term-1',
          academic_year_id: 'year-1',
          name: '1º bimestre',
          start_date: '2026-01-01',
          end_date: '2026-04-01',
          active: true,
        },
      },
      {
        id: 'offering-term-3',
        class_id: 'class-2',
        subject_id: 'subject-sociology',
        teacher_profile_id: 'teacher-1',
        term_id: 'term-3',
        active: true,
        created_at: '2026-02-03T10:00:00.000Z',
        classes: {
          id: 'class-2',
          institution_id: 'institution-1',
          name: '2',
          grade_level: '2º ano',
          shift: 'Manhã',
          active: true,
        },
        subjects: {
          id: 'subject-sociology',
          institution_id: 'institution-1',
          name: 'Sociologia',
          code: 'SOC',
          workload: 80,
          active: true,
        },
        profiles: {
          full_name: 'Isabela Monteiro',
          email: 'isabela@escola.com',
          active: true,
        },
        terms: {
          id: 'term-3',
          academic_year_id: 'year-1',
          name: '3º bimestre',
          start_date: '2026-06-26',
          end_date: '2026-09-17',
          active: true,
        },
      },
    ];
    const offeringsQuery = createQuery({ data: offeringRows, error: null });
    const scheduleQuery = createQuery({
      data: [
        {
          subject_offering_id: 'offering-term-3',
          day_of_week: 3,
          start_time: '10:50:00',
          end_time: '11:40:00',
        },
      ],
      error: null,
    });
    const historicalQuery = createQuery({
      data: [
        {
          subject_offering_id: 'offering-term-3',
          starts_at: '10:50:00',
          ends_at: '11:40:00',
          status: 'CLOSED',
        },
        {
          subject_offering_id: 'offering-term-3',
          starts_at: '09:00:00',
          ends_at: '09:50:00',
          status: 'CLOSED',
        },
        {
          subject_offering_id: 'offering-term-3',
          starts_at: '11:50:00',
          ends_at: '12:40:00',
          status: 'CANCELED',
        },
        {
          subject_offering_id: 'offering-term-3',
          starts_at: null,
          ends_at: null,
          status: 'CLOSED',
        },
      ],
      error: null,
    });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(offeringsQuery as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(scheduleQuery as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(historicalQuery as unknown as ReturnType<typeof supabase.from>);

    const offerings = await attendanceService.listTeacherOfferings(
      'teacher-1',
      'institution-1',
      '2026-09-09',
    );

    expect(offerings).toHaveLength(2);
    expect(offerings.find((offering) => offering.id === 'offering-term-3'))
      .toMatchObject({
        termName: '3º bimestre',
        scheduleSlots: [{ dayOfWeek: 3, startTime: '10:50:00', endTime: '11:40:00' }],
        selectableSlots: [
          { source: 'HISTORICAL', startTime: '09:00:00', endTime: '09:50:00' },
          { source: 'TIMETABLE', startTime: '10:50:00', endTime: '11:40:00' },
        ],
      });
    expect(offerings.find((offering) => offering.id === 'offering-term-1'))
      .toMatchObject({ scheduleSlots: [], selectableSlots: [] });
    expect(scheduleQuery.in).toHaveBeenCalledWith(
      'subject_offering_id',
      ['offering-term-1', 'offering-term-3'],
    );
    expect(
      selectAttendanceOfferingForDate(offerings, '2026-09-09')?.id,
    ).toBe('offering-term-3');
  });

  it('descobre slots históricos quando a grade atual não possui horários', async () => {
    const offeringsQuery = createQuery({
      data: [attendanceOfferingRow],
      error: null,
    });
    const scheduleQuery = createQuery({
      data: [],
      error: null,
    });
    const historicalQuery = createQuery({
      data: [
        {
          subject_offering_id: 'offering-1',
          starts_at: '07:00:00',
          ends_at: '07:50:00',
          status: 'CLOSED',
        },
        {
          subject_offering_id: 'offering-1',
          starts_at: '08:00:00',
          ends_at: '08:50:00',
          status: 'CLOSED',
        },
      ],
      error: null,
    });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(offeringsQuery as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(scheduleQuery as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(historicalQuery as unknown as ReturnType<typeof supabase.from>);

    const offerings = await attendanceService.listTeacherOfferings(
      'teacher-1',
      'institution-1',
      '2026-02-02',
    );

    expect(offerings[0]).toMatchObject({
      scheduleSlots: [],
      selectableSlots: [
        {
          source: 'HISTORICAL',
          startTime: '07:00:00',
          endTime: '07:50:00',
        },
        {
          source: 'HISTORICAL',
          startTime: '08:00:00',
          endTime: '08:50:00',
        },
      ],
    });
  });

  it('não salva chamada vazia', async () => {
    await expect(
      attendanceService.saveRollCall({
        institutionId: 'institution-1',
        subjectOfferingId: 'offering-1',
        sessionDate: '2026-02-02',
        profileId: 'teacher-1',
        records: [],
      }),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_SAVE_FAILED',
    } satisfies Partial<AttendanceServiceError>);
  });
});

describe('attendanceService calendar integration', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
    vi.mocked(supabase.rpc).mockReset();
  });

  it('permite chamada quando a grade existe e o calendário está aberto', async () => {
    setupRollCallQueries();

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
    );

    expect(rollCall.attendanceAllowed).toBe(true);
    expect(rollCall.calendarStatus.state).toBe('OPEN');
    expect(rollCall.offering.id).toBe('offering-1');
    expect(supabase.rpc).toHaveBeenNthCalledWith(
      1,
      'get_academic_day_blockers',
      {
        p_institution_id: 'institution-1',
        p_date: '2026-02-02',
        p_academic_year_id: 'year-1',
        p_class_id: 'class-1',
        p_subject_id: 'subject-1',
      },
    );
  });

  it('exige o horário quando há mais de um slot na mesma data', async () => {
    setupRollCallQueries({
      schedule: [
        {
          day_of_week: 1,
          start_time: '07:00:00',
          end_time: '07:50:00',
        },
        {
          day_of_week: 1,
          start_time: '08:00:00',
          end_time: '08:50:00',
        },
      ],
    });

    await expect(
      attendanceService.loadRollCall(
        'institution-1',
        'offering-1',
        '2026-02-02',
      ),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_SLOT_REQUIRED',
    } satisfies Partial<AttendanceServiceError>);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('carrega exatamente o slot selecionado entre duas aulas do dia', async () => {
    const session = createSession(
      '08:00:00',
      '08:50:00',
    );
    const { sessionsQuery } = setupRollCallQueries({
      schedule: [
        {
          day_of_week: 1,
          start_time: '07:00:00',
          end_time: '07:50:00',
        },
        {
          day_of_week: 1,
          start_time: '08:00:00',
          end_time: '08:50:00',
        },
      ],
      session,
    });

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
      {
        startTime: '08:00:00',
        endTime: '08:50:00',
      },
    );

    expect(rollCall.scheduleSlot).toMatchObject({
      startTime: '08:00:00',
      endTime: '08:50:00',
    });
    expect(rollCall.session?.id).toBe('session-1');
    expect(sessionsQuery.eq).toHaveBeenCalledWith(
      'starts_at',
      '08:00:00',
    );
    expect(rollCall.offering.id).toBe('offering-1');
  });

  it('não confunde sessões de horários diferentes e protege duplicata do mesmo slot', async () => {
    const firstSession = createSession();
    const secondSession = createSession(
      '08:00:00',
      '08:50:00',
      'session-2',
    );
    const { sessionsQuery } = setupRollCallQueries({
      schedule: [
        {
          day_of_week: 1,
          start_time: '07:00:00',
          end_time: '07:50:00',
        },
        {
          day_of_week: 1,
          start_time: '08:00:00',
          end_time: '08:50:00',
        },
      ],
      session: secondSession,
    });

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
      {
        startTime: '08:00:00',
        endTime: '08:50:00',
      },
    );

    expect(rollCall.session?.id).toBe('session-2');
    expect(sessionsQuery.eq).toHaveBeenCalledWith(
      'starts_at',
      '08:00:00',
    );

    setupRollCallQueries({
      schedule: [
        {
          day_of_week: 1,
          start_time: '07:00:00',
          end_time: '07:50:00',
        },
      ],
      sessions: [firstSession, createSession(
        '07:00:00',
        '07:50:00',
        'session-duplicate',
      )],
    });

    await expect(
      attendanceService.loadRollCall(
        'institution-1',
        'offering-1',
        '2026-02-02',
      ),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_SESSION_CONFLICT',
    } satisfies Partial<AttendanceServiceError>);
  });

  it('rejeita slot inexistente sem consultar o calendário', async () => {
    setupRollCallQueries({
      schedule: [
        {
          day_of_week: 1,
          start_time: '07:00:00',
          end_time: '07:50:00',
        },
      ],
    });

    await expect(
      attendanceService.loadRollCall(
        'institution-1',
        'offering-1',
        '2026-02-02',
        {
          startTime: '09:00:00',
          endTime: '09:50:00',
        },
      ),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_SCHEDULE_NOT_FOUND',
    } satisfies Partial<AttendanceServiceError>);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('mantém histórico por slot mesmo quando a grade atual foi removida', async () => {
    const historicalSession = createSession(
      '08:00:00',
      '08:50:00',
    );
    setupRollCallQueries({
      schedule: [],
      session: historicalSession,
    });

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
      {
        startTime: '08:00:00',
        endTime: '08:50:00',
      },
    );

    expect(rollCall.session?.id).toBe('session-1');
    expect(rollCall.scheduleSlot).toMatchObject({
      startTime: '08:00:00',
      endTime: '08:50:00',
    });
  });

  it.each([
    ['07:00:00', '07:50:00', 'session-07'],
    ['08:00:00', '08:50:00', 'session-08'],
  ] as const)(
    'carrega sessão histórica %s sem timetable atual',
    async (startTime, endTime, sessionId) => {
      setupRollCallQueries({
        schedule: [],
        session: createSession(startTime, endTime, sessionId),
      });

      const rollCall = await attendanceService.loadRollCall(
        'institution-1',
        'offering-1',
        '2026-02-02',
        { startTime, endTime },
      );

      expect(rollCall.session?.id).toBe(sessionId);
      expect(rollCall.scheduleSlot).toMatchObject({
        startTime,
        endTime,
      });
    },
  );

  it('preserva o fallback de sessão histórica legacy sem horário quando inequívoca', async () => {
    setupRollCallQueries({
      schedule: [],
      session: createSession(null, null),
    });

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
    );

    expect(rollCall.session?.id).toBe('session-1');
    expect(rollCall.scheduleSlot).toBeNull();
  });

  it('lê sessão legacy sem horário quando existe um único slot atual', async () => {
    setupRollCallQueries({
      session: createSession(null, null),
    });

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
    );

    expect(rollCall.session?.id).toBe('session-1');
    expect(rollCall.scheduleSlot).toMatchObject({
      startTime: '07:00:00',
      endTime: '07:50:00',
    });
  });

  it('resolve slots sem usar posição do array como identidade', () => {
    const slots = [
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
    ];

    expect(
      resolveAttendanceScheduleSlot(slots, {
        startTime: '08:00:00',
        endTime: '08:50:00',
      }),
    ).toEqual(slots[1]);

    expect(() => resolveAttendanceScheduleSlot([])).toThrow(
      'Não existe aula publicada para esta atribuição na data selecionada.',
    );
  });

  it.each(['HOLIDAY', 'RECESS', 'CLASS_SUSPENSION'] as const)(
    'não prepara uma chamada nova em %s',
    async (eventType) => {
      setupRollCallQueries({
        blockers: [{ event_id: 'event-1', event_type: eventType }],
      });

      const rollCall = await attendanceService.loadRollCall(
        'institution-1',
        'offering-1',
        '2026-02-02',
      );

      expect(rollCall.calendarStatus.blockers[0]?.event_type).toBe(eventType);
      expect(rollCall.attendanceAllowed).toBe(false);
      expect(rollCall.session).toBeNull();
      expect(rollCall.records).toEqual([]);
    },
  );

  it('não bloqueia o dia inteiro por suspensão com horário', async () => {
    setupRollCallQueries();

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
    );

    expect(rollCall.calendarStatus.state).toBe('OPEN');
    expect(rollCall.attendanceAllowed).toBe(true);
  });

  it('preserva a sessão histórica quando o calendário passa a bloquear a data', async () => {
    const session = {
      id: 'session-1',
      institution_id: 'institution-1',
      subject_offering_id: 'offering-1',
      session_date: '2026-02-02',
      starts_at: '07:00:00',
      ends_at: '07:50:00',
      topic: null,
      notes: null,
      status: 'CLOSED',
      created_by: 'teacher-1',
      closed_at: '2026-02-02T10:00:00.000Z',
      created_at: '2026-02-02T10:00:00.000Z',
      updated_at: '2026-02-02T10:00:00.000Z',
    };
    setupRollCallQueries({
      blockers: [{ event_id: 'event-1', event_type: 'HOLIDAY' }],
      session,
    });

    const rollCall = await attendanceService.loadRollCall(
      'institution-1',
      'offering-1',
      '2026-02-02',
    );

    expect(rollCall.session?.id).toBe('session-1');
    expect(rollCall.records).toHaveLength(1);
    expect(rollCall.attendanceAllowed).toBe(false);
  });

  it('distingue a ausência da grade antes de consultar o calendário', async () => {
    setupRollCallQueries({ schedule: [] });

    await expect(
      attendanceService.loadRollCall(
        'institution-1',
        'offering-1',
        '2026-02-02',
      ),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_SCHEDULE_NOT_FOUND',
    } satisfies Partial<AttendanceServiceError>);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('falha antes de qualquer escrita quando o calendário bloqueia a aula', async () => {
    setupRollCallQueries({
      blockers: [{ event_id: 'event-1', event_type: 'CLASS_SUSPENSION' }],
    });

    await expect(
      attendanceService.saveRollCall({
        institutionId: 'institution-1',
        subjectOfferingId: 'offering-1',
        sessionDate: '2026-02-02',
        profileId: 'teacher-1',
        records: [
          {
            studentId: 'student-1',
            status: 'PRESENT',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_CALENDAR_BLOCKED',
    } satisfies Partial<AttendanceServiceError>);

    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
