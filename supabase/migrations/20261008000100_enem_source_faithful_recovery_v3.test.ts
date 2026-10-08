import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261008000100_enem_source_faithful_recovery_v3.sql', import.meta.url),
  'utf8',
);

describe('ENEM source-faithful recovery migration', () => {
  it('persists a content revision and occurrence-level snapshot', () => {
    expect(migration).toContain('add column if not exists content_revision text');
    expect(migration).toContain("select 'source-faithful-v3'::text");
    expect(migration).toContain('add column if not exists occurrence_id uuid');
    expect(migration).toContain('ENEM_ATTEMPT_SNAPSHOT_OCCURRENCE_REQUIRED');
    expect(migration).toContain('ENEM_ATTEMPT_SNAPSHOT_OCCURRENCE_MISMATCH');
    expect(migration).toContain('learning_simulation_one_open_attempt_revision_idx');
  });

  it('fails closed on source, statement, text or visual option integrity', () => {
    expect(migration).toContain("question_bank.metadata->>'content_revision' = private.current_enem_content_revision()");
    expect(migration).toContain("question_bank.metadata->>'statement_integrity' = 'VERIFIED'");
    expect(migration).toContain("question_bank.metadata->>'text_options_integrity' = 'VERIFIED'");
    expect(migration).toContain("question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'");
    expect(migration).toContain("option_asset.metadata->>'asset_role' = 'OPTION_' || (option_asset.metadata->>'option_label')");
    expect(migration).toContain("question_bank.metadata->>'official_answer_letter' in ('A', 'B', 'C', 'D', 'E')");
  });

  it('resolves assets only through the snapshotted occurrence', () => {
    expect(migration).toContain("'occurrence_id', attempt_question.occurrence_id");
    expect(migration).toContain('where option_asset.occurrence_id = attempt_question.occurrence_id');
    expect(migration).toContain('where statement_asset.occurrence_id = attempt_question.occurrence_id');
    expect(migration).not.toContain('where occurrence.question_bank_id = question_bank.id');
  });
});
