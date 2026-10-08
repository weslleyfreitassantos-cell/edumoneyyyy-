import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261008000800_enem_v5_runtime_semantic_parity.sql', import.meta.url),
  'utf8',
);

describe('ENEM v5 runtime semantic parity migration', () => {
  it('is forward-only and keeps the active v5 revision', () => {
    expect(migration).toContain("content_revision = 'structured-text-only-v5'");
    expect(migration).toContain("'20261008000800'");
    expect(migration).toContain("'structured-text-only-v5'");
    expect(migration).not.toMatch(/\b(drop table|delete from|truncate)\b/iu);
  });

  it('fails closed for context-dependent stems and records the rejection', () => {
    expect(migration).toContain('respectivamente');
    expect(migration).toContain('o aluno que');
    expect(migration).toContain("'v5-runtime-parity'");
    expect(migration).toContain("content_acceptance_status = 'REJECTED'");
    expect(migration).toContain('semantic_rejection_reasons');
  });
});
