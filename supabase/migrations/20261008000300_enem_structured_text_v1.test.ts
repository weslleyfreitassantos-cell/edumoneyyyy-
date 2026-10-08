import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20261008000300_enem_structured_text_v1.sql', import.meta.url), 'utf8');

describe('ENEM structured text migration', () => {
  it('creates an auditable provider representation with a new revision', () => {
    expect(migration).toContain('create table if not exists public.learning_enem_structured_content');
    expect(migration).toContain("select 'structured-text-v1'::text");
    expect(migration).toContain('provider_question_key');
    expect(migration).toContain('normalized_content_hash');
    expect(migration).toContain('source_mapping_verified');
    expect(migration).toContain('answer_verified');
  });

  it('makes structured content eligible without requiring statement screenshots', () => {
    expect(migration).toContain('left join public.learning_enem_structured_content structured');
    expect(migration).toContain('structured.verification_status = \'VERIFIED\'');
    expect(migration).toContain('and (not structured.required_media_present or structured.required_media_validated)');
    expect(migration).toContain("question_bank.metadata->>'content_revision' = 'source-faithful-v3'");
    expect(migration).toContain('legacy_statement_asset');
  });

  it('returns semantic content and suppresses legacy statement assets for the new revision', () => {
    expect(migration).toContain("'structured_content'");
    expect(migration).toContain("case when structured.id is null then null else jsonb_build_object");
    expect(migration).toContain("case when structured.id is not null then '[]'::jsonb");
    expect(migration).toContain('structured_row.content_revision = attempt_row.content_revision');
  });
});
