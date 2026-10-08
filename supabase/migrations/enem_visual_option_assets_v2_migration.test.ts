import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20261007000500_enem_visual_option_assets_v2.sql', import.meta.url), 'utf8');

describe('ENEM visual option assets migration', () => {
  it('requires a validated statement and one validated visual asset for each A-E label', () => {
    expect(migration).toContain("question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'");
    expect(migration).toContain("count(distinct option_asset.metadata->>'option_label')");
    expect(migration).toContain("'OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E'");
    expect(migration).toContain("jsonb_array_elements(question_bank.options) with ordinality");
  });

  it('does not expose the official answer in the attempt payload', () => {
    expect(migration).toContain("question_bank.metadata - 'official_answer_letter' - 'correct_answer'");
    expect(migration).toContain("'label', chr(64 + option_item.ordinality::integer)");
    expect(migration).toContain("'assets', coalesce");
  });
});
