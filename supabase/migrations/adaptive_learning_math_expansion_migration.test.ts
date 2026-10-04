import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const historicalMigration = readFileSync(
  new URL('./20261004000100_adaptive_learning_content_pack_v4.sql', import.meta.url),
  'utf8',
);
const expansionMigration = readFileSync(
  new URL('./20261004000200_bncc_mathematics_expansion_v4.sql', import.meta.url),
  'utf8',
);

describe('adaptive mathematics expansion migration', () => {
  it('keeps the existing content-pack migration immutable', () => {
    expect(historicalMigration).toContain('V4_CONTENT_HASH=3d4b6baa4c55d69e4793d7c45bde4f9dd6eceba52afb64fa0760d681eba74b4a');
    expect(historicalMigration).not.toContain('v4-authored-mathematics-increase-probe-01');
    expect(historicalMigration).not.toContain('v4-authored-mathematics-table-probe-01');
  });

  it('imports the authored math slice through a new forward-only path', () => {
    expect(expansionMigration).toContain('V4_CONTENT_HASH=1d9e819e9953018fe1b785961691d48a7efb640bd4c602342431e0689bd2208f');
    expect(expansionMigration).toContain('v4-authored-mathematics-increase-probe-01');
    expect(expansionMigration).toContain('v4-authored-mathematics-table-probe-01');
    expect(expansionMigration).toContain('v4-authored-mathematics-successive-review-02');
    expect(expansionMigration).toContain('on conflict');
    expect(expansionMigration).not.toMatch(/drop table|truncate /i);
  });
});
