import { supabase } from '../lib/supabaseClient';

import { schoolUserInviteService } from './schoolUserInviteService';

export interface FullStudentIdentity {
  full_name: string;
  email: string;
  birth_date: string;
  cpf: string;
  social_name: string;
  rg: string;
  rg_issuing_authority: string;
  rg_state: string;
  birth_certificate: string;
  nationality: string;
  birthplace: string;
  birth_state: string;
  sex: string;
  phone: string;
}

export interface StudentAddressDraft {
  postal_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  rural_zone: boolean;
}

export interface GuardianDraft {
  mode: 'existing' | 'new';
  profile_id: string;
  full_name: string;
  email: string;
  phone: string;
  relationship: string;
  is_primary: boolean;
}

export interface PreviousSchoolingDraft {
  origin_school: string;
  origin_network: string;
  city: string;
  state: string;
  last_grade: string;
  origin_year: string;
  status: string;
  observations: string;
  history_delivered: boolean;
  transfer_declaration: boolean;
}

export interface HealthInformationDraft {
  allergies: string;
  health_conditions: string;
  emergency_medication: string;
  disability: string;
  autism: boolean;
  giftedness: boolean;
  needs_special_education: boolean;
  school_care_notes: string;
}

export type StudentDocumentStatus =
  | 'PENDING'
  | 'DELIVERED'
  | 'VALIDATED'
  | 'DISPENSED';

export interface StudentDocumentDraft {
  document_type: string;
  status: StudentDocumentStatus;
  notes: string;
}

export interface FullStudentEnrollmentDraft {
  identity: FullStudentIdentity;
  address: StudentAddressDraft;
  guardians: GuardianDraft[];
  previous_schooling: PreviousSchoolingDraft;
  health: HealthInformationDraft;
  documents: StudentDocumentDraft[];
  academic_year_id: string;
  class_id: string;
  enrolled_at: string;
}

export interface DuplicateStudentCandidate {
  id: string;
  full_name: string;
  email: string;
  birth_date: string;
  cpf: string | null;
  registration_number: string;
}

export interface FullEnrollmentResult {
  student_id: string;
  enrollment_id: string;
  guardian_profile_ids: string[];
  documents_pending: number;
}

export class FullStudentEnrollmentError extends Error {
  studentId?: string;
  guardianProfileIds: Record<number, string>;

  constructor(
    message: string,
    options: {
      studentId?: string;
      guardianProfileIds?: Record<number, string>;
    } = {},
  ) {
    super(message);
    this.name = 'FullStudentEnrollmentError';
    this.studentId = options.studentId;
    this.guardianProfileIds = options.guardianProfileIds ?? {};
  }
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function findDuplicateStudentCandidates(
  institutionId: string,
  input: Pick<FullStudentIdentity, 'full_name' | 'birth_date' | 'cpf'>,
): Promise<DuplicateStudentCandidate[]> {
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      birth_date,
      cpf,
      registration_number,
      profiles:profile_id (full_name, email)
    `)
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    birth_date: string;
    cpf: string | null;
    registration_number: string;
    profiles:
      | { full_name: string; email: string }
      | { full_name: string; email: string }[]
      | null;
  }>;

  const normalizedName = normalize(input.full_name);
  const normalizedCpf = input.cpf.replace(/\D/g, '');

  return rows
    .filter((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;
      const sameCpf = Boolean(normalizedCpf) &&
        row.cpf?.replace(/\D/g, '') === normalizedCpf;
      const sameNameAndBirth =
        normalize(profile?.full_name ?? '') === normalizedName &&
        row.birth_date === input.birth_date;
      return sameCpf || sameNameAndBirth;
    })
    .map((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;
      return {
        id: row.id,
        full_name: profile?.full_name ?? 'Aluno sem nome',
        email: profile?.email ?? '',
        birth_date: row.birth_date,
        cpf: row.cpf,
        registration_number: row.registration_number,
      };
    });
}

function toRpcPayload(
  institutionId: string,
  draft: FullStudentEnrollmentDraft,
  studentId: string,
): Record<string, unknown> {
  return {
    institution_id: institutionId,
    student_id: studentId,
    academic_year_id: draft.academic_year_id,
    class_id: draft.class_id,
    enrolled_at: draft.enrolled_at,
    identity: draft.identity,
    address: draft.address,
    previous_schooling: {
      ...draft.previous_schooling,
      origin_year: draft.previous_schooling.origin_year || null,
    },
    health: draft.health,
    documents: draft.documents,
  guardians: draft.guardians.map((guardian) => ({
      guardian_profile_id: guardian.profile_id,
      relationship: guardian.relationship.trim(),
      is_primary: guardian.is_primary,
    })),
  };
}

export async function createFullStudentEnrollment(
  institutionId: string,
  draft: FullStudentEnrollmentDraft,
  existingStudentId?: string,
): Promise<FullEnrollmentResult> {
  let studentId = existingStudentId;
  const guardianProfileIds: Record<number, string> = {};

  try {
    if (!studentId) {
      const student = await schoolUserInviteService.invite({
        institutionId,
        role: 'STUDENT',
        fullName: draft.identity.full_name,
        email: draft.identity.email,
        phone: clean(draft.identity.phone),
        student: {
          birthDate: draft.identity.birth_date,
          ...(clean(draft.identity.cpf)
            ? { cpf: draft.identity.cpf.trim() }
            : {}),
        },
      });

      if (!student.student) {
        throw new Error('O cadastro do aluno nao foi retornado.');
      }

      studentId = student.student.id;
    }

    for (const [index, guardian] of draft.guardians.entries()) {
      if (guardian.profile_id) {
        guardianProfileIds[index] = guardian.profile_id;
        continue;
      }

      const createdGuardian = await schoolUserInviteService.invite({
        institutionId,
        role: 'GUARDIAN',
        fullName: guardian.full_name,
        email: guardian.email,
        phone: clean(guardian.phone),
        guardian: {
          studentId,
          relationship: guardian.relationship,
        },
      });
      guardianProfileIds[index] = createdGuardian.profileId;
    }

    const payload = toRpcPayload(
      institutionId,
      {
        ...draft,
        guardians: draft.guardians.map((guardian, index) => ({
          ...guardian,
          profile_id: guardian.profile_id || guardianProfileIds[index] || '',
        })),
      },
      studentId,
    );

    const { data, error } = await supabase.rpc(
      'create_full_student_enrollment_bundle',
      { p_payload: payload },
    );

    if (error) {
      throw error;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('A matricula nao retornou um resultado valido.');
    }

    const result = data as Partial<FullEnrollmentResult>;
    if (
      typeof result.student_id !== 'string' ||
      typeof result.enrollment_id !== 'string'
    ) {
      throw new Error('A matricula nao foi confirmada.');
    }

    return {
      student_id: result.student_id,
      enrollment_id: result.enrollment_id,
      guardian_profile_ids: Array.isArray(result.guardian_profile_ids)
        ? result.guardian_profile_ids.filter(
          (id): id is string => typeof id === 'string',
        )
        : Object.values(guardianProfileIds),
      documents_pending: Number(result.documents_pending ?? 0),
    };
  } catch (error) {
    throw new FullStudentEnrollmentError(
      error instanceof Error
        ? error.message
        : 'Nao foi possivel concluir a matricula completa.',
      {
        studentId,
        guardianProfileIds,
      },
    );
  }
}
