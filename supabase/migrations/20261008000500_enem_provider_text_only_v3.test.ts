import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261008000500_enem_provider_text_only_v3.sql', import.meta.url),
  'utf8',
);

describe('ENEM provider text-only v3 migration', () => {
  it('creates a forward-only current revision without deleting the visual corpus', () => {
    expect(migration).toContain("select 'structured-text-only-v3'::text");
    expect(migration).toContain("structured.content_revision = 'structured-sources-v2'");
    expect(migration).toContain("'structured-text-only-v3',");
    expect(migration).not.toContain('delete from public.learning_enem_structured_content');
    expect(migration).not.toContain('drop table public.learning_enem_structured_content');
  });

  it('uses an exclusively provider-text pool for new attempts', () => {
    expect(migration).toContain('create or replace function private.enem_ready_provider_text_questions');
    expect(migration).toContain("question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'");
    expect(migration).toContain("structured.source_kind = 'STRUCTURED_PROVIDER'");
    expect(migration).toContain("structured.occurrence_id is null");
    expect(migration).toContain("structured.render_mode = 'STRUCTURED_TEXT'");
    expect(migration).toContain('from private.enem_ready_provider_text_questions');
    expect(migration).not.toContain('union all');
  });

  it('requires a structured-only snapshot for the current revision', () => {
    expect(migration).toContain("if attempt_revision = private.current_enem_content_revision() then");
    expect(migration).toContain("new.occurrence_id is not null or new.structured_content_id is null");
    expect(migration).toContain("raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED'");
    expect(migration).toContain("raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT'");
  });

  it('keeps language availability honest instead of filling with visual questions', () => {
    expect(migration).toContain("structured.language = 'ENGLISH'");
    expect(migration).toContain("structured.language = 'SPANISH'");
    expect(migration).toContain("then '[\"ENGLISH\"]'::jsonb");
    expect(migration).toContain("then '[\"SPANISH\"]'::jsonb");
    expect(migration).toContain("raise exception 'ENEM_LANGUAGE_PROVIDER_TEXT_POOL_INSUFFICIENT'");
  });
});
