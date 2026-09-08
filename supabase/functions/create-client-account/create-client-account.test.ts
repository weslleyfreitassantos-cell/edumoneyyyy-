import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('create-client-account', () => {
  it('uses the request origin when APP_URL is not configured', () => {
    expect(source).toContain('const resolvedUrl = appUrl || new URL(requestUrl).origin');
    expect(source).toContain('getAppUrl(request.url)');
  });

  it('rejects localhost APP_URL in production', () => {
    expect(source).toContain('LOCALHOST_APP_URL');
    expect(source).toContain('isLocalhostUrl');
    expect(source).toContain('localhost');
    expect(source).toContain('127\\.0\\.0\\.1');
  });

  it('builds the administrator login URL from APP_URL', () => {
    expect(source).toContain('`${getAppUrl(request.url)}/login`');
    expect(source).toContain('buildClientAdminAccessEmail');
    expect(source).not.toContain('/auth/confirm');
    expect(source).not.toContain('/reset-password');
  });

  it('requires SUPER_ADMIN authorization', () => {
    expect(source).toContain('SUPER_ADMIN_REQUIRED');
    expect(source).toContain('platform_role');
  });

  it('creates only the ADMIN identity and sends the access credentials email', () => {
    expect(source).toContain('auth.admin.createUser');
    expect(source).toContain('password: temporaryPassword');
    expect(source).toContain('email_confirm: true');
    expect(source).toContain('generateSecurePassword');
    expect(source).toContain('sendResendEmail');
    expect(source).toContain('client_admin_invitations');
    expect(source).toContain('role: "ADMIN"');
    expect(source).toContain('invitationSent: true');
    expect(source).toContain('invitationStatus: "SENT"');
    expect(source).toContain('reusedExistingUser: false');
    expect(source).not.toContain('role: "SECRETARY"');
    expect(source).not.toContain('auth.admin.inviteUserByEmail');
  });

  it('rolls back the invited identity when account creation fails', () => {
    expect(source).toContain('userError');
    expect(source).toContain('Nao foi possivel criar o ADMIN.');
    expect(source).toContain('rollback.createdAuthUserId');
    expect(source).toContain('auth.admin.deleteUser');
    expect(source).toContain('INTERNAL_ERROR');
    expect(source).toContain('RESEND_PROVIDER_ERROR');
  });
});
