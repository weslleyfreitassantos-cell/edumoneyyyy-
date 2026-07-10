import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

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

export interface CreatedStudent {
  id: string;
  profile_id: string;
  registration_number: string;
  full_name: string;
  email: string;
}

interface CreateStudentFunctionResponse {
  student: CreatedStudent;
  invitation_sent: boolean;
}

function normalizeStudentProfile(
  relation: StudentQueryRow['profiles'],
): StudentProfileSummary | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function isCreatedStudent(
  value: unknown,
): value is CreatedStudent {
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
    'registration_number' in value &&
    typeof value.registration_number ===
    'string' &&
    'full_name' in value &&
    typeof value.full_name === 'string' &&
    'email' in value &&
    typeof value.email === 'string'
  );
}

function isCreateStudentResponse(
  value: unknown,
): value is CreateStudentFunctionResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('student' in value)
  ) {
    return false;
  }

  return isCreatedStudent(value.student);
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

  return 'Não foi possível cadastrar o aluno.';
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

  async create(
    input: StudentFormData,
  ): Promise<CreatedStudent> {
    const data = studentSchema.parse(input);

    const {
      data: response,
      error,
    } = await supabase.functions.invoke(
      'create-student',
      {
        body: data,
      },
    );

    if (error) {
      throw new Error(
        await getFunctionErrorMessage(error),
      );
    }

    if (!isCreateStudentResponse(response)) {
      throw new Error(
        'A função respondeu em um formato inválido.',
      );
    }

    return response.student;
  },

  async update(
    id: string,
    institutionId: string,
    input: StudentUpdateData,
  ): Promise<void> {
    const data =
      studentUpdateSchema.parse(input);

    const { error } = await supabase
      .from('students')
      .update({
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