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
  selectAttendanceOfferingForDate,
} from './attendanceService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

interface MockQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: Promise<unknown>['then'];
}

function createQuery(response: unknown): MockQuery {
  const query = {} as MockQuery;

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.then = (
    resolve,
    reject,
  ) => Promise.resolve(response).then(resolve, reject);

  return query;
}

describe('attendanceService', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
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
    vi.mocked(supabase.from)
      .mockReturnValueOnce(offeringsQuery as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(scheduleQuery as unknown as ReturnType<typeof supabase.from>);

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
      });
    expect(offerings.find((offering) => offering.id === 'offering-term-1'))
      .toMatchObject({ scheduleSlots: [] });
    expect(scheduleQuery.in).toHaveBeenCalledWith(
      'subject_offering_id',
      ['offering-term-1', 'offering-term-3'],
    );
    expect(
      selectAttendanceOfferingForDate(offerings, '2026-09-09')?.id,
    ).toBe('offering-term-3');
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
