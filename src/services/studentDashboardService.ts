import { supabase } from '../lib/supabaseClient';

export interface StudentDashboardRecord {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  birth_date: string | null;
  active: boolean;
  created_at?: string;
}

interface StudentDashboardQueryRow {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  birth_date: string | null;
  active: boolean | null;
  created_at: string | null;
}

export const studentDashboardService = {
  async getStudentRecord(
    profileId: string,
    institutionId: string,
  ): Promise<StudentDashboardRecord> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        profile_id,
        institution_id,
        registration_number,
        birth_date,
        active,
        created_at
      `)
      .eq('profile_id', profileId)
      .eq('institution_id', institutionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'O registro acadêmico deste aluno não foi encontrado.',
      );
    }

    const row =
      data as StudentDashboardQueryRow;

    return {
      id: row.id,
      profile_id: row.profile_id,
      institution_id: row.institution_id,
      registration_number:
        row.registration_number,
      birth_date: row.birth_date,
      active: Boolean(row.active),
      created_at:
        row.created_at ?? undefined,
    };
  },
};