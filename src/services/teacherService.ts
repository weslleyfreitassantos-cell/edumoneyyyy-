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

export interface TeacherSubjectSummary {
  id: string;
  name: string;
  primary: boolean;
}

export interface TeacherRow {
  id: string;
  profile_id: string;
  institution_id: string;
  active: boolean;
  joined_at?: string;
  profiles: TeacherProfileSummary | null;
  subjects: TeacherSubjectSummary[];
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

    const { data: links, error: linksError } = await supabase
      .from('teacher_subjects')
      .select('teacher_profile_id, subject_id, primary_subject')
      .eq('institution_id', institutionId)
      .eq('active', true);

    if (linksError) {
      throw linksError;
    }

    const subjectIds = [
      ...new Set(
        (links ?? []).map((link) => String(link.subject_id)),
      ),
    ];

    const subjectsById = new Map<string, { id: string; name: string }>();

    if (subjectIds.length > 0) {
      const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('institution_id', institutionId)
        .in('id', subjectIds);

      if (subjectsError) {
        throw subjectsError;
      }

      for (const subject of subjects ?? []) {
        subjectsById.set(String(subject.id), {
          id: String(subject.id),
          name: String(subject.name),
        });
      }
    }

    const subjectsByTeacher = new Map<string, TeacherSubjectSummary[]>();

    for (const link of links ?? []) {
      const subject = subjectsById.get(String(link.subject_id));
      if (!subject) continue;

      const teacherSubjects = subjectsByTeacher.get(String(link.teacher_profile_id)) ?? [];
      teacherSubjects.push({
        id: subject.id,
        name: subject.name,
        primary: link.primary_subject === true,
      });
      subjectsByTeacher.set(String(link.teacher_profile_id), teacherSubjects);
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
      subjects: (subjectsByTeacher.get(row.profile_id) ?? []).sort((left, right) => {
        if (left.primary !== right.primary) return left.primary ? -1 : 1;
        return left.name.localeCompare(right.name, 'pt-BR');
      }),
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
