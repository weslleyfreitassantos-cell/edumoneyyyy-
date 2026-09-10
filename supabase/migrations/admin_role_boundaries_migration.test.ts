import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('./20260910000200_admin_role_boundaries.sql', import.meta.url),
  'utf8',
);

describe('admin role boundaries migration', () => {
  it('keeps institutional announcements under operational roles', () => {
    expect(migration).toContain("array['DIRECTOR', 'SECRETARY']::public.user_role[]");
    expect(migration).not.toContain("array['ADMIN', 'DIRECTOR', 'SECRETARY']");
  });

  it('rebuilds every staff policy without changing audience policies', () => {
    expect(migration.match(/create policy institution_announcements_staff_/g)).toHaveLength(4);
    expect(migration).not.toContain('institution_announcements_student_select');
    expect(migration).not.toContain('institution_announcements_guardian_select');
  });
});
