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

  it('builds redirectTo from APP_URL', () => {
    expect(source).toContain('redirectTo');
    expect(source).toContain('/auth/confirm');
  });

  it('requires SUPER_ADMIN authorization', () => {
    expect(source).toContain('SUPER_ADMIN_REQUIRED');
    expect(source).toContain('platform_role');
  });

  it('classifies Auth invitation failures without exposing provider secrets', () => {
    expect(source).toContain('classifyAuthInviteError');
    expect(source).toContain('failure.code');
    expect(source).toContain('failure.status');
    expect(source).toContain('diagnosticMessage');
    expect(source).toContain('providerCode');
    expect(source).not.toContain('console.error("Falha ao criar conta", error)');
  });
});
