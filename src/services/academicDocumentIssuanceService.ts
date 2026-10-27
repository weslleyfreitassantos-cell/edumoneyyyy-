import { supabase } from '../lib/supabaseClient';

export type AcademicDocumentIssuanceType =
  | 'ENROLLMENT_DECLARATION'
  | 'REGISTRATION_SHEET'
  | 'ATTENDANCE_DECLARATION'
  | 'REENROLLMENT_RECEIPT'
  | 'TRANSCRIPT_PREVIEW';

export interface AcademicDocumentIssuance {
  id: string;
  document_type: AcademicDocumentIssuanceType;
  enrollment_id: string | null;
  academic_year_id: string | null;
  issued_at: string;
}

export const academicDocumentIssuanceService = {
  async record(input: {
    institutionId: string;
    studentId: string;
    documentType: AcademicDocumentIssuanceType;
    enrollmentId?: string | null;
    academicYearId?: string | null;
  }): Promise<string> {
    const { data, error } = await supabase.rpc('record_academic_document_issuance', {
      p_institution_id: input.institutionId,
      p_student_id: input.studentId,
      p_document_type: input.documentType,
      p_enrollment_id: input.enrollmentId ?? null,
      p_academic_year_id: input.academicYearId ?? null,
    });

    if (error) throw error;
    if (typeof data !== 'string' || !data) {
      throw new Error('Não foi possível confirmar o registro de emissão.');
    }
    return data;
  },

  async listRecent(
    institutionId: string,
    studentId: string,
  ): Promise<AcademicDocumentIssuance[]> {
    const { data, error } = await supabase
      .from('academic_document_issuances')
      .select('id, document_type, enrollment_id, academic_year_id, issued_at')
      .eq('institution_id', institutionId)
      .eq('student_id', studentId)
      .order('issued_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return (data ?? []) as AcademicDocumentIssuance[];
  },
};
