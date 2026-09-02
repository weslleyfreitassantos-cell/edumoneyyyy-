import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('invite-school-user', () => {
  it('creates a normal Auth password server-side for new users', () => {
    expect(source).toContain('auth.admin.createUser');
    expect(source).toContain('password: generatedPassword');
    expect(source).toContain('email_confirm: true');
    expect(source).toContain('generateSecurePassword');
    expect(source).not.toContain('auth.admin.updateUserById');
    expect(source).not.toContain('inviteUserByEmail');
  });

  it('resolves the institution branding and official login URL server-side', () => {
    expect(source).toContain('login_display_name');
    expect(source).toContain('primary_color');
    expect(source).toContain('secondary_color');
    expect(source).toContain('buildInstitutionLoginUrl');
    expect(source).toContain('SchoolAccessConfigurationError');
  });

  it('does not persist or return a generated password', () => {
    expect(source).not.toContain('generated_password');
    expect(source).not.toContain('temporary_password');
    expect(source).toContain('generatedPassword ? { password: generatedPassword }');
    expect(source).toContain('ACCESS_CREATED_EMAIL_FAILED');
    expect(source).not.toContain('Gerar nova senha de acesso');
  });

  it('authorizes by account ownership or active membership role', () => {
    expect(source).toContain('owner_profile_id');
    expect(source).toContain('isAccountOwner');
    expect(source).toContain('activeMemberships');
    expect(source).toContain('directorMembership');
    expect(source).toContain('secretaryMembership');
  });

  it('allows an ADMIN to create a director only in the selected institution', () => {
    expect(source).toContain('["DIRECTOR", "TEACHER", "STUDENT", "GUARDIAN"]');
    expect(source).toContain('.eq("institution_id", input.institutionId)');
    expect(source).toContain('role: input.role');
  });

  it('rejects an email already registered instead of reusing the user', () => {
    expect(source).toContain('listUsers');
    expect(source).toContain('if (existingAuthUser || existingProfile)');
    expect(source).toContain('code: "EMAIL_ALREADY_REGISTERED"');
    expect(source).toContain('Este e-mail ja esta cadastrado.');
    expect(source).not.toContain('if (reusedExistingUser)');
  });

  it('has a bounded per-requester rate limit', () => {
    expect(source).toContain('assertInviteRateLimit');
    expect(source).toContain('INVITE_RATE_LIMIT_MAX_ATTEMPTS');
    expect(source).toContain('ACCESS_RATE_LIMITED');
  });

  it('does not block school access creation by institution quota', () => {
    expect(source).not.toContain('institution_limit');
    expect(source).not.toContain('remainingSlots');
  });

  it('maps known failures to public status codes', () => {
    expect(source).toContain('DATABASE_PERMISSION_DENIED');
    expect(source).toContain('ACCESS_CONFLICT');
    expect(source).toContain('INVALID_ACCESS_RELATION');
    expect(source).toContain('ACCESS_CREATED_EMAIL_FAILED');
    expect(source).toContain('requestId');
  });
});
