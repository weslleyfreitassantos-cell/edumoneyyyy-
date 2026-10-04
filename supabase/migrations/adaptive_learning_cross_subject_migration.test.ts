import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const historicalMigration = readFileSync(
  new URL('./20261004000100_adaptive_learning_content_pack_v4.sql', import.meta.url),
  'utf8',
);
const mathematicsMigration = readFileSync(
  new URL('./20261004000200_bncc_mathematics_expansion_v4.sql', import.meta.url),
  'utf8',
);
const crossSubjectMigration = readFileSync(
  new URL('./20261004000300_bncc_cross_subject_content_v4.sql', import.meta.url),
  'utf8',
);

describe('adaptive cross-subject content migration', () => {
  it('keeps earlier migrations immutable', () => {
    expect(historicalMigration).toContain('V4_CONTENT_HASH=3d4b6baa4c55d69e4793d7c45bde4f9dd6eceba52afb64fa0760d681eba74b4a');
    expect(mathematicsMigration).toContain('V4_CONTENT_HASH=1d9e819e9953018fe1b785961691d48a7efb640bd4c602342431e0689bd2208f');
    expect(crossSubjectMigration).toContain('v4-authored-art-art_compare_compositions-probe-01');
  });

  it('imports six subject slices through an idempotent forward-only path', () => {
    expect(crossSubjectMigration).toContain('V4_CONTENT_HASH=e8d5df5ef948e699da9cef352a159e1a15a0dbfc890893c2c4945652fcca5556');
    for (const id of [
      'v4-authored-art-art_compare_compositions-probe-01',
      'v4-authored-biology-biology_cell_function-probe-01',
      'v4-authored-chemistry-chemistry_stoichiometry-probe-01',
      'v4-authored-computing-computing_read_table_data-probe-01',
      'v4-authored-physical_education-pe_analyze_movement-probe-01',
      'v4-authored-religious_education-religious_interpret_symbols-probe-01',
    ]) {
      expect(crossSubjectMigration).toContain(id);
    }
    expect(crossSubjectMigration).toContain('on conflict');
    expect(crossSubjectMigration).not.toMatch(/drop table|truncate /i);
  });
});
