import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103000300_psychology_secretary_management_access.sql', import.meta.url),
  'utf8',
);

describe('psychology secretary management access migration', () => {
  it('keeps manager access authenticated and scoped to an active institution membership', () => {
    expect(migration).toContain('private.is_current_profile_active()');
    expect(migration).toContain('membership.profile_id = auth.uid()');
    expect(migration).toContain('membership.institution_id = target_institution_id');
    expect(migration).toContain('membership.active is true');
    expect(migration).toContain("'DIRECTOR'::public.user_role");
    expect(migration).toContain("'SECRETARY'::public.user_role");
  });

  it('preserves the existing platform and institution-management helper boundary', () => {
    expect(migration).toContain('public.can_manage_institution_operations(target_institution_id)');
    expect(migration).toContain('security definer');
    expect(migration).toContain('revoke all on function private.psychology_is_manager(uuid)');
    expect(migration).toContain('grant execute on function private.psychology_is_manager(uuid) to authenticated, service_role');
  });
});
