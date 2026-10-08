import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261007000800_enem_pool_language_filter.sql', import.meta.url),
  'utf8',
);

describe('ENEM pool language filter migration', () => {
  it('does not discard legacy NULL-language questions when no language is requested', () => {
    expect(migration).toContain("p_language is null or occurrence.language = p_language");
  });

  it('keeps the visual option completeness gate', () => {
    expect(migration).toContain("question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'");
    expect(migration).toContain(") = 5");
  });
});
