import {
  academicDocumentService,
  type AcademicDocumentStudent,
} from './academicDocumentService';
import {
  pedagogicalMonitoringService,
  type PedagogicalMonitoringData,
  type PedagogicalStudentSummary,
} from './pedagogicalMonitoringService';
import {
  reportCardService,
  type StudentReportCard,
} from './reportCardService';

export interface StudentAcademicRecordFilters {
  academicYearId?: string;
  termId?: string;
}

export interface StudentAcademicRecord {
  student: AcademicDocumentStudent;
  academicYears: PedagogicalMonitoringData['filters']['years'];
  selectedAcademicYearId: string | null;
  selectedTermId: string | null;
  reportCard: StudentReportCard;
  monitoring: PedagogicalStudentSummary | null;
}

export const studentAcademicRecordService = {
  async getStudentAcademicRecord(
    institutionId: string,
    studentId: string,
    filters: StudentAcademicRecordFilters = {},
  ): Promise<StudentAcademicRecord> {
    const [student, reportCard, monitoring] = await Promise.all([
      academicDocumentService.getStudent(institutionId, studentId),
      reportCardService.getStudentReportCard(institutionId, studentId),
      pedagogicalMonitoringService.getInstitutionMonitoring(institutionId, {
        academicYearId: filters.academicYearId,
        termId: filters.termId,
        studentId,
      }),
    ]);

    const monitoringStudent = monitoring.students.find(
      (item) => item.studentId === studentId,
    ) ?? null;

    return {
      student,
      academicYears: monitoring.filters.years,
      selectedAcademicYearId: monitoring.academicYear?.id ?? null,
      selectedTermId: monitoring.term?.id ?? null,
      reportCard,
      monitoring: monitoringStudent,
    };
  },
};
