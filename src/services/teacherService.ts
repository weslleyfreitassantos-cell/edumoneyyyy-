import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';

import {
  teacherSchema,
  type TeacherFormData,
} from '../schemas/adminSchemas';

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

interface CreateTeacherFunctionResponse {
  teacher: CreatedTeacher;
  invitation_sent: boolean;
}

function normalizeTeacherProfile(
  relation: TeacherQueryRow['profiles'],
): TeacherProfileSummary | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function isCreatedTeacher(
  value: unknown,
): value is CreatedTeacher {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'profile_id' in value &&
    typeof value.profile_id === 'string' &&
    'full_name' in value &&
    typeof value.full_name === 'string' &&
    'email' in value &&
    typeof value.email === 'string'
  );
}

function isCreateTeacherResponse(
  value: unknown,
): value is CreateTeacherFunctionResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('teacher' in value)
  ) {
    return false;
  }

  return isCreatedTeacher(
    value.teacher,
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

  if (
    error instanceof FunctionsRelayError
  ) {
    return 'A função de cadastro está temporariamente indisponível.';
  }

  if (
    error instanceof FunctionsFetchError
  ) {
    return 'Não foi possível conectar à função de cadastro.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível cadastrar o professor.';
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

    const {
      data: response,
      error,
    } = await supabase.functions.invoke(
      'create-teacher',
      {
        body: data,
      },
    );

    if (error) {
      throw new Error(
        await getFunctionErrorMessage(
          error,
        ),
      );
    }

    if (
      !isCreateTeacherResponse(response)
    ) {
      throw new Error(
        'A função respondeu em um formato inválido.',
      );
    }

    return response.teacher;
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
