import { supabase } from '../lib/supabaseClient';

import { schoolUserInviteService } from './schoolUserInviteService';
import { schoolUserManagementService } from './schoolUserManagementService';

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
  email_pending: boolean;
}

export interface FullStudentEnrollmentOptions {
  continueOnEmailFailure?: boolean;
}

export interface StudentEditorData {
  studentId: string;
  enrollmentId: string | null;
  draft: FullStudentEnrollmentDraft;
}

const editorDocumentTypes = [
  'Certidao de nascimento',
  'RG',
  'CPF',
  'Comprovante de endereco',
  'Historico escolar',
  'Declaracao de transferencia',
  'Carteira de vacinacao',
  'Laudo ou relatorio',
  'Foto 3x4',
  'Outros',
];

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

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function dateValue(value: unknown): string {
  return textValue(value).slice(0, 10);
}

function emptyEditorDocuments(
  rows: Array<{ document_type: string; status: StudentDocumentStatus; notes: string | null }>,
): StudentDocumentDraft[] {
  const byType = new Map(rows.map((row) => [row.document_type, row]));
  return editorDocumentTypes.map((documentType) => {
    const row = byType.get(documentType);
    return {
      document_type: documentType,
      status: row?.status ?? 'PENDING',
      notes: row?.notes ?? '',
    };
  });
}

export async function getFullStudentEditorData(
  institutionId: string,
  studentId: string,
): Promise<StudentEditorData> {
  const [studentResult, detailsResult, addressResult, previousResult, healthResult, documentsResult, guardiansResult, enrollmentResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, profile_id, birth_date, cpf, profiles:profile_id(full_name, email, phone)')
      .eq('id', studentId)
      .eq('institution_id', institutionId)
      .maybeSingle(),
    supabase
      .from('student_registration_details')
      .select('social_name, rg, rg_issuing_authority, rg_state, birth_certificate, nationality, birthplace, birth_state, sex')
      .eq('student_id', studentId)
      .eq('institution_id', institutionId)
      .maybeSingle(),
    supabase
      .from('student_addresses')
      .select('postal_code, street, number, complement, neighborhood, city, state, rural_zone')
      .eq('student_id', studentId)
      .eq('institution_id', institutionId)
      .maybeSingle(),
    supabase
      .from('student_previous_schooling')
      .select('origin_school, origin_network, city, state, last_grade, origin_year, status, observations, history_delivered, transfer_declaration')
      .eq('student_id', studentId)
      .eq('institution_id', institutionId)
      .maybeSingle(),
    supabase
      .from('student_health_information')
      .select('allergies, health_conditions, emergency_medication, disability, autism, giftedness, needs_special_education, school_care_notes')
      .eq('student_id', studentId)
      .eq('institution_id', institutionId)
      .maybeSingle(),
    supabase
      .from('student_documents')
      .select('document_type, status, notes')
      .eq('student_id', studentId)
      .eq('institution_id', institutionId)
      .order('document_type'),
    supabase
      .from('guardianships')
      .select('guardian_profile_id, relationship, is_primary, active, profiles:guardian_profile_id(full_name, email, phone)')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('created_at'),
    supabase
      .from('enrollments')
      .select('id, academic_year_id, class_id, enrolled_at, active')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const results = [
    studentResult,
    detailsResult,
    addressResult,
    previousResult,
    healthResult,
    documentsResult,
    guardiansResult,
    enrollmentResult,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const student = studentResult.data as unknown as {
    id: string;
    birth_date: string | null;
    cpf: string | null;
    profiles: { full_name: string; email: string; phone: string | null } | { full_name: string; email: string; phone: string | null }[] | null;
  } | null;
  if (!student) {
    throw new Error('Aluno nao encontrado na instituicao ativa.');
  }

  const details = detailsResult.data as unknown as Record<string, unknown> | null;
  const address = addressResult.data as unknown as Record<string, unknown> | null;
  const previous = previousResult.data as unknown as Record<string, unknown> | null;
  const health = healthResult.data as unknown as Record<string, unknown> | null;
  const enrollment = enrollmentResult.data as unknown as { id: string; academic_year_id: string; class_id: string; enrolled_at: string | null } | null;
  const profile = relationOne(student.profiles);
  const guardianRows = (guardiansResult.data ?? []) as unknown as Array<{
    guardian_profile_id: string;
    relationship: string;
    is_primary: boolean;
    profiles: { full_name: string; email: string; phone: string | null } | { full_name: string; email: string; phone: string | null }[] | null;
  }>;
  const documentRows = (documentsResult.data ?? []) as unknown as Array<{
    document_type: string;
    status: StudentDocumentStatus;
    notes: string | null;
  }>;

  return {
    studentId: student.id,
    enrollmentId: enrollment?.id ?? null,
    draft: {
      identity: {
        full_name: profile?.full_name ?? '',
        email: profile?.email ?? '',
        birth_date: dateValue(student.birth_date),
        cpf: student.cpf ?? '',
        social_name: textValue(details?.social_name),
        rg: textValue(details?.rg),
        rg_issuing_authority: textValue(details?.rg_issuing_authority),
        rg_state: textValue(details?.rg_state),
        birth_certificate: textValue(details?.birth_certificate),
        nationality: textValue(details?.nationality, 'Brasileira'),
        birthplace: textValue(details?.birthplace),
        birth_state: textValue(details?.birth_state),
        sex: textValue(details?.sex),
        phone: profile?.phone ?? '',
      },
      address: {
        postal_code: textValue(address?.postal_code),
        street: textValue(address?.street),
        number: textValue(address?.number),
        complement: textValue(address?.complement),
        neighborhood: textValue(address?.neighborhood),
        city: textValue(address?.city),
        state: textValue(address?.state),
        rural_zone: address?.rural_zone === true,
      },
      guardians: guardianRows.map((guardian) => {
        const guardianProfile = relationOne(guardian.profiles);
        return {
          mode: 'existing' as const,
          profile_id: guardian.guardian_profile_id,
          full_name: guardianProfile?.full_name ?? '',
          email: guardianProfile?.email ?? '',
          phone: guardianProfile?.phone ?? '',
          relationship: guardian.relationship,
          is_primary: guardian.is_primary,
        };
      }),
      previous_schooling: {
        origin_school: textValue(previous?.origin_school),
        origin_network: textValue(previous?.origin_network),
        city: textValue(previous?.city),
        state: textValue(previous?.state),
        last_grade: textValue(previous?.last_grade),
        origin_year: previous?.origin_year == null ? '' : String(previous.origin_year),
        status: textValue(previous?.status),
        observations: textValue(previous?.observations),
        history_delivered: previous?.history_delivered === true,
        transfer_declaration: previous?.transfer_declaration === true,
      },
      health: {
        allergies: textValue(health?.allergies),
        health_conditions: textValue(health?.health_conditions),
        emergency_medication: textValue(health?.emergency_medication),
        disability: textValue(health?.disability),
        autism: health?.autism === true,
        giftedness: health?.giftedness === true,
        needs_special_education: health?.needs_special_education === true,
        school_care_notes: textValue(health?.school_care_notes),
      },
      documents: emptyEditorDocuments(documentRows),
      academic_year_id: enrollment?.academic_year_id ?? '',
      class_id: enrollment?.class_id ?? '',
      enrolled_at: dateValue(enrollment?.enrolled_at) || new Date().toISOString().slice(0, 10),
    },
  };
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
  enrollmentId?: string | null,
): Record<string, unknown> {
  return {
    institution_id: institutionId,
    student_id: studentId,
    enrollment_id: enrollmentId ?? null,
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
  options: FullStudentEnrollmentOptions = {},
): Promise<FullEnrollmentResult> {
  let studentId = existingStudentId;
  const guardianProfileIds: Record<number, string> = {};
  let emailPending = false;

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
        ...(options.continueOnEmailFailure ? { continueOnEmailFailure: true } : {}),
      });

      if (!student.student) {
        throw new Error('O cadastro do aluno nao foi retornado.');
      }

      studentId = student.student.id;
      emailPending ||= student.emailPending === true || student.invitationSent === false;
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
        ...(options.continueOnEmailFailure ? { continueOnEmailFailure: true } : {}),
      });
      guardianProfileIds[index] = createdGuardian.profileId;
      emailPending ||= createdGuardian.emailPending === true || createdGuardian.invitationSent === false;
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
      email_pending: emailPending,
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

export async function updateFullStudentEnrollment(
  institutionId: string,
  studentId: string,
  enrollmentId: string | null,
  draft: FullStudentEnrollmentDraft,
): Promise<void> {
  await schoolUserManagementService.manage({
    action: 'update_student_identity',
    institutionId,
    studentId,
    fullName: draft.identity.full_name,
    email: draft.identity.email,
    phone: draft.identity.phone || null,
  });

  const guardianProfileIds: Record<number, string> = {};
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
    enrollmentId,
  );

  const { error } = await supabase.rpc(
    'update_full_student_enrollment_bundle',
    { p_payload: payload },
  );

  if (error) {
    throw error;
  }

}
