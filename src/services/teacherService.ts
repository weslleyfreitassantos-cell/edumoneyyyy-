import { supabase } from '../lib/supabaseClient';

import {
  teacherSchema,
  type TeacherFormData,
} from '../schemas/adminSchemas';
import { schoolUserInviteService } from './schoolUserInviteService';

export interface TeacherProfileSummary {
  full_name: string;
  email: string;
  avatar_url: string | null;
  active: boolean | null;
}

export interface TeacherRow {
  id: string;
  profile_id: string;
  institution_id: string;
  active: boolean;
  joined_at?: string;
  profiles: TeacherProfileSummary | null;
}

interface TeacherQueryRow {
  id: string;
  profile_id: string;
  institution_id: string;
  active: boolean | null;
  joined_at: string | null;
  profiles:
    | TeacherProfileSummary
    | TeacherProfileSummary[]
    | null;
}

export interface CreatedTeacher {
  id: string;
  profile_id: string;
  full_name: string;
  email: string;
}

function normalizeTeacherProfile(
  relation: TeacherQueryRow['profiles'],
): TeacherProfileSummary | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

export const teacherService = {
  async list(
    institutionId: string,
  ): Promise<TeacherRow[]> {
    const { data, error } = await supabase
      .from('memberships')
      .select(`
        id,
        profile_id,
        institution_id,
        active,
        joined_at,
        profiles:profile_id (
          full_name,
          email,
          avatar_url,
          active
        )
      `)
      .eq(
        'institution_id',
        institutionId,
      )
      .eq('role', 'TEACHER')
      .order('joined_at', {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const rows =
      (data ??
        []) as unknown as TeacherQueryRow[];

    return rows.map((row) => ({
      id: row.id,
      profile_id: row.profile_id,
      institution_id:
        row.institution_id,
      active: row.active ?? false,
      joined_at:
        row.joined_at ?? undefined,
      profiles:
        normalizeTeacherProfile(
          row.profiles,
        ),
    }));
  },

  async create(
    input: TeacherFormData,
  ): Promise<CreatedTeacher> {
    const data =
      teacherSchema.parse(input);

    const response =
      await schoolUserInviteService.invite({
        institutionId: data.institution_id,
        role: 'TEACHER',
        fullName: data.full_name,
        email: data.email,
      });

    return {
      id: response.membershipId ?? response.profileId,
      profile_id: response.profileId,
      full_name: data.full_name,
      email: data.email,
    };
  },

  async setActive(
    membershipId: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('memberships')
      .update({ active })
      .eq('id', membershipId)
      .eq(
        'institution_id',
        institutionId,
      )
      .eq('role', 'TEACHER');

    if (error) {
      throw error;
    }
  },
};
