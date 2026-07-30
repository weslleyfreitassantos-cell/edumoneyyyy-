import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('manage-school-user', () => {
  it('uses a server-side auth admin API for password and delete actions', () => {
    expect(source).toContain('auth.admin.updateUserById');
    expect(source).toContain('auth.admin.deleteUser');
  });

  it('requires admin ownership or SUPER_ADMIN before changing users', () => {
    expect(source).toContain('SUPER_ADMIN');
    expect(source).toContain('isAccountOwner');
    expect(source).toContain('ADMIN_REQUIRED');
  });

  it('protects self, account owners and SUPER_ADMIN users', () => {
    expect(source).toContain('SELF_MANAGEMENT_BLOCKED');
    expect(source).toContain('ACCOUNT_OWNER_PROTECTED');
    expect(source).toContain('SUPER_ADMIN_PROTECTED');
  });

  it('deletes auth users only after removing the final membership', () => {
    expect(source).toContain('remainingMemberships');
    expect(source).toContain('authUserDeleted');
  });
});
