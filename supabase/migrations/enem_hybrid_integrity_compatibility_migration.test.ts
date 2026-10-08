import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261007000900_enem_hybrid_integrity_compatibility.sql', import.meta.url),
  'utf8',
);

describe('ENEM hybrid integrity compatibility migration', () => {
  it('keeps the existing hybrid pool eligible without visual-only integrity fields', () => {
    expect(migration).toContain("question_bank.metadata->>'render_mode' = 'HYBRID'");
    expect(migration).toContain("question_bank.metadata->>'source_integrity' = 'VERIFIED'");
    const commonGates = migration.slice(0, migration.indexOf('and (p_language is null'));
    expect(commonGates).not.toContain('statement_integrity');
    expect(commonGates).not.toContain('options_integrity');
  });

  it('requires complete integrity and option assets for visual questions', () => {
    expect(migration).toContain("question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'");
    expect(migration).toContain("question_bank.metadata->>'statement_integrity' = 'VERIFIED'");
    expect(migration).toContain("question_bank.metadata->>'options_integrity' = 'VERIFIED'");
    expect(migration).toContain(') = 5');
  });
});
