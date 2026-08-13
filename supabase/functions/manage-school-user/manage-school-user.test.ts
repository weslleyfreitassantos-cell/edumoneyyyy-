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

  it('permite reset de senha por gestor operacional somente para STUDENT', () => {
    expect(source).toContain('DIRECTOR_PASSWORD_ONLY');
    expect(source).toContain('TARGET_ROLE_NOT_ALLOWED');
    expect(source).toContain('TARGET_MEMBERSHIP_INACTIVE');
    expect(source).toContain('STUDENT_INACTIVE');
    expect(source).toContain('.eq("institution_id", input.institutionId)');
    expect(source).toMatch(/membership\.role\s*!==\s*"STUDENT"/);
  });

  it('deletes auth users only after removing the final membership', () => {
    expect(source).toContain('remainingMemberships');
    expect(source).toContain('authUserDeleted');
  });

  it('handles browser preflight requests with CORS headers', () => {
    expect(source).toContain('corsHeaders');
    expect(source).toContain('request.method === "OPTIONS"');
    expect(source).toContain('access-control-allow-origin');
    expect(source).toContain('authenticatedFetch');
  });
});
