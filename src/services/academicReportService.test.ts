import { beforeEach, describe, expect, it, vi } from 'vitest';

import { academicPolicyService } from './academicPolicyService';
import { attendanceService } from './attendanceService';
import { enrollmentService } from './enrollmentService';
import { pedagogicalMonitoringService } from './pedagogicalMonitoringService';
import { reportCardService } from './reportCardService';
import { studentService } from './studentService';
import { termClosingService } from './termClosingService';
import { academicReportService } from './academicReportService';

vi.mock('./academicPolicyService', () => ({ academicPolicyService: { listAcademicYears: vi.fn() } }));
vi.mock('./attendanceService', () => ({
  attendanceService: { getInstitutionAttendanceSummary: vi.fn() },
  calculateAttendanceSummary: (records: Array<{ status: string }>) => {
    const presentRecords = records.filter((record) => record.status === 'PRESENT' || record.status === 'LATE').length;
    const absentRecords = records.filter((record) => record.status === 'ABSENT').length;
    const lateRecords = records.filter((record) => record.status === 'LATE').length;
    const excusedRecords = records.filter((record) => record.status === 'EXCUSED').length;
    const totalRecords = records.length;
    return {
      presentRecords,
      absentRecords,
      lateRecords,
      excusedRecords,
      totalRecords,
      attendanceRate: totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0,
    };
  },
}));
vi.mock('./enrollmentService', () => ({ enrollmentService: { list: vi.fn() } }));
vi.mock('./pedagogicalMonitoringService', () => ({ pedagogicalMonitoringService: { getInstitutionMonitoring: vi.fn() } }));
vi.mock('./reportCardService', () => ({ reportCardService: { getGuardianReportCards: vi.fn() } }));
vi.mock('./studentService', () => ({ studentService: { list: vi.fn() } }));
vi.mock('./termClosingService', () => ({ termClosingService: { listInstitutionOfferings: vi.fn() } }));

const institutionId = 'institution-1';
const academicYear = {
  id: 'year-1', institutionId, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true,
  terms: [{ id: 'term-1', academicYearId: 'year-1', name: '2º Bimestre', startDate: '2026-04-01', endDate: '2026-06-30', active: true }],
};
const student = { id: 'student-1', profile_id: 'profile-1', institution_id: institutionId, registration_number: '20260001', birth_date: '2010-01-01', cpf: null, active: true, profiles: { full_name: 'Maria Silva', email: 'maria@example.com', avatar_url: null } };
const enrollment = { id: 'enrollment-1', student_id: 'student-1', class_id: 'class-1', academic_year_id: 'year-1', status: 'ACTIVE' as const, status_label: 'Ativa', active: true, enrolled_at: '2026-01-10', student_name: 'Maria Silva', student_registration_number: '20260001', student_active: true, class_name: '2º A', class_grade_level: '2º ano', class_shift: 'Matutino', class_capacity: 30, class_active: true, academic_year_name: '2026', active_enrollments_in_class: 1, has_capacity_available: true };
const monitoringSubject = { subjectOfferingId: 'offering-1', subjectId: 'subject-1', subjectName: 'Matemática', classId: 'class-1', className: '2º A', teacherProfileId: 'teacher-1', teacherName: 'Prof. Ana', gradePercentage: 74, attendancePercentage: 90, pendingItems: 0, isClosed: true, dataStatus: 'OFFICIAL' as const };
const monitoring = { academicYear, term: academicYear.terms[0], policy: null, filters: { years: [academicYear], terms: academicYear.terms, classes: [], subjects: [], teachers: [], students: [] }, students: [{ studentId: 'student-1', fullName: 'Maria Silva', registrationNumber: '20260001', classId: 'class-1', className: '2º A', averageGrade: 74, attendancePercentage: 90, pendingItems: 0, lowPerformanceSubjects: 0, lowAttendanceSubjects: 0, dataStatus: 'OFFICIAL' as const, risk: { level: 'NORMAL' as const, reasons: [] }, subjects: [monitoringSubject] }], classes: [], subjects: [], metrics: {} };
const reportSubject = { key: 'offering-1:term-1', institutionId, academicYearId: 'year-1', academicYearName: '2026', termId: 'term-1', termName: '2º Bimestre', subjectOfferingId: 'offering-1', subjectName: 'Matemática', subjectCode: null, className: '2º A', teacherName: 'Prof. Ana', teacherEmail: 'prof@example.com', gradePercentage: 52, recoveryPercentage: 74, finalGradePercentage: 74, originalResultStatus: 'FAILED_BY_GRADE' as const, compositionRule: null, attendancePercentage: 90, resultStatus: 'APPROVED' as const, finalizedAt: '2026-07-01T00:00:00Z', isClosed: true, assessments: [] };

describe('academicReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(academicPolicyService.listAcademicYears).mockResolvedValue([academicYear] as never);
    vi.mocked(studentService.list).mockResolvedValue([student] as never);
    vi.mocked(enrollmentService.list).mockResolvedValue([enrollment] as never);
    vi.mocked(termClosingService.listInstitutionOfferings).mockResolvedValue([{ id: 'offering-1', institutionId, academicYearId: 'year-1', academicYearName: '2026', classId: 'class-1', className: '2º A', gradeLevel: '2º ano', shift: 'Matutino', subjectId: 'subject-1', subjectName: 'Matemática', subjectCode: null, workload: 50, teacherProfileId: 'teacher-1', teacherName: 'Prof. Ana', teacherEmail: 'prof@example.com', termId: 'term-1', termName: '2º Bimestre', termStartDate: '2026-04-01', termEndDate: '2026-06-30', active: true, closure: null }] as never);
  });

  it('preserva snapshot oficial de recuperação no relatório de resultados', async () => {
    vi.mocked(pedagogicalMonitoringService.getInstitutionMonitoring).mockResolvedValue(monitoring as never);
    vi.mocked(reportCardService.getGuardianReportCards).mockResolvedValue([{ institutionId, studentId: 'student-1', subjects: [reportSubject], closedCount: 1, openCount: 0 }] as never);

    const rows = await academicReportService.getAcademicResultsReport(institutionId, { academicYearId: 'year-1', termId: 'term-1', classId: 'class-1' });

    expect(rows[0]).toMatchObject({ gradePercentage: 52, recoveryPercentage: 74, finalGradePercentage: 74, attendancePercentage: 90, resultStatus: 'APPROVED', dataStatus: 'OFFICIAL' });
  });

  it('gera relatório de matrículas com filtro de status e busca por nome ou RA', async () => {
    const rows = await academicReportService.getEnrollmentReport(institutionId, {
      academicYearId: 'year-1',
      classId: 'class-1',
      status: 'ACTIVE',
      search: '20260001',
    });

    expect(rows).toEqual([expect.objectContaining({
      studentName: 'Maria Silva',
      registrationNumber: '20260001',
      studentStatus: 'Ativo',
      academicYearName: '2026',
      className: '2º A',
      enrollmentStatusLabel: 'Ativa',
    })]);
  });

  it('marca resultado ainda aberto como dado parcial sem inventar recuperação ou média final', async () => {
    vi.mocked(pedagogicalMonitoringService.getInstitutionMonitoring).mockResolvedValue({
      ...monitoring,
      students: [{
        ...monitoring.students[0],
        subjects: [{ ...monitoringSubject, isClosed: false, dataStatus: 'PARTIAL', gradePercentage: 61 }],
      }],
    } as never);
    vi.mocked(reportCardService.getGuardianReportCards).mockResolvedValue([]);

    const rows = await academicReportService.getAcademicResultsReport(institutionId, { academicYearId: 'year-1', termId: 'term-1', classId: 'class-1' });

    expect(rows[0]).toMatchObject({ gradePercentage: 61, recoveryPercentage: null, finalGradePercentage: null, dataStatus: 'PARTIAL', resultStatus: 'PENDING' });
  });

  it('agrega EXCUSED sem transformar justificadas em falta', async () => {
    vi.mocked(attendanceService.getInstitutionAttendanceSummary).mockResolvedValue({
      summary: { totalRecords: 0, presentRecords: 0, absentRecords: 0, lateRecords: 0, excusedRecords: 0, attendanceRate: 0 },
      sessions: [{ records: [{ studentId: 'student-1', status: 'PRESENT' }, { studentId: 'student-1', status: 'LATE' }, { studentId: 'student-1', status: 'ABSENT' }, { studentId: 'student-1', status: 'EXCUSED' }] }],
      filters: { classes: [], subjects: [], teachers: [], students: [], academicYears: [], terms: [] },
    } as never);

    const rows = await academicReportService.getAttendanceReport(institutionId, { academicYearId: 'year-1', termId: 'term-1', classId: 'class-1' });

    expect(rows[0]).toMatchObject({ presentRecords: 2, absentRecords: 1, lateRecords: 1, excusedRecords: 1, totalRecords: 4, attendanceRate: 50 });
  });
});
