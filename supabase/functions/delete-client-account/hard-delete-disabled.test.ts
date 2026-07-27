import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('delete-client-account hard delete disabled', () => {
  it('returns hard delete disabled with HTTP 410', () => {
    expect(source).toContain('HARD_DELETE_DISABLED');
    expect(source).toContain('status: 410');
  });

  it('does not delete auth users or restore deleted data', () => {
    expect(source).not.toContain('auth.admin.deleteUser');
    expect(source).not.toContain('restoreAccount');
    expect(source).not.toContain('restoreProfile');
    expect(source).not.toContain('restoreOwnerAndAccount');
  });

  it('does not delete account or profile records', () => {
    expect(source).not.toMatch(
      /\.from\(["']accounts["']\)[\s\S]*?\.delete\(/,
    );
    expect(source).not.toMatch(
      /\.from\(["']profiles["']\)[\s\S]*?\.delete\(/,
    );
  });
});
