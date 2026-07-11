import { supabase } from '../lib/supabaseClient';

import {
  guardianSchema,
  type GuardianFormData,
} from '../schemas/adminSchemas';
import { schoolUserInviteService } from './schoolUserInviteService';

interface GuardianProfileRelation {
  full_name: string;
  email: string;
  active: boolean | null;
}

interface StudentProfileRelation {
  full_name: string;
  email: string;
}

interface StudentRelation {
  id: string;
  institution_id: string;
  registration_number: string;
  active: boolean | null;
  profiles:
    | StudentProfileRelation
    | StudentProfileRelation[]
    | null;
}

interface GuardianshipQueryRow {
  id: string;
  guardian_profile_id: string;
  student_id: string;
  relationship: string;
  is_primary: boolean | null;
  active: boolean | null;
  profiles:
    | GuardianProfileRelation
    | GuardianProfileRelation[]
    | null;
  students:
    | StudentRelation
    | StudentRelation[]
    | null;
}

export interface GuardianStudentLink {
  id: string;
  student_id: string;
  student_name: string;
  registration_number: string;
  relationship: string;
  is_primary: boolean;
  active: boolean;
}

export interface GuardianRow {
  id: string;
  guardian_profile_id: string;
  full_name: string;
  email: string;
  profile_active: boolean;
  active_links_count: number;
  links: GuardianStudentLink[];
}

export interface CreatedGuardian {
  profile_id: string;
  full_name: string;
  email: string;
}

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function normalizeGuardianRows(
  rows: GuardianshipQueryRow[],
  institutionId: string,
): GuardianRow[] {
  const guardians = new Map<string, GuardianRow>();

  for (const row of rows) {
    const profile = normalizeRelation(
      row.profiles,
    );
    const student = normalizeRelation(
      row.students,
    );
    const studentProfile = normalizeRelation(
      student?.profiles ?? null,
    );

    if (
      !profile ||
      !student ||
      student.institution_id !== institutionId
    ) {
      continue;
    }

    const current =
      guardians.get(
        row.guardian_profile_id,
      ) ?? {
        id: row.guardian_profile_id,
        guardian_profile_id:
          row.guardian_profile_id,
        full_name: profile.full_name,
        email: profile.email,
        profile_active:
          profile.active !== false,
        active_links_count: 0,
        links: [],
      };

    const link: GuardianStudentLink = {
      id: row.id,
      student_id: row.student_id,
      student_name:
        studentProfile?.full_name ??
        student.registration_number,
      registration_number:
        student.registration_number,
      relationship: row.relationship,
      is_primary:
        row.is_primary ?? false,
      active: row.active ?? false,
    };

    current.links.push(link);

    if (link.active) {
      current.active_links_count += 1;
    }

    guardians.set(
      row.guardian_profile_id,
      current,
    );
  }

  return Array.from(guardians.values()).sort(
    (first, second) =>
      first.full_name.localeCompare(
        second.full_name,
        'pt-BR',
      ),
  );
}

export const guardianService = {
  async list(
    institutionId: string,
  ): Promise<GuardianRow[]> {
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
        profiles:guardian_profile_id (
          full_name,
          email,
          active
        ),
        students:student_id (
          id,
          institution_id,
          registration_number,
          active,
          profiles:profile_id (
            full_name,
            email
          )
        )
      `,
      )
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return normalizeGuardianRows(
      (data ?? []) as unknown as GuardianshipQueryRow[],
      institutionId,
    );
  },

  async create(
    input: GuardianFormData,
  ): Promise<CreatedGuardian> {
    const data = guardianSchema.parse(input);
    let profileId: string | null = null;

    for (const link of data.student_links) {
      const response =
        await schoolUserInviteService.invite({
          institutionId: data.institution_id,
          role: 'GUARDIAN',
          fullName: data.full_name,
          email: data.email,
          guardian: {
            studentId: link.student_id,
            relationship: link.relationship,
          },
        });

      profileId ??= response.profileId;
    }

    if (!profileId) {
      throw new Error(
        'Nenhum vinculo de responsavel foi criado.',
      );
    }

    return {
      profile_id: profileId,
      full_name: data.full_name,
      email: data.email,
    };
  },

  async setLinkActive(
    guardianshipId: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { data, error: lookupError } =
      await supabase
        .from('guardianships')
        .select(
          `
          id,
          students:student_id (
            institution_id
          )
        `,
        )
        .eq('id', guardianshipId)
        .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    const row = data as
      | {
          students:
            | { institution_id: string }
            | { institution_id: string }[]
            | null;
        }
      | null;

    const student = normalizeRelation(
      row?.students ?? null,
    );

    if (
      !student ||
      student.institution_id !== institutionId
    ) {
      throw new Error(
        'Vinculo nao encontrado nesta instituicao.',
      );
    }

    const { error } = await supabase
      .from('guardianships')
      .update({ active })
      .eq('id', guardianshipId);

    if (error) {
      throw error;
    }
  },
};
