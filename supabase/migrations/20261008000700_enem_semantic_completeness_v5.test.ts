import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261008000700_enem_semantic_completeness_v5.sql', import.meta.url),
  'utf8',
);

describe('ENEM semantic completeness v5 migration', () => {
  it('is forward-only and keeps v4 history while promoting v5 as current', () => {
    expect(migration).toContain("structured.content_revision = 'structured-text-only-v4'");
    expect(migration).toContain("'structured-text-only-v5'");
    expect(migration).toContain("select 'structured-text-only-v5'::text");
    expect(migration).not.toMatch(/\b(drop table|delete from|truncate)\b/iu);
  });

  it('persists semantic rejection reasons and fails closed on the known incomplete canaries', () => {
    expect(migration).toContain('semantic_rejection_reasons_v5');
    expect(migration).toContain('MISSING_NUMERIC_DATA');
    expect(migration).toContain('UNRESOLVED_REFERENCE');
    expect(migration).toContain('content_acceptance_status');
    expect(migration).toContain('private.enem_provider_semantic_complete_v5');
  });

  it('keeps the ready pool structured-text-only with five alternatives and no media fallback', () => {
    expect(migration).toContain("structured.render_mode = 'STRUCTURED_TEXT'");
    expect(migration).toContain('jsonb_array_length(structured.alternatives_json) = 5');
    expect(migration).toContain('not structured.required_media_present');
    expect(migration).toContain('structured.provider_correct_alternative in (\'A\', \'B\', \'C\', \'D\', \'E\')');
  });
});
