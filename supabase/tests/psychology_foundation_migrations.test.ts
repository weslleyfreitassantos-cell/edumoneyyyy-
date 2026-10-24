import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const foundation = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261023000800_psychology_data_foundation.sql'),
  'utf8',
);
const workflows = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261023000900_psychology_secure_workflows.sql'),
  'utf8',
);
const psychologyService = readFileSync(
  resolve(process.cwd(), 'src/services/psychologyService.ts'),
  'utf8',
);

describe('psychology module migrations', () => {
  it('starts disabled and grants the browser only scoped reads and explicit RPCs', () => {
    expect(foundation).toContain('enabled boolean not null default false');
    expect(foundation).toMatch(/alter table public\.psychology_messages enable row level security/i);
    expect(foundation).toMatch(/revoke all on public\.psychology_module_settings[\s\S]*?from public, anon, authenticated/i);
    expect(foundation).toMatch(/grant select on public\.psychology_professionals[\s\S]*?to authenticated/i);
    expect(foundation).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on\s+[^;]*public\.psychology_[^;]*\s+to authenticated/i);
    expect(foundation).toMatch(/on delete restrict/i);
  });

  it('uses an immutable UTC timestamp range for the professional preparation buffer', () => {
    expect(foundation).toMatch(/psychology_appointments_no_professional_overlap[\s\S]*?tsrange\([\s\S]*?starts_at at time zone 'UTC'[\s\S]*?ends_at at time zone 'UTC'[\s\S]*?preparation_minutes \* interval '1 minute'/i);
    expect(foundation).not.toMatch(/tstzrange\(starts_at,\s*ends_at \+ preparation_minutes/i);
  });

  it('does not let clients probe professional eligibility for an arbitrary profile', () => {
    expect(foundation).toMatch(/function private\.psychology_professional_is_eligible\(target_institution_id uuid, target_profile_id uuid\)/i);
    expect(foundation).toMatch(/revoke all on function private\.psychology_professional_is_eligible\(uuid, uuid\) from public, anon, authenticated/i);
    expect(foundation).toMatch(/function private\.psychology_professional_has_student_access\([\s\S]*?target_student_id uuid\s*\)/i);
    expect(foundation).toMatch(/assignment\.professional_profile_id = auth\.uid\(\)/i);
    expect(foundation).toMatch(/function private\.psychology_student_is_assigned\(target_institution_id uuid, target_student_id uuid\)/i);
    expect(foundation).toMatch(/student\.profile_id = auth\.uid\(\)/i);
    expect(foundation).toMatch(/appointment\.professional_profile_id = auth\.uid\(\)[\s\S]*?psychology_professional_has_student_access/i);
  });

  it('serializes bookings, prevents overlapping schedules and creates one waiting session', () => {
    expect(foundation).toMatch(/exclude using gist \(student_id with =, tstzrange\(starts_at, ends_at, '\[\)'\) with &&\)/i);
    expect(foundation).toMatch(/psychology_appointments_no_professional_overlap/i);
    expect(foundation).toMatch(/unique \(created_by, idempotency_key\)/i);
    expect(foundation).toMatch(/appointment_id uuid not null unique references public\.psychology_appointments\(id\) on delete restrict/i);
    expect(workflows).toMatch(/function private\.psychology_create_session_for_appointment\(\)[\s\S]*?insert into public\.psychology_sessions \(appointment_id, status\)[\s\S]*?'WAITING'/i);
    expect(workflows).toMatch(/create trigger psychology_appointment_create_session[\s\S]*?after insert on public\.psychology_appointments[\s\S]*?execute function private\.psychology_create_session_for_appointment/i);
  });

  it('rejects missing or reused idempotency keys instead of reporting a different operation as successful', () => {
    expect(workflows).toMatch(/if client_idempotency_key is null then[\s\S]*?INVALID_IDEMPOTENCY_KEY/i);
    expect(workflows).toMatch(/if operation_key is null then[\s\S]*?INVALID_IDEMPOTENCY_KEY/i);
    expect(workflows).toMatch(/v_event\.action = 'CANCELLED'[\s\S]*?IDEMPOTENCY_KEY_REUSED/i);
    expect(workflows).toMatch(/v_event\.action = 'RESCHEDULED'[\s\S]*?v_event\.next_starts_at = new_starts_at[\s\S]*?IDEMPOTENCY_KEY_REUSED/i);
    expect(workflows).toMatch(/existing_body is distinct from btrim\(message_body\)[\s\S]*?IDEMPOTENCY_KEY_REUSED/i);
  });

  it('keeps chat, clinical notes and module activation behind server checks', () => {
    expect(workflows).toMatch(/function public\.psychology_set_module_enabled\([\s\S]*?private\.psychology_is_manager\(target_institution_id\)/i);
    expect(workflows).toMatch(/function public\.psychology_send_message\([\s\S]*?v_session\.status <> 'IN_PROGRESS'[\s\S]*?now\(\) > v_session\.ends_at/i);
    expect(workflows).toMatch(/function public\.psychology_save_note_draft\([\s\S]*?private\.psychology_can_access_note\(target_session_id\)/i);
    expect(workflows).toMatch(/function public\.psychology_finalize_note\([\s\S]*?v_note\.version <> expected_version/i);
    expect(workflows).toMatch(/function public\.psychology_add_note_addendum\([\s\S]*?'ADDENDUM'/i);
    expect(workflows).toMatch(/through_at - from_at > interval '90 days'/i);
    expect(workflows).toMatch(/grant execute on function public\.psychology_module_enabled\(uuid\),[\s\S]*?public\.psychology_set_module_enabled\(uuid, boolean\),[\s\S]*?to authenticated, service_role/i);
  });

  it('restricts clinical note and version reads to the assigned author and blocks consent while disabled', () => {
    expect(foundation).toMatch(/create policy psychology_notes_select[\s\S]*?author_profile_id = \(select auth\.uid\(\)\)[\s\S]*?psychology_can_access_note\(session_id\)/i);
    expect(foundation).toMatch(/create policy psychology_note_versions_select[\s\S]*?note\.author_profile_id = \(select auth\.uid\(\)\)[\s\S]*?psychology_can_access_note\(note\.session_id\)/i);
    expect(workflows).toMatch(/function public\.psychology_record_authorization\([\s\S]*?private\.psychology_module_is_enabled\(student_row\.institution_id\)/i);
    expect(workflows).toMatch(/student_membership\.role = 'STUDENT'::public\.user_role/i);
    expect(workflows).toMatch(/join public\.memberships student_membership[\s\S]*?student_membership\.role = 'STUDENT'::public\.user_role/i);
  });

  it('applies the same session authorization to message reads and Realtime notifications', () => {
    expect(foundation).toMatch(/create policy psychology_messages_select[\s\S]*?on public\.psychology_messages[\s\S]*?psychology_can_access_session\(session_id\)/i);
    expect(psychologyService).toMatch(/\.on\('postgres_changes',[\s\S]*?table: 'psychology_messages'[\s\S]*?filter: `session_id=eq\.\$\{sessionId\}`/i);
    expect(workflows).toMatch(/function public\.psychology_send_message\([\s\S]*?psychology_can_access_session\(target_session_id\)/i);
    expect(workflows).toMatch(/if not exists \(select 1 from pg_publication[\s\S]*?execute 'create publication supabase_realtime'/i);
    expect(workflows).toMatch(/execute 'alter publication supabase_realtime add table public\.psychology_messages'/i);
    expect(workflows).toMatch(/PSYCHOLOGY_MESSAGES_REALTIME_PUBLICATION_MISSING/i);
  });

  it('uses valid PL/pgSQL declaration blocks in every workflow function', () => {
    const bodies = [...workflows.matchAll(/create or replace function[\s\S]*?as \$\$([\s\S]*?)\$\$;/gi)];
    expect(bodies.length).toBeGreaterThan(20);
    for (const [index, match] of bodies.entries()) {
      const body = match[1];
      const declarationSection = body.split(/\bbegin\b/i, 1)[0];
      const declarations = declarationSection.match(/^\s*declare\b/gim) ?? [];
      expect(declarations.length, `function body ${index + 1}`).toBeLessThanOrEqual(1);
    }
  });
});
