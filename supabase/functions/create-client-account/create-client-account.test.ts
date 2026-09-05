import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('create-client-account', () => {
  it('rejects missing APP_URL', () => {
    expect(source).toContain('MISSING_APP_URL');
  });

  it('rejects localhost APP_URL in production', () => {
    expect(source).toContain('LOCALHOST_APP_URL');
    expect(source).toContain('isLocalhostUrl');
    expect(source).toContain('localhost');
    expect(source).toContain('127\\.0\\.0\\.1');
  });

  it('builds the normal login URL from APP_URL', () => {
    expect(source).toContain('`${getAppUrl()}/login`');
    expect(source).not.toContain('/auth/confirm');
    expect(source).not.toContain('/reset-password');
  });

  it('requires SUPER_ADMIN authorization', () => {
    expect(source).toContain('SUPER_ADMIN_REQUIRED');
    expect(source).toContain('platform_role');
  });

  it('creates the Auth identity without making SMTP delivery mandatory', () => {
    expect(source).toContain('auth.admin.createUser');
    expect(source).toContain('password: temporaryPassword');
    expect(source).toContain('email_confirm: true');
    expect(source).toContain('generateSecurePassword');
    expect(source).not.toContain('generateLink');
    expect(source).not.toContain('inviteUserByEmail');
    expect(source).toContain('sendResendEmail');
    expect(source).toContain('invitationStatus: delivery.invitationStatus');
    expect(source).toContain('status: "PENDING"');
    expect(source).toContain('status: "SENT"');
    expect(source).not.toContain('send-school-email');
    expect(source).not.toContain('console.error("Falha no convite", generatedLink');
  });

  it('keeps provider failures out of the account rollback path', () => {
    expect(source).toContain('Acesso do administrador pendente');
    expect(source).toContain('return { invitationSent: false, invitationStatus: "PENDING" }');
    expect(source).toContain('RESEND_PROVIDER_ERROR');
    expect(source).not.toContain('console.error("Falha ao criar conta", error)');
  });
});
