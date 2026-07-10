import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';

import {
  guardianSchema,
  type GuardianFormData,
} from '../schemas/adminSchemas';

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

interface CreateGuardianFunctionResponse {
  guardian: CreatedGuardian;
  guardianships_created: number;
  invitation_sent: boolean;
}

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function isCreatedGuardian(
  value: unknown,
): value is CreatedGuardian {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  return (
    'profile_id' in value &&
    typeof value.profile_id === 'string' &&
    'full_name' in value &&
    typeof value.full_name === 'string' &&
    'email' in value &&
    typeof value.email === 'string'
  );
}

function isCreateGuardianResponse(
  value: unknown,
): value is CreateGuardianFunctionResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'guardian' in value &&
    isCreatedGuardian(value.guardian)
  );
}

async function getFunctionErrorMessage(
  error: unknown,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown =
        await error.context.json();

      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
      ) {
        return body.error;
      }
    } catch {
      return error.message;
    }
  }

  if (error instanceof FunctionsRelayError) {
    return 'A função de cadastro está temporariamente indisponível.';
  }

  if (error instanceof FunctionsFetchError) {
    return 'Não foi possível conectar à função de cadastro.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível cadastrar o responsável.';
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

    const {
      data: response,
      error,
    } = await supabase.functions.invoke(
      'create-guardian',
      {
        body: data,
      },
    );

    if (error) {
      throw new Error(
        await getFunctionErrorMessage(error),
      );
    }

    if (!isCreateGuardianResponse(response)) {
      throw new Error(
        'A função respondeu em um formato inválido.',
      );
    }

    return response.guardian;
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
        'Vínculo não encontrado nesta instituição.',
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
