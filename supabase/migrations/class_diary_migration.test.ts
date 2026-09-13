import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260912000200_class_diary.sql',
  ),
  'utf8',
);

describe('class diary migration', () => {
  it('adds optional diary fields to the existing attendance session', () => {
    expect(migration).toContain(
      'add column if not exists class_activity text null',
    );
    expect(migration).toContain(
      'add column if not exists homework text null',
    );
    expect(migration).not.toMatch(/create table[^;]+class_diary_entries/i);
    expect(migration).not.toMatch(/create table[^;]+class_sessions/i);
    expect(migration).not.toMatch(/drop constraint[^;]+attendance_sessions_slot_unique/i);
  });

  it('exposes one transactional teacher save operation with the old lifecycle', () => {
    expect(migration).toContain(
      'create or replace function public.save_attendance_class_diary(',
    );
    expect(migration).toContain("p_status not in ('DRAFT', 'OPEN', 'CLOSED')");
    expect(migration).toContain(
      "status = p_status",
    );
    expect(migration).toContain(
      'on conflict (attendance_session_id, student_id)',
    );
  });

  it('keeps the database closed-session protection explicit', () => {
    expect(migration).toContain(
      'attendance_sessions_prevent_closed_teacher_mutation',
    );
    expect(migration).toContain(
      'attendance_records_prevent_closed_teacher_mutation',
    );
    expect(migration).toContain("ATTENDANCE_SESSION_CLOSED");
    expect(migration).not.toMatch(/disable row level security/i);
  });

  it('keeps institutional roles read-only and teachers scoped to open sessions', () => {
    expect(migration).toContain(
      'create or replace function private.can_write_attendance_session(',
    );
    expect(migration).toContain(
      'alter policy attendance_records_insert_policy',
    );
    expect(migration).toContain(
      'before insert or update or delete on public.attendance_records',
    );
    expect(migration).toContain(
      'before update or delete on public.attendance_sessions',
    );
  });
});
