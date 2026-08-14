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
  });

  it('authorizes by account ownership or active membership role', () => {
    expect(source).toContain('owner_profile_id');
    expect(source).toContain('isAccountOwner');
    expect(source).toContain('activeMemberships');
    expect(source).toContain('directorMembership');
    expect(source).toContain('secretaryMembership');
  });

  it('reuses existing users and avoids duplicated links', () => {
    expect(source).toContain('listUsers');
    expect(source).toContain('reusedExistingUser');
    expect(source).toContain('getOrCreateMembership');
    expect(source).toContain('getOrCreateGuardianship');
    expect(source).toContain('getOrCreateStudent');
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
