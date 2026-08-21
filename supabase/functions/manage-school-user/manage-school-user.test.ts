import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('manage-school-user', () => {
  it('uses a server-side auth admin API for manual password and delete actions', () => {
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
    expect(source).toContain('getUpdateAuthorizationDecision');
    expect(source).toContain('authorization: UpdateAuthorizationContext');
    expect(source).toContain('.eq("institution_id", input.institutionId)');
  });

  it('autoriza DELETE de DIRECTOR somente com membership ativo da instituicao alvo', () => {
    expect(source).toContain('allowDirectorDelete: input.action === "delete"');
    expect(source).toContain('const isDirector =');
    expect(source).toContain('TARGET_OUTSIDE_INSTITUTION');
    expect(source).toContain('.eq("institution_id", input.institutionId)');
  });

  it('protege historico academico e limita vinculos de guardianship ao tenant', () => {
    expect(source).toContain('USER_HAS_RELATED_RECORDS');
    expect(source).toContain('.in("student_id", ownStudentIds)');
    expect(source).toContain('.from("student_term_results")');
    expect(source).toContain('.eq("institution_id", input.institutionId)');
    expect(source).toContain('.eq("id", membership.id)');
  });

  it('deletes auth users only after removing the final membership', () => {
    expect(source).toContain('remainingMemberships');
    expect(source).toContain('authUserDeleted');
  });

  it('does not expose a random password generation action', () => {
    expect(source).not.toContain('generate_access');
    expect(source).not.toContain('GERAR NOVA SENHA');
    expect(source).not.toContain('generateSecurePassword');
    expect(source).not.toContain('ACCESS_PASSWORD_UPDATED_EMAIL_FAILED');
    expect(source).toContain('password: input.password');
  });

  it('handles browser preflight requests with CORS headers', () => {
    expect(source).toContain('corsHeaders');
    expect(source).toContain('request.method === "OPTIONS"');
    expect(source).toContain('access-control-allow-origin');
    expect(source).toContain('authenticatedFetch');
  });
});
