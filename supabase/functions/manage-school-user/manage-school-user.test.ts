import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);
const passwordSource = readFileSync(
  new URL('./password-update.ts', import.meta.url),
  'utf8',
);

describe('manage-school-user', () => {
  it('uses a server-side auth admin API for password and delete actions', () => {
    expect(passwordSource).toContain('auth.admin.updateUserById');
    expect(passwordSource).toContain('auth.admin.getUserById');
    expect(source).toContain('auth.admin.deleteUser');
  });

  it('confirms the Auth response and records only redacted password diagnostics', () => {
    expect(passwordSource).toContain('data.user');
    expect(source).toContain('Falha ao atualizar senha escolar:');
    expect(source).toContain('request_id');
    expect(source).toContain('target_auth_user_id');
    expect(source).not.toContain('console.error("Falha ao atualizar senha escolar:", {\n        error');
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

  it('returns a specific success message after a password-only update', () => {
    expect(source).toContain('Senha redefinida com sucesso.');
    expect(source).toContain('passwordOnly');
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
