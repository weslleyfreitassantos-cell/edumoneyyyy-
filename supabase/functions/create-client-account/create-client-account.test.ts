import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('create-client-account', () => {
  it('uses the request origin when APP_URL is not configured', () => {
    expect(source).toContain('const resolvedUrl = appUrl || new URL(requestUrl).origin');
    expect(source).toContain('getAppUrl(requestUrl)');
  });

  it('rejects localhost APP_URL in production', () => {
    expect(source).toContain('LOCALHOST_APP_URL');
    expect(source).toContain('isLocalhostUrl');
    expect(source).toContain('localhost');
    expect(source).toContain('127\\.0\\.0\\.1');
  });

  it('builds the auth confirmation URL from APP_URL', () => {
    expect(source).toContain('`${getAppUrl(requestUrl)}/auth/confirm`');
    expect(source).not.toContain('/login');
    expect(source).not.toContain('/reset-password');
  });

  it('requires SUPER_ADMIN authorization', () => {
    expect(source).toContain('SUPER_ADMIN_REQUIRED');
    expect(source).toContain('platform_role');
  });

  it('invites the Auth identity with the institutional confirmation URL', () => {
    expect(source).toContain('auth.admin.inviteUserByEmail');
    expect(source).toContain('redirectTo: inviteRedirectUrl');
    expect(source).toContain('role: "ADMIN"');
    expect(source).toContain('invitationSent: true');
    expect(source).toContain('reusedExistingUser: false');
    expect(source).not.toContain('auth.admin.createUser');
    expect(source).not.toContain('sendResendEmail');
  });

  it('rolls back the invited identity when account creation fails', () => {
    expect(source).toContain('invitationError');
    expect(source).toContain('Nao foi possivel convidar o ADMIN.');
    expect(source).toContain('rollback.createdAuthUserId');
    expect(source).toContain('auth.admin.deleteUser');
    expect(source).toContain('INTERNAL_ERROR');
    expect(source).not.toContain('RESEND_PROVIDER_ERROR');
  });
});
