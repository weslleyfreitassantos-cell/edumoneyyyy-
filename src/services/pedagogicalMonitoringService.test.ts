import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {},
}));

vi.mock('./academicPolicyService', () => ({
  academicPolicyService: {
    listAcademicYears: vi.fn(),
    getActivePolicy: vi.fn(),
  },
}));

vi.mock('./attendanceService', () => ({
  attendanceService: {
    getInstitutionAttendanceSummary: vi.fn(),
  },
  calculateAttendanceSummary: vi.fn(() => ({
    attendanceRate: 100,
  })),
}));

vi.mock('./enrollmentService', () => ({
  enrollmentService: {
    list: vi.fn(),
  },
}));

vi.mock('./reportCardService', () => ({
  reportCardService: {
    getGuardianReportCards: vi.fn(),
  },
}));

vi.mock('./studentService', () => ({
  studentService: {
    list: vi.fn(),
  },
}));

vi.mock('./termClosingService', () => ({
  termClosingService: {
    listInstitutionOfferings: vi.fn(),
  },
}));

import {
  classifyPedagogicalRisk,
  pedagogicalMonitoringService,
} from './pedagogicalMonitoringService';
import { academicPolicyService } from './academicPolicyService';
import { attendanceService } from './attendanceService';
import { enrollmentService } from './enrollmentService';
import { reportCardService } from './reportCardService';
import { studentService } from './studentService';
import { termClosingService } from './termClosingService';

const institutionId = 'institution-1';
const academicYearId = 'year-1';
const termId = 'term-1';

const academicYear = {
  id: academicYearId,
  institutionId,
  name: '2026',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  active: true,
  terms: [{
    id: termId,
    academicYearId,
    name: '1º Bimestre',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    active: true,
  }],
};

const policy = {
  id: 'policy-1',
  institutionId,
  academicYearId,
  minimumGradePercentage: 70,
  minimumAttendancePercentage: 75,
  decimalPlaces: 1,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  timetable: {
    schoolDays: [1, 2, 3, 4, 5],
    defaultLessonDurationMinutes: 50,
    maxLessonsPerDay: 8,
    maxTeacherLessonsPerDay: 8,
    maxTeacherLessonsPerWeek: 40,
    maxConsecutiveSubjectLessons: 2,
    maxSubjectLessonsPerDay: 2,
    requireTeacherAvailability: false,
    requireRoomForGeneration: false,
    allowSharedRooms: false,
  },
};

function makeStudent(id: string, name: string) {
  return {
    id,
    profile_id: `profile-${id}`,
    institution_id: institutionId,
    registration_number: id,
    birth_date: '2008-01-01',
    cpf: null,
    active: true,
    profiles: {
      full_name: name,
      email: `${id}@example.com`,
      avatar_url: null,
    },
  };
}

function makeEnrollment(studentId: string, classId: string, className: string) {
  return {
    id: `enrollment-${studentId}`,
    student_id: studentId,
    class_id: classId,
    academic_year_id: academicYearId,
    status: 'ACTIVE',
    status_label: 'Ativa',
    active: true,
    enrolled_at: '2026-01-01',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    student_name: studentId,
    student_registration_number: studentId,
    student_active: true,
    class_name: className,
    class_grade_level: null,
    class_shift: null,
    class_capacity: 30,
    class_active: true,
    academic_year_name: '2026',
    active_enrollments_in_class: 1,
    has_capacity_available: true,
  };
}

function makeOffering(
  id: string,
  classId: string,
  className: string,
  subjectId: string,
  subjectName: string,
  teacherProfileId: string,
) {
  return {
    id,
    institutionId,
    academicYearId,
    academicYearName: '2026',
    classId,
    className,
    gradeLevel: null,
    shift: null,
    subjectId,
    subjectName,
    subjectCode: null,
    workload: 50,
    teacherProfileId,
    teacherName: 'Professor',
    teacherEmail: 'professor@example.com',
    termId,
    termName: '1º Bimestre',
    termStartDate: '2026-01-01',
    termEndDate: '2026-03-31',
    active: true,
    closure: null,
  };
}

const studentOne = makeStudent('student-1', 'Ana Aluna');
const studentTwo = makeStudent('student-2', 'Bruno Aluno');
const enrollments = [
  makeEnrollment('student-1', 'class-a', 'Turma A'),
  makeEnrollment('student-2', 'class-b', 'Turma B'),
];
const offerings = [
  makeOffering('offering-a', 'class-a', 'Turma A', 'subject-math', 'Matemática', 'teacher-a'),
  makeOffering('offering-b', 'class-b', 'Turma B', 'subject-portuguese', 'Português', 'teacher-b'),
];

function configureMonitoringMocks() {
  vi.mocked(academicPolicyService.listAcademicYears).mockResolvedValue([academicYear]);
  vi.mocked(academicPolicyService.getActivePolicy).mockResolvedValue(policy as never);
  vi.mocked(studentService.list).mockResolvedValue([studentOne, studentTwo]);
  vi.mocked(enrollmentService.list).mockResolvedValue(enrollments as never);
  vi.mocked(termClosingService.listInstitutionOfferings).mockImplementation(
    async (_id, filters) => offerings.filter((offering) =>
      (!filters?.classId || offering.classId === filters.classId) &&
      (!filters?.subjectId || offering.subjectId === filters.subjectId) &&
      (!filters?.teacherProfileId || offering.teacherProfileId === filters.teacherProfileId),
    ) as never,
  );
  vi.mocked(reportCardService.getGuardianReportCards).mockImplementation(
    async (_id, studentIds) => studentIds.map((studentId) => ({
      institutionId,
      studentId,
      subjects: [],
      closedCount: 0,
      openCount: 0,
    })) as never,
  );
  vi.mocked(attendanceService.getInstitutionAttendanceSummary).mockResolvedValue({
    summary: {},
    sessions: [],
    filters: { classes: [], subjects: [], teachers: [], students: [] },
  } as never);
}

describe('pedagogicalMonitoringService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureMonitoringMocks();
  });

  it('classifica como normal quando não há sinais', () => {
    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 0,
        lowAttendanceSubjects: 0,
        pendingItems: 0,
        policyConfigured: true,
      }),
    ).toEqual({
      level: 'NORMAL',
      reasons: [],
    });
  });

  it('explica atenção por pendência e criticidade por sinais combinados', () => {
    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 0,
        lowAttendanceSubjects: 0,
        pendingItems: 1,
        policyConfigured: true,
      }),
    ).toMatchObject({
      level: 'ATTENTION',
      reasons: ['1 pendência(s) acadêmica(s).'],
    });

    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 1,
        lowAttendanceSubjects: 1,
        pendingItems: 0,
        policyConfigured: true,
      }),
    ).toMatchObject({
      level: 'CRITICAL',
      reasons: [
        '1 disciplina(s) abaixo da média.',
        '1 disciplina(s) com frequência baixa.',
      ],
    });
  });

  it('sinaliza política ausente sem inventar um limite acadêmico', () => {
    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 0,
        lowAttendanceSubjects: 0,
        pendingItems: 0,
        policyConfigured: false,
      }),
    ).toEqual({
      level: 'ATTENTION',
      reasons: ['Política acadêmica ainda não configurada.'],
    });
  });

  it('restringe o monitoramento de disciplina à turma com oferta correspondente', async () => {
    const data = await pedagogicalMonitoringService.getInstitutionMonitoring(
      institutionId,
      { subjectId: 'subject-math' },
    );

    expect(data.students.map((student) => student.studentId)).toEqual(['student-1']);
    expect(data.metrics.monitoredStudents).toBe(1);
    expect(data.filters.classes).toEqual([{ id: 'class-a', label: 'Turma A' }]);
  });

  it('restringe o monitoramento de professor à turma com oferta correspondente', async () => {
    const data = await pedagogicalMonitoringService.getInstitutionMonitoring(
      institutionId,
      { teacherProfileId: 'teacher-b' },
    );

    expect(data.students.map((student) => student.studentId)).toEqual(['student-2']);
    expect(data.metrics.monitoredStudents).toBe(1);
  });

  it('não inventa alunos ou pendências quando o filtro não possui ofertas', async () => {
    const data = await pedagogicalMonitoringService.getInstitutionMonitoring(
      institutionId,
      { subjectId: 'subject-missing' },
    );

    expect(data.students).toEqual([]);
    expect(data.metrics).toMatchObject({
      monitoredStudents: 0,
      attentionStudents: 0,
      criticalStudents: 0,
      pendingStudents: 0,
      totalOfferings: 0,
    });
  });

  it('preserva somente os alunos matriculados na turma selecionada', async () => {
    const data = await pedagogicalMonitoringService.getInstitutionMonitoring(
      institutionId,
      { classId: 'class-b' },
    );

    expect(data.students.map((student) => student.studentId)).toEqual(['student-2']);
  });

  it('filtra um aluno dentro do contexto institucional e acadêmico', async () => {
    const data = await pedagogicalMonitoringService.getInstitutionMonitoring(
      institutionId,
      { studentId: 'student-2' },
    );

    expect(data.students.map((student) => student.studentId)).toEqual(['student-2']);
    expect(data.filters.students).toEqual([
      { id: 'student-1', label: 'Ana Aluna · student-1' },
      { id: 'student-2', label: 'Bruno Aluno · student-2' },
    ]);
  });

  it('retorna vazio para aluno externo ou incompatível com a turma', async () => {
    const external = await pedagogicalMonitoringService.getInstitutionMonitoring(
      institutionId,
      { studentId: 'student-external' },
    );
    const incompatible = await pedagogicalMonitoringService.getInstitutionMonitoring(
      institutionId,
      { studentId: 'student-2', classId: 'class-a' },
    );

    expect(external.students).toEqual([]);
    expect(incompatible.students).toEqual([]);
  });
});
