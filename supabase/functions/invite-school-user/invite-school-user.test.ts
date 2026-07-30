import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('invite-school-user', () => {
  it('rejects missing APP_URL', () => {
    expect(source).toContain('MISSING_APP_URL');
  });

  it('rejects localhost APP_URL in production', () => {
    expect(source).toContain('LOCALHOST_APP_URL');
    expect(source).toContain('isLocalhostUrl');
    expect(source).toContain('localhost');
    expect(source).toContain('127\\.0\\.0\\.1');
  });

  it('builds redirectTo from APP_URL + /auth/confirm', () => {
    expect(source).toContain('redirectTo');
    expect(source).toContain('/auth/confirm');
  });

  it('authorizes by account ownership or active membership role', () => {
    expect(source).toContain('owner_profile_id');
    expect(source).toContain('isAccountOwner');
    expect(source).toContain('activeMemberships');
    expect(source).toContain('directorMembership');
    expect(source).toContain('secretaryMembership');
  });

  it('does not block school invites by institution quota', () => {
    expect(source).not.toContain('institution_limit');
    expect(source).not.toContain('remainingSlots');
  });

  it('maps known failures to public status codes', () => {
    expect(source).toContain('DATABASE_PERMISSION_DENIED');
    expect(source).toContain('INVITE_CONFLICT');
    expect(source).toContain('INVALID_INVITE_RELATION');
    expect(source).toContain('INVITE_EMAIL_DELIVERY_FAILED');
    expect(source).toContain('requestId');
  });
});
