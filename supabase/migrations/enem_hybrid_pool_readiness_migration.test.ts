import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20261007000700_enem_hybrid_pool_readiness.sql', import.meta.url), 'utf8');

describe('ENEM hybrid pool readiness migration', () => {
  it('keeps hybrid questions eligible without requiring option crops', () => {
    expect(migration).toContain("question_bank.metadata->>'render_mode' in ('HYBRID', 'VISUAL_OPTIONS')");
    expect(migration).toContain("question_bank.metadata->>'render_mode' = 'HYBRID'");
  });

  it('requires all five option assets only for visual questions', () => {
    expect(migration).toContain("question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'");
    expect(migration).toContain("count(distinct option_asset.metadata->>'option_label')");
    expect(migration).toContain(") = 5");
  });
});
