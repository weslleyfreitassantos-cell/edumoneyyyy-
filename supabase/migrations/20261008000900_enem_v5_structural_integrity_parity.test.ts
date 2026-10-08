import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261008000900_enem_v5_structural_integrity_parity.sql', import.meta.url),
  'utf8',
);

describe('ENEM v5 structural integrity parity migration', () => {
  it('is forward-only and scoped to v5 accepted rows', () => {
    expect(migration).toContain("content_revision = 'structured-text-only-v5'");
    expect(migration).toContain("content_acceptance_status = 'ACCEPTED'");
    expect(migration).toContain("'CONTROL_CHARACTERS'");
    expect(migration).toContain('commit;');
    expect(migration).not.toMatch(/\b(drop table|delete from|truncate)\b/iu);
  });

  it('reclassifies option control-character rows as review required', () => {
    expect(migration).toContain("structured_content_integrity = 'REVIEW_REQUIRED'");
    expect(migration).toContain("content_acceptance_status = 'REJECTED'");
    expect(migration).toContain("option_item->>'text' ~ '[[:cntrl:]]'");
  });
});
