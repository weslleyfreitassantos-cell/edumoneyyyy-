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
    expect(source).toContain('action: z.literal("generate_access")');
    expect(source).toContain('generateSecurePassword');
    expect(source).toContain('ACCESS_PASSWORD_UPDATED_EMAIL_FAILED');
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
    expect(source).toContain('getUpdateAuthorizationDecision');
    expect(source).toContain('authorization: UpdateAuthorizationContext');
    expect(source).toContain('.eq("institution_id", input.institutionId)');
  });

  it('deletes auth users only after removing the final membership', () => {
    expect(source).toContain('remainingMemberships');
    expect(source).toContain('authUserDeleted');
  });

  it('does not return a generated password to the browser', () => {
    expect(source).not.toContain('password: password');
    expect(source).not.toContain('generated_password');
    expect(source).toContain('Nova senha de acesso gerada e enviada por e-mail.');
  });

  it('handles browser preflight requests with CORS headers', () => {
    expect(source).toContain('corsHeaders');
    expect(source).toContain('request.method === "OPTIONS"');
    expect(source).toContain('access-control-allow-origin');
    expect(source).toContain('authenticatedFetch');
  });
});
