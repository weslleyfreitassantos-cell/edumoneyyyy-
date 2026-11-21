import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261121044714_enem_english_verified_text_first_v1.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('ENEM English verified text-first questions', () => {
  it('approves only the official 2024 and 2025 CD1 questions verified by the INEP parser', () => {
    expect(migration).toContain('insert into public.learning_enem_structured_content');
    expect(migration).toContain('0893d147-1e92-4e04-a30d-33297280aba5');
    expect(migration).toContain('19cf509d-26a4-4cbc-b461-08d6abeb7d71');
    expect(migration).toContain('b0adc1dc79a002aba36f725f1ef792cf53e47ff75ee012638ef34a4e6fbb18f5');
    expect(migration).toContain('a0f19f878d4ef3ba94c3e0f5ef9e57c13fb046d4bb362f72651898b473ddb7c8');
    expect(migration).toContain("'media_status', 'NOT_DETECTED'");
    expect(migration).toContain("'source_integrity', 'VERIFIED'");
    expect(migration).toContain("'statement_integrity', 'VERIFIED'");
    expect(migration).toContain("'text_options_integrity', 'VERIFIED'");
    expect(migration).toContain("'options_integrity', 'VERIFIED'");
    expect(migration).toContain("'OFFICIAL_OCCURRENCE',");
    expect(migration).not.toMatch(/update\s+public\.learning_(question_bank|simulation_attempts|simulation_attempt_questions)/i);
  });

  it('selects only already structured English questions and excludes visual-only rows', () => {
    const poolFunction = migration.slice(
      migration.indexOf('create or replace function private.enem_ready_english_practice_questions_v1'),
      migration.indexOf('create or replace function private.validate_enem_english_text_snapshot_v1'),
    );

    expect(poolFunction).toContain("private.enem_ready_questions(null, 'INGLES', 'ENGLISH')");
    expect(poolFunction).toContain('ready.structured_content_id is not null');
    expect(poolFunction).toContain("ready.source_kind = 'OFFICIAL_OCCURRENCE'");
    expect(poolFunction).toContain("structured_row.render_mode = 'STRUCTURED_TEXT'");
    expect(poolFunction).toContain('structured_row.alternatives_json = (');
    expect(poolFunction).toContain('structured_row.normalized_content_hash = encode(');
    expect(poolFunction).not.toContain("ready.structured_content_id is null");
  });

  it('validates text snapshot source, revision, A-E content and media evidence', () => {
    expect(migration).toContain('create or replace function private.validate_enem_english_text_snapshot_v1()');
    expect(migration).toContain("structured.source_kind = 'OFFICIAL_OCCURRENCE'");
    expect(migration).toContain('structured.occurrence_id = new.occurrence_id');
    expect(migration).toContain('structured.content_revision = attempt_revision');
    expect(migration).toContain("structured.render_mode = 'STRUCTURED_TEXT'");
    expect(migration).toContain('structured.alternatives_json = (');
    expect(migration).toContain('structured.normalized_content_hash = encode(');
    expect(migration).toContain("structured.source_metadata->>'media_status' = 'NOT_DETECTED'");
    expect(migration).toContain("raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH'");
    expect(migration).toContain('create trigger validate_enem_english_text_snapshot_v1');
  });
});
