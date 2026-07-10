import { supabase } from '../lib/supabaseClient';

import {
  studentDashboardService,
  type StudentDashboardData,
} from './studentDashboardService';

interface StudentInstitutionRelation {
  id: string;
  institution_id: string;
}

interface GuardianshipQueryRow {
  id: string;
  guardian_profile_id: string;
  student_id: string;
  relationship: string;
  is_primary: boolean | null;
  active: boolean | null;
  students:
    | StudentInstitutionRelation
    | StudentInstitutionRelation[]
    | null;
}

export interface GuardianStudentDashboard {
  guardianship_id: string;
  relationship: string;
  is_primary: boolean;
  student: StudentDashboardData;
}

export interface GuardianDashboardData {
  students: GuardianStudentDashboard[];
}

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

export const guardianDashboardService = {
  async getDashboard(
    guardianProfileId: string,
    institutionId: string,
  ): Promise<GuardianDashboardData> {
    const { data, error } = await supabase
      .from('guardianships')
      .select(
        `
        id,
        guardian_profile_id,
        student_id,
        relationship,
        is_primary,
        active,
        students:student_id (
          id,
          institution_id
        )
      `,
      )
      .eq(
        'guardian_profile_id',
        guardianProfileId,
      )
      .eq('active', true)
      .order('created_at', {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const rows =
      (data ?? []) as unknown as GuardianshipQueryRow[];

    const institutionRows = rows.filter(
      (row) => {
        const student = normalizeRelation(
          row.students,
        );

        return (
          student?.institution_id ===
          institutionId
        );
      },
    );

    const students = await Promise.all(
      institutionRows.map(async (row) => ({
        guardianship_id: row.id,
        relationship: row.relationship,
        is_primary:
          row.is_primary ?? false,
        student:
          await studentDashboardService
            .getDashboardByStudentId(
              row.student_id,
              institutionId,
            ),
      })),
    );

    return {
      students,
    };
  },
};
