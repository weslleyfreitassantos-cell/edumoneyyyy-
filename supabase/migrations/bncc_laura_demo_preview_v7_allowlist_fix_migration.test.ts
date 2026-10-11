import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010000800_bncc_laura_demo_preview_v7_allowlist_fix.sql', import.meta.url),
  'utf8',
);

describe('Laura BNCC demonstration allowlist fix', () => {
  it('normalizes the private demo membership check without publishing content', () => {
    expect(migration).toContain('bncc_demo_preview_allowed');
    expect(migration).toContain("upper(enrollment.status::text) = ''ACTIVE''");
    expect(migration).not.toMatch(/update\s+public\.learning_curriculum_skills/i);
    expect(migration).not.toMatch(/publication_status\s*=\s*'PUBLISHED'/i);
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/truncate\s/i);
  });
});
