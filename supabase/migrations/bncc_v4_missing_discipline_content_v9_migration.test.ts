import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261011000050_bncc_v4_missing_discipline_content_v9.sql', import.meta.url),
  'utf8',
);

describe('BNCC V4 missing discipline content V9 migration', () => {
  it('restores the administrative migration role only for the transaction and returns to postgres', () => {
    expect(migration).toMatch(/^begin;\s*reset role;/i);
    expect(migration).toMatch(/set role postgres;\s*commit;\s*$/i);
  });

  it('does not persist role grants or ownership changes', () => {
    expect(migration).not.toMatch(/\bgrant\s+supabase_admin\b/i);
    expect(migration).not.toMatch(/\balter\s+table\b[\s\S]*\bowner\s+to\b/i);
  });
});
