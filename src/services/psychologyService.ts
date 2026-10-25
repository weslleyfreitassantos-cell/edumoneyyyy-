import { supabase } from '../lib/supabaseClient';

type LooseClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  from: (table: string) => any;
  channel: (name: string, options?: { config?: { private?: boolean } }) => any;
  removeChannel: (channel: unknown) => Promise<unknown>;
};

const client = supabase as unknown as LooseClient;

export type PsychologyErrorCode =
  | 'NOT_AUTHORIZED'
  | 'AUTHORIZATION_REQUIRED'
  | 'SLOT_UNAVAILABLE'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'CANCELLATION_WINDOW_CLOSED'
  | 'SESSION_NOT_STARTED'
  | 'SESSION_CLOSED'
  | 'VERSION_CONFLICT'
  | 'INVALID_MESSAGE'
  | 'MESSAGE_RATE_LIMIT'
  | 'INVALID_PROFESSIONAL_REGISTRATION'
  | 'PROFESSIONAL_MEMBERSHIP_REQUIRED'
  | 'PROFESSIONAL_NOT_FOUND'
  | 'ASSIGNMENT_NOT_FOUND'
  | 'INVALID_DATE_RANGE'
  | 'UNKNOWN';

export class PsychologyServiceError extends Error {
  readonly code: PsychologyErrorCode;

  constructor(code: PsychologyErrorCode) {
    super(code);
    this.name = 'PsychologyServiceError';
    this.code = code;
  }
}

const knownErrors = new Set<PsychologyErrorCode>([
  'NOT_AUTHORIZED',
  'AUTHORIZATION_REQUIRED',
  'SLOT_UNAVAILABLE',
  'IDEMPOTENCY_KEY_REUSED',
  'INVALID_IDEMPOTENCY_KEY',
  'CANCELLATION_WINDOW_CLOSED',
  'SESSION_NOT_STARTED',
  'SESSION_CLOSED',
  'VERSION_CONFLICT',
  'INVALID_MESSAGE',
  'MESSAGE_RATE_LIMIT',
  'INVALID_PROFESSIONAL_REGISTRATION',
  'PROFESSIONAL_MEMBERSHIP_REQUIRED',
  'PROFESSIONAL_NOT_FOUND',
  'ASSIGNMENT_NOT_FOUND',
  'INVALID_DATE_RANGE',
]);

function toSafeError(error: { code?: string; message?: string }): PsychologyServiceError {
  const candidate = error.message?.match(/[A-Z][A-Z_]{2,}/)?.[0] as PsychologyErrorCode | undefined;
  return new PsychologyServiceError(candidate && knownErrors.has(candidate) ? candidate : 'UNKNOWN');
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw toSafeError(error);
  return data as T;
}

export interface PsychologyProfessionalCandidate {
  profile_id: string;
  full_name: string;
  email: string;
  registered: boolean;
  verification_status: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | null;
  crp_registration: string | null;
  crp_state: string | null;
  linked: boolean;
}

export interface PsychologyStudentCandidate {
  profile_id: string;
  full_name: string;
  registrations: Array<{
    student_id: string;
    registration_number: string | null;
    assigned: boolean;
    assigned_professionals: Array<{ profile_id: string; full_name: string }>;
    authorization_status: 'ACTIVE' | 'REVOKED' | null;
    enrollments: Array<{
      class_id: string;
      class_name: string;
      grade_level: string | null;
      academic_year_id: string;
      academic_year_name: string;
    }>;
  }>;
}

export interface PsychologyManagementCandidates {
  professionals: PsychologyProfessionalCandidate[];
  students: PsychologyStudentCandidate[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  filters: {
    classes: Array<{ id: string; name: string; grade_level: string | null; academic_year_name: string }>;
    grades: string[];
  };
}

export interface PsychologyManagementCandidateQuery {
  search?: string;
  classId?: string;
  gradeLevel?: string;
  assignmentStatus?: 'ALL' | 'ASSIGNED' | 'UNASSIGNED';
  page?: number;
  pageSize?: number;
}

export interface PsychologyAuthorizationTarget {
  student_id: string;
  student_name: string;
  is_minor: boolean;
  authorization_status: 'ACTIVE' | 'REVOKED' | 'NONE';
  is_signatory: boolean;
}

export interface PsychologySlot {
  professional_profile_id: string;
  professional_name: string;
  crp_registration: string;
  crp_state: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
}

export interface PsychologyAppointment {
  appointment_id: string;
  student_id: string;
  student_name: string;
  professional_profile_id: string;
  professional_name: string;
  crp_registration: string;
  crp_state: string;
  starts_at: string;
  ends_at: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  session_id: string;
  session_status: 'WAITING' | 'IN_PROGRESS' | 'CLOSED';
}

export interface PsychologyAvailabilityRule {
  id: string;
  institution_id: string;
  professional_profile_id: string;
  day_of_week: number;
  start_local: string;
  end_local: string;
  timezone: string;
  session_minutes: number;
  preparation_minutes: number;
  valid_from: string;
  valid_until: string | null;
  active: boolean;
}

export interface PsychologyAvailabilityBlock {
  id: string;
  starts_at: string;
  ends_at: string;
}

export interface PsychologyMessage {
  id: number;
  session_id: string;
  sender_profile_id: string;
  client_message_key: string;
  body: string;
  created_at: string;
}

export interface PsychologyNote {
  id: string;
  session_id: string;
  author_profile_id: string;
  status: 'DRAFT' | 'FINALIZED';
  version: number;
  content: Record<string, string>;
  finalized_at: string | null;
  updated_at: string;
}

export interface PsychologyNoteVersion {
  id: number;
  version: number;
  kind: 'DRAFT_SAVE' | 'FINALIZED' | 'ADDENDUM';
  content: Record<string, string>;
  author_profile_id: string;
  created_at: string;
}

export interface PsychologyMessageSubscription {
  ready: Promise<void>;
  unsubscribe: () => void;
}

export const psychologyService = {
  moduleEnabled(institutionId: string) {
    return rpc<boolean>('psychology_module_enabled', {
      target_institution_id: institutionId,
    });
  },

  setModuleEnabled(institutionId: string, enabled: boolean) {
    return rpc<boolean>('psychology_set_module_enabled', {
      target_institution_id: institutionId,
      target_enabled: enabled,
    });
  },

  checkSessionAccess(sessionId: string) {
    return rpc<boolean>('psychology_check_session_access', {
      target_session_id: sessionId,
    });
  },

  listManagementCandidates(institutionId: string, query: PsychologyManagementCandidateQuery = {}) {
    return rpc<PsychologyManagementCandidates>('psychology_search_management_candidates', {
      target_institution_id: institutionId,
      search_text: query.search?.trim() || null,
      class_filter_id: query.classId || null,
      grade_filter: query.gradeLevel || null,
      assignment_filter: query.assignmentStatus ?? 'ALL',
      page_number: query.page ?? 1,
      page_size: query.pageSize ?? 25,
    });
  },

  listMyAuthorizationTargets(institutionId: string) {
    return rpc<PsychologyAuthorizationTarget[]>('psychology_list_my_authorization_targets', {
      target_institution_id: institutionId,
    });
  },

  registerProfessional(institutionId: string, profileId: string, crpRegistration: string, crpState: string) {
    return rpc<{ profile_id: string; verification_status: string }>('psychology_register_professional', {
      target_institution_id: institutionId,
      target_profile_id: profileId,
      target_crp_registration: crpRegistration,
      target_crp_state: crpState,
    });
  },

  verifyProfessional(institutionId: string, profileId: string) {
    return rpc<void>('psychology_verify_professional', {
      target_institution_id: institutionId,
      target_profile_id: profileId,
      human_crp_verified: true,
    });
  },

  setStudentAssignment(institutionId: string, studentId: string, professionalId: string, active: boolean) {
    return rpc<string>('psychology_set_student_assignment', {
      target_institution_id: institutionId,
      target_student_id: studentId,
      target_professional_profile_id: professionalId,
      make_active: active,
    });
  },

  recordAuthorization(studentId: string) {
    return rpc<{ student_id: string; status: string; confirmed_at: string }>('psychology_record_authorization', {
      target_student_id: studentId,
      accept_privacy_notice: true,
      accept_service_terms: true,
      authorize_treatment: true,
    });
  },

  revokeAuthorization(studentId: string) {
    return rpc<void>('psychology_revoke_authorization', { target_student_id: studentId });
  },

  listAvailableSlots(institutionId: string, studentId: string, fromDate: string) {
    return rpc<PsychologySlot[]>('psychology_list_available_slots', {
      target_institution_id: institutionId,
      target_student_id: studentId,
      from_date: fromDate,
    });
  },

  bookAppointment(institutionId: string, studentId: string, professionalId: string, startsAt: string, idempotencyKey = crypto.randomUUID()) {
    return rpc<{ appointment_id: string; status: string }>('psychology_book_appointment', {
      target_institution_id: institutionId,
      target_student_id: studentId,
      target_professional_profile_id: professionalId,
      target_starts_at: startsAt,
      client_idempotency_key: idempotencyKey,
    });
  },

  listAppointments(institutionId: string, fromAt: string, throughAt: string) {
    return rpc<PsychologyAppointment[]>('psychology_list_appointments', {
      target_institution_id: institutionId,
      from_at: fromAt,
      through_at: throughAt,
    });
  },

  cancelAppointment(appointmentId: string, operationKey = crypto.randomUUID()) {
    return rpc<{ appointment_id: string; status: string }>('psychology_cancel_appointment', {
      target_appointment_id: appointmentId,
      operation_key: operationKey,
    });
  },

  rescheduleAppointment(appointmentId: string, startsAt: string, operationKey = crypto.randomUUID()) {
    return rpc<{ appointment_id: string; status: string; starts_at: string }>('psychology_reschedule_appointment', {
      target_appointment_id: appointmentId,
      new_starts_at: startsAt,
      operation_key: operationKey,
    });
  },

  listAvailability(institutionId: string, professionalId: string) {
    return client.from('psychology_availability_rules')
      .select('id, institution_id, professional_profile_id, day_of_week, start_local, end_local, timezone, session_minutes, preparation_minutes, valid_from, valid_until, active')
      .eq('institution_id', institutionId)
      .eq('professional_profile_id', professionalId)
      .order('day_of_week')
      .order('start_local')
      .then(({ data, error }: { data: PsychologyAvailabilityRule[] | null; error: { code?: string; message?: string } | null }) => {
        if (error) throw toSafeError(error);
        return data ?? [];
      });
  },

  listAvailabilityBlocks(institutionId: string, professionalId: string) {
    return client.from('psychology_availability_exceptions')
      .select('id, starts_at, ends_at')
      .eq('institution_id', institutionId)
      .eq('professional_profile_id', professionalId)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')
      .then(({ data, error }: { data: PsychologyAvailabilityBlock[] | null; error: { code?: string; message?: string } | null }) => {
        if (error) throw toSafeError(error);
        return data ?? [];
      });
  },

  setAvailabilityRule(input: {
    institutionId: string;
    ruleId: string | null;
    dayOfWeek: number;
    startLocal: string;
    endLocal: string;
    timezone: string;
    sessionMinutes: number;
    preparationMinutes: number;
    validFrom: string;
    validUntil: string | null;
    active: boolean;
  }) {
    return rpc<string>('psychology_set_availability_rule', {
      target_institution_id: input.institutionId,
      target_rule_id: input.ruleId,
      target_day_of_week: input.dayOfWeek,
      target_start_local: input.startLocal,
      target_end_local: input.endLocal,
      target_timezone: input.timezone,
      target_session_minutes: input.sessionMinutes,
      target_preparation_minutes: input.preparationMinutes,
      target_valid_from: input.validFrom,
      target_valid_until: input.validUntil,
      target_active: input.active,
    });
  },

  addAvailabilityBlock(institutionId: string, startsAt: string, endsAt: string) {
    return rpc<string>('psychology_add_availability_block', {
      target_institution_id: institutionId,
      target_starts_at: startsAt,
      target_ends_at: endsAt,
    });
  },

  removeAvailabilityBlock(institutionId: string, blockId: string) {
    return rpc<void>('psychology_remove_availability_block', {
      target_institution_id: institutionId,
      target_block_id: blockId,
    });
  },

  startSession(sessionId: string) {
    return rpc<{ session_id: string; status: string; ends_at: string }>('psychology_start_session', {
      target_session_id: sessionId,
    });
  },

  closeSession(sessionId: string, outcome: 'COMPLETED' | 'NO_SHOW') {
    return rpc<{ session_id: string; status: string; appointment_status: string }>('psychology_close_session', {
      target_session_id: sessionId,
      outcome,
    });
  },

  async listMessages(sessionId: string, options: { beforeId?: number; afterId?: number } = {}) {
    let query = client.from('psychology_messages')
      .select('id, session_id, sender_profile_id, client_message_key, body, created_at')
      .eq('session_id', sessionId)
      .order('id', { ascending: options.afterId !== undefined });
    if (options.beforeId !== undefined) query = query.lt('id', options.beforeId);
    if (options.afterId !== undefined) query = query.gt('id', options.afterId);
    const { data, error } = await query.limit(100);
    if (error) throw toSafeError(error);
    const messages = (data ?? []) as PsychologyMessage[];
    return options.afterId !== undefined ? messages : messages.reverse();
  },

  subscribeMessages(sessionId: string, onChange: () => void, onStatus?: (status: string) => void): PsychologyMessageSubscription {
    let resolveReady!: () => void;
    let rejectReady!: (error: PsychologyServiceError) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const channel = client.channel(`psychology-session:${sessionId}`, {
      config: { private: true },
    })
      .on('broadcast', { event: 'psychology_message' }, onChange)
      .subscribe((status: string) => {
        onStatus?.(status);
        if (status === 'SUBSCRIBED') {
          resolveReady();
          onChange();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          rejectReady(new PsychologyServiceError('UNKNOWN'));
        }
      });
    return { ready, unsubscribe: () => { void client.removeChannel(channel); } };
  },

  sendMessage(sessionId: string, body: string, clientMessageKey: string) {
    return rpc<{ message_id: number; status: 'SENT' }>('psychology_send_message', {
      target_session_id: sessionId,
      message_body: body,
      client_message_key: clientMessageKey,
    });
  },

  async getNote(sessionId: string): Promise<PsychologyNote | null> {
    const { data, error } = await client.from('psychology_notes')
      .select('id, session_id, author_profile_id, status, version, content, finalized_at, updated_at')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw toSafeError(error);
    return data as PsychologyNote | null;
  },

  async listNoteVersions(noteId: string): Promise<PsychologyNoteVersion[]> {
    const { data, error } = await client.from('psychology_note_versions')
      .select('id, version, kind, content, author_profile_id, created_at')
      .eq('note_id', noteId)
      .order('version');
    if (error) throw toSafeError(error);
    return (data ?? []) as PsychologyNoteVersion[];
  },

  saveNoteDraft(sessionId: string, expectedVersion: number, content: Record<string, string>) {
    return rpc<{ version: number; status: string }>('psychology_save_note_draft', {
      target_session_id: sessionId,
      expected_version: expectedVersion,
      note_content: content,
    });
  },

  finalizeNote(sessionId: string, expectedVersion: number) {
    return rpc<{ version: number; status: string }>('psychology_finalize_note', {
      target_session_id: sessionId,
      expected_version: expectedVersion,
    });
  },

  addNoteAddendum(sessionId: string, expectedVersion: number, addendum: string) {
    return rpc<{ version: number; status: string }>('psychology_add_note_addendum', {
      target_session_id: sessionId,
      expected_version: expectedVersion,
      addendum_content: { addendum },
    });
  },
};

export function psychologyErrorMessage(error: unknown): string {
  const code = error instanceof PsychologyServiceError ? error.code : 'UNKNOWN';
  const messages: Record<PsychologyErrorCode, string> = {
    NOT_AUTHORIZED: 'Seu acesso não permite esta ação.',
    AUTHORIZATION_REQUIRED: 'A autorização necessária ainda não foi registrada.',
    SLOT_UNAVAILABLE: 'Este horário não está mais disponível. Atualize a lista e tente outro.',
    IDEMPOTENCY_KEY_REUSED: 'A solicitação já foi processada. Atualize os dados da tela.',
    INVALID_IDEMPOTENCY_KEY: 'Não foi possível identificar a solicitação. Tente novamente.',
    CANCELLATION_WINDOW_CLOSED: 'O prazo para alterar este agendamento foi encerrado.',
    SESSION_NOT_STARTED: 'O atendimento ainda não pode ser iniciado neste horário.',
    SESSION_CLOSED: 'Este atendimento está encerrado para novas mensagens.',
    VERSION_CONFLICT: 'O registro mudou em outra aba. Recarregue antes de continuar.',
    INVALID_MESSAGE: 'A mensagem está vazia ou excede o limite permitido.',
    MESSAGE_RATE_LIMIT: 'Aguarde um pouco antes de enviar outra mensagem.',
    INVALID_PROFESSIONAL_REGISTRATION: 'Confira o número e a UF do registro profissional.',
    PROFESSIONAL_MEMBERSHIP_REQUIRED: 'Convide primeiro a profissional para esta instituição.',
    PROFESSIONAL_NOT_FOUND: 'O perfil profissional não está disponível nesta instituição.',
    ASSIGNMENT_NOT_FOUND: 'Esse vínculo não está ativo. Atualize a lista antes de tentar novamente.',
    INVALID_DATE_RANGE: 'O intervalo de datas não é válido.',
    UNKNOWN: 'Não foi possível concluir a operação. Tente novamente mais tarde.',
  };
  return messages[code];
}
