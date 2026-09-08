import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('update-institution-status', () => {
  it('records who suspended the institution and with which scope', () => {
    expect(source).toContain('suspended_by_profile_id');
    expect(source).toContain('suspended_by_scope');
    expect(source).toContain('suspended_at');
    expect(source).toContain('"PLATFORM"');
    expect(source).toContain('"ACCOUNT"');
  });

  it('blocks account admins from reactivating platform suspensions', () => {
    expect(source).toContain(
      'INSTITUTION_SUSPENDED_BY_PLATFORM',
    );
    expect(source).toContain(
      'Esta instituicao foi suspensa pela plataforma.',
    );
    expect(source).toContain('!isSuperAdmin');
  });

  it('does not count only active institutions for usage', () => {
    expect(source).toContain('usedInstitutionCount');
    expect(source).toContain('.eq("account_id", account.id)');
    expect(source).not.toContain('.eq("active", true)');
  });
});
