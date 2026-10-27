import { supabase } from '../lib/supabaseClient';

import { schoolUserInviteService } from './schoolUserInviteService';
import { schoolUserManagementService } from './schoolUserManagementService';
import { uploadStudentDocumentFiles } from './studentDocumentService';

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
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'REQUESTED'
  | 'DELIVERED'
  | 'UNDER_REVIEW'
  | 'VALIDATED'
  | 'REJECTED'
  | 'DISPENSED';

export interface StudentDocumentStatusEvent {
  document_type: string;
  from_status: StudentDocumentStatus | null;
  to_status: StudentDocumentStatus;
  actor_profile_id: string | null;
  changed_at: string;
}

export interface StudentDocumentDraft {
  document_type: string;
  status: StudentDocumentStatus;
  notes: string;
  file_path?: string | null;
  file?: File | null;
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
  draftId?: string;
  draftVersion?: number;
}

export interface StudentEditorData {
  studentId: string;
  enrollmentId: string | null;
  draft: FullStudentEnrollmentDraft;
  documentStatusHistory: StudentDocumentStatusEvent[];
}

export interface StudentEnrollmentDraftSummary {
  draft_id: string;
  student_name: string;
  current_step: number;
  version: number;
  status: 'OPEN' | 'FINALIZING';
  updated_at: string;
}

export interface StudentEnrollmentDraftRecord {
  draft_id: string;
  institution_id: string;
  payload: FullStudentEnrollmentDraft;
  current_step: number;
  version: number;
  status: 'OPEN' | 'FINALIZING';
  created_student_id: string | null;
  created_guardian_profile_ids: Record<string, string>;
}

export interface StudentEnrollmentDraftSaveResult {
  draft_id: string;
  version: number;
}

function serializeEnrollmentDraft(
  draft: FullStudentEnrollmentDraft,
): FullStudentEnrollmentDraft {
  return {
    identity: { ...draft.identity },
    address: { ...draft.address },
    guardians: draft.guardians.map((guardian) => ({ ...guardian })),
    previous_schooling: { ...draft.previous_schooling },
    health: { ...draft.health },
    documents: draft.documents.map(({ document_type, status, notes, file }) => ({
      document_type,
      // A selected File is intentionally not stored in a resumable draft.
      // It must be re-selected after resume before the document can be delivered.
      status: file ? 'PENDING' : status,
      notes,
    })),
    academic_year_id: draft.academic_year_id,
    class_id: draft.class_id,
    enrolled_at: draft.enrolled_at,
  };
}

function rpcRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function versionValue(value: unknown): number {
  const version = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('ENROLLMENT_DRAFT_INVALID_RESPONSE');
  }
  return version;
}

export async function listStudentEnrollmentDrafts(
  institutionId: string,
): Promise<StudentEnrollmentDraftSummary[]> {
  const { data, error } = await supabase.rpc(
    'list_student_enrollment_drafts',
    { p_institution_id: institutionId },
  );
  if (error) throw error;
  return (Array.isArray(data) ? data : []).filter((row): row is StudentEnrollmentDraftSummary => {
    const record = rpcRecord(row);
    return Boolean(
      record && typeof record.draft_id === 'string' &&
      typeof record.student_name === 'string' &&
      typeof record.updated_at === 'string',
    );
  }).map((row) => ({
    ...row,
    current_step: Number(row.current_step),
    version: versionValue(row.version),
  }));
}

export async function getStudentEnrollmentDraft(
  institutionId: string,
  draftId: string,
): Promise<StudentEnrollmentDraftRecord> {
  const { data, error } = await supabase.rpc(
    'get_student_enrollment_draft',
    { p_institution_id: institutionId, p_draft_id: draftId },
  );
  if (error) throw error;
  const record = rpcRecord(data);
  if (
    !record || record.draft_id !== draftId ||
    record.institution_id !== institutionId ||
    !rpcRecord(record.payload)
  ) {
    throw new Error('ENROLLMENT_DRAFT_INVALID_RESPONSE');
  }
  const payload = record.payload as FullStudentEnrollmentDraft;
  return {
    draft_id: draftId,
    institution_id: institutionId,
    payload: {
      ...payload,
      documents: (payload.documents ?? []).map((document) => ({
        document_type: document.document_type,
        status: document.status,
        notes: document.notes ?? '',
      })),
    },
    current_step: Number(record.current_step),
    version: versionValue(record.version),
    status: record.status === 'FINALIZING' ? 'FINALIZING' : 'OPEN',
    created_student_id: typeof record.created_student_id === 'string'
      ? record.created_student_id
      : null,
    created_guardian_profile_ids: rpcRecord(record.created_guardian_profile_ids) as Record<string, string> ?? {},
  };
}

export async function saveStudentEnrollmentDraft(
  institutionId: string,
  draftId: string | null,
  expectedVersion: number | null,
  draft: FullStudentEnrollmentDraft,
  currentStep: number,
): Promise<StudentEnrollmentDraftSaveResult> {
  const { data, error } = await supabase.rpc(
    'save_student_enrollment_draft',
    {
      p_institution_id: institutionId,
      p_draft_id: draftId,
      p_expected_version: expectedVersion,
      p_payload: serializeEnrollmentDraft(draft),
      p_current_step: currentStep,
    },
  );
  if (error) throw error;
  const record = rpcRecord(data);
  if (typeof record?.draft_id !== 'string') {
    throw new Error('ENROLLMENT_DRAFT_INVALID_RESPONSE');
  }
  return { draft_id: record.draft_id, version: versionValue(record.version) };
}

export async function discardStudentEnrollmentDraft(
  institutionId: string,
  draftId: string,
  expectedVersion: number,
): Promise<void> {
  const { error } = await supabase.rpc(
    'discard_student_enrollment_draft',
    {
      p_institution_id: institutionId,
      p_draft_id: draftId,
      p_expected_version: expectedVersion,
    },
  );
  if (error) throw error;
}

interface EnrollmentDraftClaim {
  state: 'CLAIMED' | 'IN_PROGRESS' | 'COMPLETED';
  created_student_id?: string | null;
  created_guardian_profile_ids?: Record<string, string>;
  result?: unknown;
}

async function claimEnrollmentDraftFinalization(
  institutionId: string,
  draftId: string,
  expectedVersion: number,
): Promise<EnrollmentDraftClaim> {
  const { data, error } = await supabase.rpc(
    'claim_student_enrollment_draft_finalization',
    {
      p_institution_id: institutionId,
      p_draft_id: draftId,
      p_expected_version: expectedVersion,
    },
  );
  if (error) throw error;
  const record = rpcRecord(data);
  if (!record || !['CLAIMED', 'IN_PROGRESS', 'COMPLETED'].includes(String(record.state))) {
    throw new Error('ENROLLMENT_DRAFT_INVALID_RESPONSE');
  }
  return {
    state: record.state as EnrollmentDraftClaim['state'],
    created_student_id: typeof record.created_student_id === 'string'
      ? record.created_student_id
      : null,
    created_guardian_profile_ids: rpcRecord(record.created_guardian_profile_ids) as Record<string, string> ?? {},
    result: record.result,
  };
}

async function recordEnrollmentDraftProgress(
  institutionId: string,
  draftId: string,
  studentId: string | null,
  guardianProfileIds: Record<number, string>,
): Promise<void> {
  const { error } = await supabase.rpc(
    'record_student_enrollment_draft_progress',
    {
      p_institution_id: institutionId,
      p_draft_id: draftId,
      p_student_id: studentId,
      p_guardian_profile_ids: Object.fromEntries(
        Object.entries(guardianProfileIds).map(([index, profileId]) => [String(index), profileId]),
      ),
    },
  );
  if (error) throw error;
}

async function releaseEnrollmentDraftFinalization(
  institutionId: string,
  draftId: string,
): Promise<void> {
  await supabase.rpc('release_student_enrollment_draft_finalization', {
    p_institution_id: institutionId,
    p_draft_id: draftId,
  });
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
  rows: Array<{ document_type: string; status: StudentDocumentStatus; file_path: string | null; notes: string | null }>,
): StudentDocumentDraft[] {
  const byType = new Map(rows.map((row) => [row.document_type, row]));
  return editorDocumentTypes.map((documentType) => {
    const row = byType.get(documentType);
    return {
      document_type: documentType,
      status: row?.status ?? 'NOT_REQUESTED',
      notes: row?.notes ?? '',
      file_path: row?.file_path ?? null,
    };
  });
}

export async function getFullStudentEditorData(
  institutionId: string,
  studentId: string,
): Promise<StudentEditorData> {
  const [studentResult, detailsResult, addressResult, previousResult, healthResult, documentsResult, documentHistoryResult, guardiansResult, enrollmentResult] = await Promise.all([
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
      .select('document_type, status, file_path, notes')
      .eq('student_id', studentId)
      .eq('institution_id', institutionId)
      .order('document_type'),
    supabase
      .from('student_document_status_history')
      .select('document_type, from_status, to_status, actor_profile_id, changed_at')
      .eq('student_id', studentId)
      .eq('institution_id', institutionId)
      .order('changed_at', { ascending: false })
      .limit(50),
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
    documentHistoryResult,
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
    file_path: string | null;
    notes: string | null;
  }>;
  const documentStatusHistory = (documentHistoryResult.data ?? []) as unknown as StudentDocumentStatusEvent[];

  return {
    studentId: student.id,
    enrollmentId: enrollment?.id ?? null,
    documentStatusHistory,
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
    documents: draft.documents.map((document) => ({
      document_type: document.document_type,
      status: document.file ? 'PENDING' : document.status,
      file_path: document.file_path ?? null,
      notes: document.notes,
    })),
  guardians: draft.guardians.map((guardian) => ({
      guardian_profile_id: guardian.profile_id,
      relationship: guardian.relationship.trim(),
      is_primary: guardian.is_primary,
    })),
  };
}

function parseFullEnrollmentResult(value: unknown): FullEnrollmentResult {
  const result = rpcRecord(value);
  if (
    !result || typeof result.student_id !== 'string' ||
    typeof result.enrollment_id !== 'string'
  ) {
    throw new Error('A matrícula não foi confirmada.');
  }
  return {
    student_id: result.student_id,
    enrollment_id: result.enrollment_id,
    guardian_profile_ids: Array.isArray(result.guardian_profile_ids)
      ? result.guardian_profile_ids.filter((id): id is string => typeof id === 'string')
      : [],
    documents_pending: Number(result.documents_pending ?? 0),
    email_pending: result.email_pending === true,
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
  let claimedDraft = false;

  try {
    if (options.draftId) {
      if (!options.draftVersion) {
        throw new Error('ENROLLMENT_DRAFT_VERSION_CONFLICT');
      }
      const claim = await claimEnrollmentDraftFinalization(
        institutionId,
        options.draftId,
        options.draftVersion,
      );
      if (claim.state === 'IN_PROGRESS') {
        throw new Error('A confirmação desta matrícula já está em andamento. Aguarde um instante e tente novamente.');
      }
      if (claim.state === 'COMPLETED') {
        const completed = parseFullEnrollmentResult(claim.result);
        await uploadStudentDocumentFiles(
          institutionId,
          completed.student_id,
          draft.documents,
          { skipAlreadyUploaded: true },
        );
        return completed;
      }
      claimedDraft = true;
      studentId = studentId ?? claim.created_student_id ?? undefined;
      for (const [index, profileId] of Object.entries(claim.created_guardian_profile_ids ?? {})) {
        if (/^\d+$/.test(index) && typeof profileId === 'string') {
          guardianProfileIds[Number(index)] = profileId;
        }
      }
    }

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
      if (options.draftId) {
        await recordEnrollmentDraftProgress(
          institutionId,
          options.draftId,
          studentId,
          guardianProfileIds,
        );
      }
    }

    for (const [index, guardian] of draft.guardians.entries()) {
      if (guardian.profile_id) {
        guardianProfileIds[index] = guardian.profile_id;
        if (options.draftId) {
          await recordEnrollmentDraftProgress(
            institutionId,
            options.draftId,
            studentId,
            guardianProfileIds,
          );
        }
        continue;
      }

      if (guardianProfileIds[index]) {
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
      if (options.draftId) {
        await recordEnrollmentDraftProgress(
          institutionId,
          options.draftId,
          studentId,
          guardianProfileIds,
        );
      }
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

    const { data, error } = options.draftId
      ? await supabase.rpc('finalize_student_enrollment_draft', {
        p_institution_id: institutionId,
        p_draft_id: options.draftId,
      })
      : await supabase.rpc(
        'create_full_student_enrollment_bundle',
        { p_payload: payload },
      );

    if (error) {
      throw error;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('A matricula nao retornou um resultado valido.');
    }

    const result = parseFullEnrollmentResult(data);

    await uploadStudentDocumentFiles(institutionId, result.student_id, draft.documents);

    return {
      student_id: result.student_id,
      enrollment_id: result.enrollment_id,
      guardian_profile_ids: result.guardian_profile_ids.length > 0
        ? result.guardian_profile_ids
        : Object.values(guardianProfileIds),
      documents_pending: result.documents_pending,
      email_pending: emailPending || result.email_pending,
    };
  } catch (error) {
    if (claimedDraft && options.draftId) {
      try {
        await releaseEnrollmentDraftFinalization(institutionId, options.draftId);
      } catch {
        // Keep the original failure; the draft lease expires for safe recovery.
      }
    }
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

  await uploadStudentDocumentFiles(institutionId, studentId, draft.documents);

}
