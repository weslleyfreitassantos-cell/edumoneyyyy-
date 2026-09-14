import { describe, expect, it, vi } from 'vitest';

import { academicDocumentService } from './academicDocumentService';
import { attendanceService } from './attendanceService';
import { pedagogicalMonitoringService } from './pedagogicalMonitoringService';
import { reportCardService } from './reportCardService';
import { studentAcademicRecordService } from './studentAcademicRecordService';

vi.mock('./academicDocumentService', () => ({
  academicDocumentService: {
    getStudent: vi.fn(),
  },
}));
vi.mock('./attendanceService', () => ({
  attendanceService: {
    getStudentAttendanceSummary: vi.fn(),
  },
}));
vi.mock('./pedagogicalMonitoringService', () => ({
  pedagogicalMonitoringService: {
    getInstitutionMonitoring: vi.fn(),
  },
}));
vi.mock('./reportCardService', () => ({
  reportCardService: {
    getStudentReportCard: vi.fn(),
  },
}));

const documentStudent = {
  id: 'student-1',
  institutionId: 'institution-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: null,
  registrationNumber: '20260012',
  birthDate: '2010-05-10',
  cpf: null,
  active: true,
  details: {},
  address: null,
  guardians: [],
  enrollments: [],
  currentEnrollment: null,
};

const reportCard = {
  institutionId: 'institution-1',
  studentId: 'student-1',
  closedCount: 1,
  openCount: 0,
  subjects: [{
    key: 'offering-1:term-1',
    institutionId: 'institution-1',
    academicYearId: 'year-1',
    academicYearName: '2026',
    termId: 'term-1',
    termName: '1º Bimestre',
    subjectOfferingId: 'offering-1',
    subjectName: 'Matemática',
    subjectCode: null,
    className: '2º A',
    teacherName: 'Prof. Ana',
    teacherEmail: 'prof@example.com',
    gradePercentage: 52,
    recoveryPercentage: 74,
    finalGradePercentage: 74,
    originalResultStatus: 'FAILED_BY_GRADE',
    compositionRule: null,
    attendancePercentage: 90,
    resultStatus: 'APPROVED',
    finalizedAt: '2026-05-01T00:00:00Z',
    isClosed: true,
    assessments: [],
  }],
};

const attendance = {
  summary: {
    totalRecords: 2,
    presentRecords: 2,
    absentRecords: 0,
    lateRecords: 0,
    excusedRecords: 0,
    attendanceRate: 100,
  },
  records: [],
  recentRecords: [],
};

const monitoring = {
  academicYear: { id: 'year-1', name: '2026', institutionId: 'institution-1', startDate: '2026-01-01', endDate: '2026-12-31', active: true, terms: [{ id: 'term-1', academicYearId: 'year-1', name: '1º Bimestre', startDate: '2026-01-01', endDate: '2026-04-01', active: true }] },
  term: { id: 'term-1', academicYearId: 'year-1', name: '1º Bimestre', startDate: '2026-01-01', endDate: '2026-04-01', active: true },
  policy: null,
  filters: {
    years: [],
    terms: [],
    classes: [],
    subjects: [],
    teachers: [],
    students: [],
  },
  students: [{
    studentId: 'student-1',
    fullName: 'Ana Silva',
    registrationNumber: '20260012',
    classId: 'class-1',
    className: '2º A',
    averageGrade: 74,
    attendancePercentage: 90,
    pendingItems: 1,
    lowPerformanceSubjects: 1,
    lowAttendanceSubjects: 0,
    dataStatus: 'OFFICIAL',
    risk: { level: 'ATTENTION', reasons: ['1 disciplina abaixo da média.'] },
    subjects: [],
  }],
  classes: [],
  subjects: [],
  metrics: {
    monitoredStudents: 1,
    attentionStudents: 1,
    criticalStudents: 0,
    lowAttendanceStudents: 0,
    lowPerformanceStudents: 1,
    pendingStudents: 1,
    officialStudents: 1,
    partialStudents: 0,
    closedOfferings: 1,
    totalOfferings: 1,
  },
};

describe('studentAcademicRecordService', () => {
  it('agrega identidade, resultados, frequência e monitoramento sem recalcular o boletim', async () => {
    vi.mocked(academicDocumentService.getStudent).mockResolvedValue(documentStudent);
    vi.mocked(reportCardService.getStudentReportCard).mockResolvedValue(reportCard as never);
    vi.mocked(attendanceService.getStudentAttendanceSummary).mockResolvedValue(attendance);
    vi.mocked(pedagogicalMonitoringService.getInstitutionMonitoring).mockResolvedValue(monitoring as never);

    const result = await studentAcademicRecordService.getStudentAcademicRecord('institution-1', 'student-1');

    expect(result.student).toBe(documentStudent);
    expect(result.reportCard.subjects[0]?.recoveryPercentage).toBe(74);
    expect(result.monitoring?.risk.level).toBe('ATTENTION');
    expect(result.attendance.summary.attendanceRate).toBe(100);
  });

  it('repassa os filtros acadêmicos ao monitoramento existente', async () => {
    vi.mocked(academicDocumentService.getStudent).mockResolvedValue(documentStudent);
    vi.mocked(reportCardService.getStudentReportCard).mockResolvedValue(reportCard as never);
    vi.mocked(attendanceService.getStudentAttendanceSummary).mockResolvedValue(attendance);
    vi.mocked(pedagogicalMonitoringService.getInstitutionMonitoring).mockResolvedValue(monitoring as never);

    await studentAcademicRecordService.getStudentAcademicRecord('institution-1', 'student-1', {
      academicYearId: 'year-2',
      termId: 'term-2',
    });

    expect(pedagogicalMonitoringService.getInstitutionMonitoring).toHaveBeenCalledWith('institution-1', {
      academicYearId: 'year-2',
      termId: 'term-2',
      studentId: 'student-1',
    });
  });

  it('mantém o erro seguro para aluno inexistente ou fora da instituição', async () => {
    vi.mocked(academicDocumentService.getStudent).mockRejectedValue(new Error('Aluno não encontrado nesta instituição.'));
    vi.mocked(reportCardService.getStudentReportCard).mockResolvedValue(reportCard as never);
    vi.mocked(attendanceService.getStudentAttendanceSummary).mockResolvedValue(attendance);
    vi.mocked(pedagogicalMonitoringService.getInstitutionMonitoring).mockResolvedValue(monitoring as never);

    await expect(
      studentAcademicRecordService.getStudentAcademicRecord('institution-1', 'foreign-student'),
    ).rejects.toThrow('Aluno não encontrado nesta instituição.');
  });
});
