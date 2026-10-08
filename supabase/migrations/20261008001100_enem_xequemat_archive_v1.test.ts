import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '20261008001100_enem_xequemat_archive_v1.sql'), 'utf8');

describe('ENEM Xequemat archive v1 migration', () => {
  it('stores immutable source identity and ordered media blocks', () => {
    expect(migration).toContain('source_question_number integer');
    expect(migration).toContain('source_application text');
    expect(migration).toContain('content_blocks_json jsonb');
    expect(migration).toContain("source_provider = 'xequemat'");
    expect(migration).toContain("rights_status = 'VERIFIED'");
    expect(migration).toContain('source_reference_snapshot jsonb');
    expect(migration).toContain("'source_reference', attempt_question.source_reference_snapshot");
    expect(migration).toContain('create or replace function public.get_enem_simulation_attempt_v2');
  });

  it('does not make incomplete or unlicensed records ready', () => {
    expect(migration).toContain('structured.statement_complete');
    expect(migration).toContain('structured.five_alternatives_complete');
    expect(migration).toContain('structured.rights_status = \'VERIFIED\'');
    expect(migration).toContain('jsonb_array_length(structured.content_blocks_json) > 0');
    expect(migration).toContain('(not structured.required_media_present or structured.required_media_validated)');
  });

  it('advances the active revision without deleting previous rows', () => {
    expect(migration).toContain("select 'xequemat-archive-v1'::text");
    expect(migration).not.toMatch(/delete\s+from\s+public\.learning_enem_structured_content/iu);
    expect(migration).not.toMatch(/drop\s+table\s+public\.learning_enem_structured_content/iu);
  });
});
