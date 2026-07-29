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
});
