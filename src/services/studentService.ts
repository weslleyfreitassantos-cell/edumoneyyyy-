import { supabase } from '../lib/supabaseClient';

import {
  studentSchema,
  studentUpdateSchema,
  type StudentFormData,
  type StudentUpdateData,
} from '../schemas/adminSchemas';

export interface StudentProfileSummary {
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export interface StudentRow {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  birth_date: string;
  cpf: string | null;
  active: boolean;
  created_at?: string;
  profiles: StudentProfileSummary | null;
}

interface StudentQueryRow {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  birth_date: string;
  cpf: string | null;
  active: boolean;
  created_at: string | null;
  profiles:
  | StudentProfileSummary
  | StudentProfileSummary[]
  | null;
}

export interface AvailableStudentProfile {
  id: string;
  full_name: string;
  email: string;
}

interface MembershipWithProfile {
  profile_id: string;
  profiles:
  | AvailableStudentProfile
  | AvailableStudentProfile[]
  | null;
}

function normalizeStudentProfile(
  relation: StudentQueryRow['profiles'],
): StudentProfileSummary | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function normalizeAvailableProfile(
  relation: MembershipWithProfile['profiles'],
): AvailableStudentProfile | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

async function ensureStudentMembership(
  profileId: string,
  institutionId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('memberships')
    .select('profile_id')
    .eq('profile_id', profileId)
    .eq('institution_id', institutionId)
    .eq('role', 'STUDENT')
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(
      'O perfil selecionado não possui vínculo de aluno com esta instituição.',
    );
  }
}

async function ensureUniqueStudent(
  institutionId: string,
  profileId: string,
  registrationNumber: string,
): Promise<void> {
  const [profileResult, registrationResult] =
    await Promise.all([
      supabase
        .from('students')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('profile_id', profileId)
        .limit(1),

      supabase
        .from('students')
        .select('id')
        .eq('institution_id', institutionId)
        .eq(
          'registration_number',
          registrationNumber,
        )
        .limit(1),
    ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (registrationResult.error) {
    throw registrationResult.error;
  }

  if (
    profileResult.data &&
    profileResult.data.length > 0
  ) {
    throw new Error(
      'Este perfil já está cadastrado como aluno nesta instituição.',
    );
  }

  if (
    registrationResult.data &&
    registrationResult.data.length > 0
  ) {
    throw new Error(
      'Já existe um aluno com este RA nesta instituição.',
    );
  }
}

async function ensureUniqueRegistrationForUpdate(
  id: string,
  institutionId: string,
  registrationNumber: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('institution_id', institutionId)
    .eq(
      'registration_number',
      registrationNumber,
    )
    .neq('id', id)
    .limit(1);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    throw new Error(
      'Já existe outro aluno com este RA nesta instituição.',
    );
  }
}

export const studentService = {
  async list(
    institutionId: string,
  ): Promise<StudentRow[]> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        profile_id,
        institution_id,
        registration_number,
        birth_date,
        cpf,
        active,
        created_at,
        profiles:profile_id (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('institution_id', institutionId)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const rows: StudentQueryRow[] =
      data ?? [];

    return rows.map((row) => ({
      id: row.id,
      profile_id: row.profile_id,
      institution_id: row.institution_id,
      registration_number:
        row.registration_number,
      birth_date: row.birth_date,
      cpf: row.cpf ?? null,
      active: row.active,
      created_at:
        row.created_at ?? undefined,
      profiles: normalizeStudentProfile(
        row.profiles,
      ),
    }));
  },

  async listAvailableProfiles(
    institutionId: string,
  ): Promise<AvailableStudentProfile[]> {
    const [
      membershipsResult,
      studentsResult,
    ] = await Promise.all([
      supabase
        .from('memberships')
        .select(`
          profile_id,
          profiles:profile_id (
            id,
            full_name,
            email
          )
        `)
        .eq('institution_id', institutionId)
        .eq('role', 'STUDENT'),

      supabase
        .from('students')
        .select('profile_id')
        .eq('institution_id', institutionId),
    ]);

    if (membershipsResult.error) {
      throw membershipsResult.error;
    }

    if (studentsResult.error) {
      throw studentsResult.error;
    }

    const registeredProfileIds = new Set(
      (studentsResult.data ?? []).map(
        (student) => student.profile_id,
      ),
    );

    const memberships:
      MembershipWithProfile[] =
      membershipsResult.data ?? [];

    const profiles = new Map<
      string,
      AvailableStudentProfile
    >();

    for (const membership of memberships) {
      if (
        registeredProfileIds.has(
          membership.profile_id,
        )
      ) {
        continue;
      }

      const profile =
        normalizeAvailableProfile(
          membership.profiles,
        );

      if (profile) {
        profiles.set(profile.id, profile);
      }
    }

    return Array.from(
      profiles.values(),
    ).sort((first, second) =>
      first.full_name.localeCompare(
        second.full_name,
        'pt-BR',
      ),
    );
  },

  async create(
    input: StudentFormData,
  ): Promise<void> {
    const data = studentSchema.parse(input);

    await ensureStudentMembership(
      data.profile_id,
      data.institution_id,
    );

    await ensureUniqueStudent(
      data.institution_id,
      data.profile_id,
      data.registration_number,
    );

    const { error } = await supabase
      .from('students')
      .insert([
        {
          ...data,
          cpf: data.cpf ?? null,
        },
      ]);

    if (error) {
      throw error;
    }
  },

  async update(
    id: string,
    institutionId: string,
    input: StudentUpdateData,
  ): Promise<void> {
    const data =
      studentUpdateSchema.parse(input);

    await ensureUniqueRegistrationForUpdate(
      id,
      institutionId,
      data.registration_number,
    );

    const { error } = await supabase
      .from('students')
      .update({
        registration_number:
          data.registration_number,
        birth_date: data.birth_date,
        cpf: data.cpf ?? null,
      })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) {
      throw error;
    }
  },

  async setActive(
    id: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('students')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) {
      throw error;
    }
  },
};