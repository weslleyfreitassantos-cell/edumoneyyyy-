import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const preV4 = readFileSync(
  new URL('./20261010000350_bncc_high_school_publication_gate_v5.sql', import.meta.url),
  'utf8',
);
const postV4 = readFileSync(
  new URL('./20261010000500_bncc_high_school_safe_promotion_v5.sql', import.meta.url),
  'utf8',
);

describe('BNCC high-school V5 publication gate', () => {
  it('installs the fail-closed guard before the V4 seed', () => {
    expect(preV4).toContain("publication_status in ('STAGING', 'QA_ONLY', 'PUBLISHED')");
    expect(preV4).toContain('enforce_bncc_high_school_v4_publication_gate');
    expect(preV4).toContain('guided_session_v4_publication_gate');
    expect(preV4).toContain("skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'");
    expect(preV4).toContain("new.bncc_alignment_status := 'CANDIDATE'");
    expect(preV4).toContain("new.content_readiness := 'CONTENT_READY'");
    expect(preV4).toContain('new.mastery_targetable := false');
    expect(preV4).toContain('LEARNING_V4_CONTENT_NOT_PUBLISHED');
  });

  it('keeps the four pending V4 codes out of discovery and protected start', () => {
    expect(postV4).toContain("skill.publication_status = 'PUBLISHED'");
    expect(postV4).toContain("skill.content_readiness = 'ADAPTIVE_READY'");
    expect(postV4).toContain("skill.bncc_alignment_status = 'MAPPED'");
    expect(postV4).toContain('assert_bncc_guided_session_scope');
    expect(postV4).not.toMatch(/drop table/i);
    expect(postV4).not.toMatch(/truncate\s/i);
  });

  it('uses a forward-only migration sequence around the immutable V4 seed', () => {
    expect('20261010000350'.localeCompare('20261010000400')).toBeLessThan(0);
    expect('20261010000500'.localeCompare('20261010000400')).toBeGreaterThan(0);
    expect(preV4).not.toContain('20261010000400_bncc_high_school_first_year_real_learning_v4');
    expect(postV4).not.toContain('20261010000400_bncc_high_school_first_year_real_learning_v4');
  });
});
