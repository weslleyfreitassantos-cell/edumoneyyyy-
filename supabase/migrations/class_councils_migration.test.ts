import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260912000100_class_councils.sql', import.meta.url),
  'utf8',
);

describe('class councils migration', () => {
  it('creates the three MVP tables and preserves the active-context invariant', () => {
    expect(migration).toContain('create table public.class_councils');
    expect(migration).toContain('create table public.class_council_participants');
    expect(migration).toContain('create table public.class_council_student_notes');
    expect(migration).toMatch(/create unique index class_councils_active_context_unique_idx[\s\S]*where status <> 'CANCELED'/i);
    expect(migration).toContain('unique (council_id, profile_id)');
    expect(migration).toContain('unique (council_id, student_id)');
  });

  it('defines the protected lifecycle and transactional snapshot RPCs', () => {
    expect(migration).toContain('public.create_class_council');
    expect(migration).toContain('public.open_class_council');
    expect(migration).toContain('public.complete_class_council');
    expect(migration).toContain('public.reopen_class_council');
    expect(migration).toContain('public.cancel_class_council');
    expect(migration).toContain('private.class_council_director_can_manage');
    expect(migration).toContain('CLASS_COUNCIL_SNAPSHOT_INCOMPLETE');
    expect(migration).toContain('CLASS_COUNCIL_PARTICIPANTS_REQUIRED');
    expect(migration).toContain('CLASS_COUNCIL_REOPEN_REASON_REQUIRED');
    expect(migration).toContain('CLASS_COUNCIL_LIFECYCLE_RPC_REQUIRED');
    expect(migration).toContain('teacher_contributions');
  });

  it('grants access only to authenticated RPC callers and applies role-scoped RLS', () => {
    expect(migration).toMatch(/alter table public\.class_councils enable row level security/i);
    expect(migration).toMatch(/private\.class_council_staff_can_manage\(institution_id\)/i);
    expect(migration).toMatch(/private\.is_teacher_for_class_council\(id, institution_id\)/i);
    expect(migration).toMatch(/grant execute on function private\.class_council_director_can_manage\(uuid\)[\s\S]*to authenticated, service_role/i);
    expect(migration).toMatch(/grant execute on function public\.open_class_council\(uuid, jsonb\) to authenticated, service_role/i);
    expect(migration).toMatch(/revoke all on function public\.open_class_council\(uuid, jsonb\) from public, anon, authenticated/i);
  });
});
