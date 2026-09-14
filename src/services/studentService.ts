import { supabase } from '../lib/supabaseClient';

import {
  studentSchema,
  studentUpdateSchema,
  type StudentFormData,
  type StudentUpdateData,
} from '../schemas/adminSchemas';
import { schoolUserInviteService } from './schoolUserInviteService';

export interface StudentProfileSummary {
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export interface StudentListProfileSummary {
  full_name: string;
  email: string;
}

export interface StudentListRow {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  active: boolean;
  profiles: StudentListProfileSummary | null;
}

export interface StudentPage {
  rows: StudentListRow[];
  total: number;
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

interface StudentListQueryRow {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  active: boolean;
  profiles:
    | StudentListProfileSummary
    | StudentListProfileSummary[]
    | null;
}

export interface CreatedStudent {
  id: string;
  profile_id: string;
  registration_number: string;
  full_name: string;
  email: string;
}

function normalizeStudentProfile(
  relation: StudentQueryRow['profiles'],
): StudentProfileSummary | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function normalizeStudentListProfile(
  relation: StudentListQueryRow['profiles'],
): StudentListProfileSummary | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function escapePostgrestSearch(value: string): string {
  return value.replace(/[\\%_,()]/g, '\\$&');
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

  async listPage({
    institutionId,
    page,
    pageSize,
    search,
  }: {
    institutionId: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<StudentPage> {
    const offset = Math.max(0, page - 1) * pageSize;
    const normalizedSearch = search?.trim() ?? '';

    let query = supabase
      .from('students')
      .select(
        `
          id,
          profile_id,
          institution_id,
          registration_number,
          active,
          profiles:profile_id!inner (
            full_name,
            email
          )
        `,
        { count: 'exact' },
      )
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (normalizedSearch) {
      const pattern = escapePostgrestSearch(normalizedSearch);
      query = query.or(
        `registration_number.ilike.%${pattern}%,profiles.full_name.ilike.%${pattern}%,profiles.email.ilike.%${pattern}%`,
      );
    }

    const { data, error, count } = await query.range(
      offset,
      offset + pageSize - 1,
    );

    if (error) {
      throw error;
    }

    return {
      rows: ((data ?? []) as unknown as StudentListQueryRow[]).map((row) => ({
        id: row.id,
        profile_id: row.profile_id,
        institution_id: row.institution_id,
        registration_number: row.registration_number,
        active: row.active,
        profiles: normalizeStudentListProfile(row.profiles),
      })),
      total: count ?? 0,
    };
  },

  async getById(
    id: string,
    institutionId: string,
  ): Promise<StudentRow> {
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
      .eq('id', id)
      .eq('institution_id', institutionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Aluno não encontrado nesta instituição.');
    }

    const row = data as unknown as StudentQueryRow;
    return {
      id: row.id,
      profile_id: row.profile_id,
      institution_id: row.institution_id,
      registration_number: row.registration_number,
      birth_date: row.birth_date,
      cpf: row.cpf ?? null,
      active: row.active,
      created_at: row.created_at ?? undefined,
      profiles: normalizeStudentProfile(row.profiles),
    };
  },

  async create(
    input: StudentFormData,
  ): Promise<CreatedStudent> {
    const data = studentSchema.parse(input);

    const response =
      await schoolUserInviteService.invite({
        institutionId: data.institution_id,
        role: 'STUDENT',
        fullName: data.full_name,
        email: data.email,
        student: {
          birthDate: data.birth_date,
          ...(data.cpf ? { cpf: data.cpf } : {}),
        },
      });

    if (!response.student) {
      throw new Error(
        'A funcao de convite nao retornou o aluno criado.',
      );
    }

    return {
      id: response.student.id,
      profile_id: response.profileId,
      registration_number:
        response.student.registrationNumber,
      full_name: data.full_name,
      email: data.email,
    };
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
