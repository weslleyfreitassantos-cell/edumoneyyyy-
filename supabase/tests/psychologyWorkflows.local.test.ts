import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

type AnyClient = SupabaseClient<any, any, any>;
type Role = 'ADMIN' | 'DIRECTOR' | 'GUARDIAN' | 'PSYCHOLOGIST' | 'SECRETARY' | 'STUDENT';
type Actor = { id: string; email: string; client: AnyClient };

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const localDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(client: AnyClient, table: string, row: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(
  service: AnyClient,
  role: Role,
  suffix: string,
  platformRole?: 'SUPER_ADMIN',
): Promise<Actor> {
  const email = `psychology-${suffix}-${role.toLowerCase()}@local.test`;
  const password = 'PsychologyDemo!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${role}: ${error.message}`);
  const user = required(data.user, `${role} auth user`);
  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: `Demo ${role} ${suffix}`,
    email,
    role,
    active: true,
    ...(platformRole ? { platform_role: platformRole } : {}),
  });
  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${role}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, client };
}

function saoPauloDate(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const date = new Date(Date.UTC(values.year, values.month - 1, values.day + offsetDays));
  return date.toISOString().slice(0, 10);
}

function localWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 15)).getUTCDay();
}

async function waitForRealtimeEvent<T>(
  predicate: () => T | undefined,
  timeoutMs = 5000,
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for authorized psychology realtime message');
}

async function subscribeToPsychologyMessages(client: AnyClient, topic: string, sessionId: string) {
  const received: unknown[] = [];
  let resolveSubscribed!: () => void;
  let rejectSubscribed!: (error: Error) => void;
  const subscribed = new Promise<void>((resolve, reject) => {
    resolveSubscribed = resolve;
    rejectSubscribed = reject;
  });
  const channel = client
    .channel(topic)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'psychology_messages',
      filter: `session_id=eq.${sessionId}`,
    }, (payload: { new: unknown }) => received.push(payload.new))
    .subscribe((status: string, error?: Error) => {
      if (status === 'SUBSCRIBED') resolveSubscribed();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        rejectSubscribed(error ?? new Error(`Realtime subscription failed: ${status}`));
      }
    });
  await subscribed;
  return { channel, received };
}

localDescribe('psychology workflows against a disposable local Supabase', () => {
  it('enables, authorizes, books, chats, versions a note and denies unrelated access', async () => {
    const service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const [director, secretary, platformAdmin, psychologist, otherPsychologist, student, unrelatedStudent, guardian, minor, otherInstitutionStudent] = await Promise.all([
      createActor(service, 'DIRECTOR', `${suffix}-director`),
      createActor(service, 'SECRETARY', `${suffix}-secretary`),
      createActor(service, 'ADMIN', `${suffix}-platform-admin`, 'SUPER_ADMIN'),
      createActor(service, 'PSYCHOLOGIST', `${suffix}-psychologist`),
      createActor(service, 'PSYCHOLOGIST', `${suffix}-other-psychologist`),
      createActor(service, 'STUDENT', `${suffix}-student`),
      createActor(service, 'STUDENT', `${suffix}-other`),
      createActor(service, 'GUARDIAN', `${suffix}-guardian`),
      createActor(service, 'STUDENT', `${suffix}-minor`),
      createActor(service, 'STUDENT', `${suffix}-other-institution`),
    ]);
    const institution = await insertOne(service, 'institutions', {
      name: `Psychology local demo ${suffix}`,
      active: true,
    });
    const otherInstitution = await insertOne(service, 'institutions', {
      name: `Psychology other institution ${suffix}`,
      active: true,
    });

    for (const [actor, role] of [
      [director, 'DIRECTOR'],
      [secretary, 'SECRETARY'],
      [psychologist, 'PSYCHOLOGIST'],
      [otherPsychologist, 'PSYCHOLOGIST'],
      [student, 'STUDENT'],
      [unrelatedStudent, 'STUDENT'],
      [guardian, 'GUARDIAN'],
      [minor, 'STUDENT'],
    ] as Array<[Actor, string]>) {
      await insertOne(service, 'memberships', {
        profile_id: actor.id,
        institution_id: institution.id,
        role,
        active: true,
      });
    }
    await insertOne(service, 'memberships', {
      profile_id: otherInstitutionStudent.id,
      institution_id: otherInstitution.id,
      role: 'STUDENT',
      active: true,
    });

    const studentRow = await insertOne(service, 'students', {
      profile_id: student.id,
      institution_id: institution.id,
      registration_number: `PSY-${suffix}`,
      birth_date: '1995-05-12',
      active: true,
    });
    const unrelatedStudentRow = await insertOne(service, 'students', {
      profile_id: unrelatedStudent.id,
      institution_id: institution.id,
      registration_number: `PSY-OTHER-${suffix}`,
      birth_date: '1998-04-09',
      active: true,
    });
    const minorRow = await insertOne(service, 'students', {
      profile_id: minor.id,
      institution_id: institution.id,
      registration_number: `PSY-MINOR-${suffix}`,
      birth_date: '2014-04-09',
      active: true,
    });
    const otherInstitutionStudentRow = await insertOne(service, 'students', {
      profile_id: otherInstitutionStudent.id,
      institution_id: otherInstitution.id,
      registration_number: `PSY-OTHER-INSTITUTION-${suffix}`,
      birth_date: '1998-04-09',
      active: true,
    });
    await insertOne(service, 'guardianships', {
      student_id: minorRow.id,
      guardian_profile_id: guardian.id,
      relationship: 'responsável legal de teste',
      is_primary: true,
      active: true,
    });

    const enable = await director.client.rpc('psychology_set_module_enabled', {
      target_institution_id: institution.id,
      target_enabled: true,
    });
    expect(enable.error).toBeNull();
    expect(enable.data).toBe(true);

    const minorCannotAuthorizeSelf = await minor.client.rpc('psychology_record_authorization', {
      target_student_id: minorRow.id,
      accept_privacy_notice: true,
      accept_service_terms: true,
      authorize_treatment: true,
    });
    expect(minorCannotAuthorizeSelf.error?.code).toBe('P0001');
    const guardianTargets = await guardian.client.rpc('psychology_list_my_authorization_targets', {
      target_institution_id: institution.id,
    });
    expect(guardianTargets.error).toBeNull();
    expect(guardianTargets.data).toEqual([
      expect.objectContaining({ student_id: minorRow.id, is_minor: true, authorization_status: 'NONE' }),
    ]);
    const guardianCannotAuthorizeUnrelatedAdult = await guardian.client.rpc('psychology_record_authorization', {
      target_student_id: unrelatedStudentRow.id,
      accept_privacy_notice: true,
      accept_service_terms: true,
      authorize_treatment: true,
    });
    expect(guardianCannotAuthorizeUnrelatedAdult.error?.code).toBe('P0001');
    const guardianConsent = await guardian.client.rpc('psychology_record_authorization', {
      target_student_id: minorRow.id,
      accept_privacy_notice: true,
      accept_service_terms: true,
      authorize_treatment: true,
    });
    expect(guardianConsent.error).toBeNull();
    const guardianRevocation = await guardian.client.rpc('psychology_revoke_authorization', {
      target_student_id: minorRow.id,
    });
    expect(guardianRevocation.error).toBeNull();

    const registered = await director.client.rpc('psychology_register_professional', {
      target_institution_id: institution.id,
      target_profile_id: psychologist.id,
      target_crp_registration: '03/12345',
      target_crp_state: 'BA',
    });
    expect(registered.error).toBeNull();
    expect(registered.data).toMatchObject({ verification_status: 'PENDING' });

    const verified = await director.client.rpc('psychology_verify_professional', {
      target_institution_id: institution.id,
      target_profile_id: psychologist.id,
      human_crp_verified: true,
    });
    expect(verified.error).toBeNull();

    const otherProfessionalRegistered = await director.client.rpc('psychology_register_professional', {
      target_institution_id: institution.id,
      target_profile_id: otherPsychologist.id,
      target_crp_registration: '03/67890',
      target_crp_state: 'BA',
    });
    expect(otherProfessionalRegistered.error).toBeNull();
    const otherProfessionalVerified = await director.client.rpc('psychology_verify_professional', {
      target_institution_id: institution.id,
      target_profile_id: otherPsychologist.id,
      human_crp_verified: true,
    });
    expect(otherProfessionalVerified.error).toBeNull();

    const assignment = await director.client.rpc('psychology_set_student_assignment', {
      target_institution_id: institution.id,
      target_student_id: studentRow.id,
      target_professional_profile_id: psychologist.id,
      make_active: true,
    });
    expect(assignment.error).toBeNull();
    const otherProfessionalAssignment = await director.client.rpc('psychology_set_student_assignment', {
      target_institution_id: institution.id,
      target_student_id: studentRow.id,
      target_professional_profile_id: otherPsychologist.id,
      make_active: true,
    });
    expect(otherProfessionalAssignment.error).toBeNull();

    const authorizationTargets = await student.client.rpc('psychology_list_my_authorization_targets', {
      target_institution_id: institution.id,
    });
    expect(authorizationTargets.error).toBeNull();
    expect(authorizationTargets.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ student_id: studentRow.id, is_minor: false }),
    ]));

    const authorization = await student.client.rpc('psychology_record_authorization', {
      target_student_id: studentRow.id,
      accept_privacy_notice: true,
      accept_service_terms: true,
      authorize_treatment: true,
    });
    expect(authorization.error).toBeNull();
    expect(authorization.data).toMatchObject({ student_id: studentRow.id, status: 'ACTIVE' });

    const fromDate = saoPauloDate(0);
    const ruleDate = saoPauloDate(1);
    const rule = await psychologist.client.rpc('psychology_set_availability_rule', {
      target_institution_id: institution.id,
      target_rule_id: null,
      target_day_of_week: localWeekday(ruleDate),
      target_start_local: '08:00:00',
      target_end_local: '18:00:00',
      target_timezone: 'America/Sao_Paulo',
      target_session_minutes: 50,
      target_preparation_minutes: 10,
      target_valid_from: fromDate,
      target_valid_until: null,
      target_active: true,
    });
    expect(rule.error).toBeNull();

    const slotsResult = await student.client.rpc('psychology_list_available_slots', {
      target_institution_id: institution.id,
      target_student_id: studentRow.id,
      from_date: fromDate,
    });
    expect(slotsResult.error).toBeNull();
    const slots = slotsResult.data as Array<{ professional_profile_id: string; starts_at: string }>;
    const slot = slots.find((candidate) => candidate.professional_profile_id === psychologist.id);
    expect(slot).toBeDefined();

    const unrelatedSlots = await unrelatedStudent.client.rpc('psychology_list_available_slots', {
      target_institution_id: institution.id,
      target_student_id: studentRow.id,
      from_date: fromDate,
    });
    expect(unrelatedSlots.data).toBeNull();
    expect(unrelatedSlots.error?.code).toBe('P0001');

    const bookingAttempts = await Promise.all([
      student.client.rpc('psychology_book_appointment', {
        target_institution_id: institution.id,
        target_student_id: studentRow.id,
        target_professional_profile_id: psychologist.id,
        target_starts_at: slot!.starts_at,
        client_idempotency_key: crypto.randomUUID(),
      }),
      student.client.rpc('psychology_book_appointment', {
        target_institution_id: institution.id,
        target_student_id: studentRow.id,
        target_professional_profile_id: psychologist.id,
        target_starts_at: slot!.starts_at,
        client_idempotency_key: crypto.randomUUID(),
      }),
    ]);
    expect(bookingAttempts.filter((attempt) => !attempt.error)).toHaveLength(1);
    expect(bookingAttempts.filter((attempt) => attempt.error)).toHaveLength(1);
    const appointmentId = (bookingAttempts.find((attempt) => !attempt.error)!.data as { appointment_id: string }).appointment_id;

    const safeFutureSlots = slots.filter((candidate) =>
      candidate.starts_at !== slot!.starts_at && Date.parse(candidate.starts_at) > Date.now() + 90 * 60_000);
    expect(safeFutureSlots.length).toBeGreaterThanOrEqual(3);
    const cancelSlot = safeFutureSlots[0];
    const rescheduleSlot = safeFutureSlots[1];
    const rescheduleTargetSlot = safeFutureSlots[2];
    const cancelBooking = await student.client.rpc('psychology_book_appointment', {
      target_institution_id: institution.id,
      target_student_id: studentRow.id,
      target_professional_profile_id: psychologist.id,
      target_starts_at: cancelSlot.starts_at,
      client_idempotency_key: crypto.randomUUID(),
    });
    expect(cancelBooking.error).toBeNull();
    const cancelAppointmentId = (cancelBooking.data as { appointment_id: string }).appointment_id;
    const cancellationKey = crypto.randomUUID();
    const cancelled = await student.client.rpc('psychology_cancel_appointment', {
      target_appointment_id: cancelAppointmentId,
      operation_key: cancellationKey,
    });
    expect(cancelled.error).toBeNull();
    expect(cancelled.data).toMatchObject({ appointment_id: cancelAppointmentId, status: 'CANCELLED' });
    const cancellationRetry = await student.client.rpc('psychology_cancel_appointment', {
      target_appointment_id: cancelAppointmentId,
      operation_key: cancellationKey,
    });
    expect(cancellationRetry.error).toBeNull();
    expect(cancellationRetry.data).toMatchObject({ status: 'CANCELLED' });

    const rescheduleBooking = await student.client.rpc('psychology_book_appointment', {
      target_institution_id: institution.id,
      target_student_id: studentRow.id,
      target_professional_profile_id: psychologist.id,
      target_starts_at: rescheduleSlot.starts_at,
      client_idempotency_key: crypto.randomUUID(),
    });
    expect(rescheduleBooking.error).toBeNull();
    const rescheduleAppointmentId = (rescheduleBooking.data as { appointment_id: string }).appointment_id;
    const rescheduleKey = crypto.randomUUID();
    const rescheduled = await student.client.rpc('psychology_reschedule_appointment', {
      target_appointment_id: rescheduleAppointmentId,
      new_starts_at: rescheduleTargetSlot.starts_at,
      operation_key: rescheduleKey,
    });
    expect(rescheduled.error).toBeNull();
    expect(rescheduled.data).toMatchObject({
      appointment_id: rescheduleAppointmentId,
      status: 'SCHEDULED',
      starts_at: rescheduleTargetSlot.starts_at,
    });
    const rescheduleRetry = await student.client.rpc('psychology_reschedule_appointment', {
      target_appointment_id: rescheduleAppointmentId,
      new_starts_at: rescheduleTargetSlot.starts_at,
      operation_key: rescheduleKey,
    });
    expect(rescheduleRetry.error).toBeNull();
    expect(rescheduleRetry.data).toMatchObject({ starts_at: rescheduleTargetSlot.starts_at });

    const sessionRow = await service.from('psychology_sessions').select('id').eq('appointment_id', appointmentId).single();
    expect(sessionRow.error).toBeNull();
    const sessionId = required(sessionRow.data, 'psychology session').id as string;

    const otherPsychologistCannotReadAppointment = await otherPsychologist.client.from('psychology_appointments')
      .select('id').eq('id', appointmentId);
    expect(otherPsychologistCannotReadAppointment.error).toBeNull();
    expect(otherPsychologistCannotReadAppointment.data).toEqual([]);
    const otherPsychologistCannotAccessSession = await otherPsychologist.client.rpc('psychology_check_session_access', {
      target_session_id: sessionId,
    });
    expect(otherPsychologistCannotAccessSession.error).toBeNull();
    expect(otherPsychologistCannotAccessSession.data).toBe(false);
    const otherPsychologistCannotSendMessage = await otherPsychologist.client.rpc('psychology_send_message', {
      target_session_id: sessionId,
      message_body: 'mensagem de outra profissional',
      client_message_key: crypto.randomUUID(),
    });
    expect(otherPsychologistCannotSendMessage.error?.code).toBe('P0001');

    const waitingMessage = await student.client.rpc('psychology_send_message', {
      target_session_id: sessionId,
      message_body: 'mensagem antes de iniciar',
      client_message_key: crypto.randomUUID(),
    });
    expect(waitingMessage.error?.code).toBe('P0001');

    const now = new Date();
    const startedAt = new Date(now.getTime() - 60_000).toISOString();
    const endsAt = new Date(now.getTime() + 30 * 60_000).toISOString();
    const adjustLocalFixture = await service.from('psychology_appointments')
      .update({ starts_at: startedAt, ends_at: endsAt })
      .eq('id', appointmentId);
    expect(adjustLocalFixture.error).toBeNull();

    const started = await psychologist.client.rpc('psychology_start_session', { target_session_id: sessionId });
    expect(started.error).toBeNull();
    expect(started.data).toMatchObject({ status: 'IN_PROGRESS' });

    const realtimeStudent = await subscribeToPsychologyMessages(student.client, `psychology-student-${suffix}`, sessionId);
    const realtimeProfessional = await subscribeToPsychologyMessages(
      psychologist.client,
      `psychology-professional-${suffix}`,
      sessionId,
    );
    const realtimeUnrelatedProfessional = await subscribeToPsychologyMessages(
      otherPsychologist.client,
      `psychology-unrelated-professional-${suffix}`,
      sessionId,
    );
    const sent = await student.client.rpc('psychology_send_message', {
      target_session_id: sessionId,
      message_body: '<script>not html</script>',
      client_message_key: crypto.randomUUID(),
    });
    expect(sent.error).toBeNull();
    await Promise.all([
      waitForRealtimeEvent(() => realtimeStudent.received[0]),
      waitForRealtimeEvent(() => realtimeProfessional.received[0]),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(realtimeUnrelatedProfessional.received).toEqual([]);
    await Promise.all([
      student.client.removeChannel(realtimeStudent.channel),
      psychologist.client.removeChannel(realtimeProfessional.channel),
      otherPsychologist.client.removeChannel(realtimeUnrelatedProfessional.channel),
    ]);
    const savedMessage = await student.client.from('psychology_messages')
      .select('body')
      .eq('session_id', sessionId)
      .single();
    expect(savedMessage.data?.body).toBe('<script>not html</script>');
    const otherPsychologistCannotReadMessages = await otherPsychologist.client.from('psychology_messages')
      .select('id').eq('session_id', sessionId);
    expect(otherPsychologistCannotReadMessages.error).toBeNull();
    expect(otherPsychologistCannotReadMessages.data).toEqual([]);
    const otherInstitutionCannotReadAppointment = await otherInstitutionStudent.client
      .from('psychology_appointments').select('id').eq('id', appointmentId);
    expect(otherInstitutionCannotReadAppointment.error).toBeNull();
    expect(otherInstitutionCannotReadAppointment.data).toEqual([]);
    const otherInstitutionCannotAccessSession = await otherInstitutionStudent.client.rpc(
      'psychology_check_session_access', { target_session_id: sessionId },
    );
    expect(otherInstitutionCannotAccessSession.error).toBeNull();
    expect(otherInstitutionCannotAccessSession.data).toBe(false);
    const otherInstitutionCannotReadMessages = await otherInstitutionStudent.client
      .from('psychology_messages').select('id').eq('session_id', sessionId);
    expect(otherInstitutionCannotReadMessages.error).toBeNull();
    expect(otherInstitutionCannotReadMessages.data).toEqual([]);
    const secretaryCannotReadMessages = await secretary.client.from('psychology_messages')
      .select('id').eq('session_id', sessionId);
    expect(secretaryCannotReadMessages.error).toBeNull();
    expect(secretaryCannotReadMessages.data).toEqual([]);
    const platformAdminCannotReadMessages = await platformAdmin.client.from('psychology_messages')
      .select('id').eq('session_id', sessionId);
    expect(platformAdminCannotReadMessages.error).toBeNull();
    expect(platformAdminCannotReadMessages.data).toEqual([]);
    const secretaryCannotSendMessage = await secretary.client.rpc('psychology_send_message', {
      target_session_id: sessionId,
      message_body: 'mensagem administrativa não autorizada',
      client_message_key: crypto.randomUUID(),
    });
    expect(secretaryCannotSendMessage.error?.code).toBe('P0001');
    const guardianCannotListAppointments = await guardian.client.rpc('psychology_list_appointments', {
      target_institution_id: institution.id,
      from_at: new Date(Date.now() - 60_000).toISOString(),
      through_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    });
    expect(guardianCannotListAppointments.error?.code).toBe('P0001');

    const studentCannotReadClinicalNote = await student.client.from('psychology_notes').select('id').eq('session_id', sessionId);
    expect(studentCannotReadClinicalNote.error).toBeNull();
    expect(studentCannotReadClinicalNote.data).toEqual([]);
    const directorCannotReadClinicalNote = await director.client.from('psychology_notes').select('id').eq('session_id', sessionId);
    expect(directorCannotReadClinicalNote.error).toBeNull();
    expect(directorCannotReadClinicalNote.data).toEqual([]);
    const secretaryCannotReadClinicalNote = await secretary.client.from('psychology_notes').select('id').eq('session_id', sessionId);
    expect(secretaryCannotReadClinicalNote.error).toBeNull();
    expect(secretaryCannotReadClinicalNote.data).toEqual([]);
    const platformAdminCannotReadClinicalNote = await platformAdmin.client
      .from('psychology_notes').select('id').eq('session_id', sessionId);
    expect(platformAdminCannotReadClinicalNote.error).toBeNull();
    expect(platformAdminCannotReadClinicalNote.data).toEqual([]);

    const draft = await psychologist.client.rpc('psychology_save_note_draft', {
      target_session_id: sessionId,
      expected_version: 0,
      note_content: { objective: 'objetivo fictício', session_record: 'registro fictício' },
    });
    expect(draft.error).toBeNull();
    expect(draft.data).toMatchObject({ version: 1, status: 'DRAFT' });

    const savedNote = await service.from('psychology_notes').select('id').eq('session_id', sessionId).single();
    expect(savedNote.error).toBeNull();
    const savedNoteId = required(savedNote.data, 'psychology note').id as string;
    const otherPsychologistCannotReadNote = await otherPsychologist.client.from('psychology_notes')
      .select('id').eq('session_id', sessionId);
    expect(otherPsychologistCannotReadNote.error).toBeNull();
    expect(otherPsychologistCannotReadNote.data).toEqual([]);
    const otherPsychologistCannotReadVersions = await otherPsychologist.client.from('psychology_note_versions')
      .select('id').eq('note_id', savedNoteId);
    expect(otherPsychologistCannotReadVersions.error).toBeNull();
    expect(otherPsychologistCannotReadVersions.data).toEqual([]);

    const finalized = await psychologist.client.rpc('psychology_finalize_note', {
      target_session_id: sessionId,
      expected_version: 1,
    });
    expect(finalized.error).toBeNull();
    expect(finalized.data).toMatchObject({ version: 2, status: 'FINALIZED' });

    const addendum = await psychologist.client.rpc('psychology_add_note_addendum', {
      target_session_id: sessionId,
      expected_version: 2,
      addendum_content: { addendum: 'adendo fictício' },
    });
    expect(addendum.error).toBeNull();
    expect(addendum.data).toMatchObject({ version: 3, status: 'FINALIZED' });

    const closed = await psychologist.client.rpc('psychology_close_session', {
      target_session_id: sessionId,
      outcome: 'COMPLETED',
    });
    expect(closed.error).toBeNull();
    const lateMessage = await student.client.rpc('psychology_send_message', {
      target_session_id: sessionId,
      message_body: 'depois de encerrar',
      client_message_key: crypto.randomUUID(),
    });
    expect(lateMessage.error?.code).toBe('P0001');

    const appointmentsForOtherStudent = await unrelatedStudent.client.rpc('psychology_list_appointments', {
      target_institution_id: institution.id,
      from_at: new Date(Date.now() - 60_000).toISOString(),
      through_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    });
    expect(appointmentsForOtherStudent.error).toBeNull();
    expect(appointmentsForOtherStudent.data).toEqual([]);

    const disabled = await director.client.rpc('psychology_set_module_enabled', {
      target_institution_id: institution.id,
      target_enabled: false,
    });
    expect(disabled.error).toBeNull();
    expect(disabled.data).toBe(false);
    const preserved = await service.from('psychology_appointments').select('id').eq('id', appointmentId).single();
    expect(preserved.error).toBeNull();
    expect(required(preserved.data, 'preserved appointment').id).toBe(appointmentId);
    const cannotAuthorizeWhileDisabled = await student.client.rpc('psychology_record_authorization', {
      target_student_id: studentRow.id,
      accept_privacy_notice: true,
      accept_service_terms: true,
      authorize_treatment: true,
    });
    expect(cannotAuthorizeWhileDisabled.error?.code).toBe('P0001');
  });
});
