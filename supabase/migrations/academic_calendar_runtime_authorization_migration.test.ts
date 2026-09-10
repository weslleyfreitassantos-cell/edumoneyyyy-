import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260909001200_academic_calendar_runtime_authorization.sql',
  ),
  'utf8',
);

describe('academic calendar runtime authorization migration', () => {
  it('grants authenticated execution to every audience helper', () => {
    expect(migration).toContain(
      'grant execute on function private.is_active_student_of_calendar_class(uuid, uuid)',
    );
    expect(migration).toContain(
      'grant execute on function private.is_active_guardian_of_calendar_class(uuid, uuid)',
    );
    expect(migration).toContain(
      'grant execute on function private.is_active_teacher_of_calendar_class(uuid, uuid)',
    );
    expect(migration).toContain(
      'to authenticated, service_role;',
    );
  });

  it('keeps the teacher policy institution check qualified', () => {
    expect(migration).toContain(
      'membership.institution_id = academic_calendar_events.institution_id',
    );
    expect(migration).not.toContain(
      'membership.institution_id = membership.institution_id',
    );
  });
});
