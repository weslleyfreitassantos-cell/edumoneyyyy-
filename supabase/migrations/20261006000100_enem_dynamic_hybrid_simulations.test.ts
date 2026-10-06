import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261006000100_enem_dynamic_hybrid_simulations.sql', import.meta.url),
  'utf8',
);

describe('ENEM dynamic hybrid simulations migration', () => {
  it('creates one immutable question snapshot per attempt and uses it for resume/submit', () => {
    expect(migration).toContain('create table if not exists public.learning_simulation_attempt_questions');
    expect(migration).toContain('unique (attempt_id, position)');
    expect(migration).toContain('unique (attempt_id, question_bank_id)');
    expect(migration).toContain('create or replace function public.start_enem_simulation_attempt_v2');
    expect(migration).toContain('create or replace function public.get_enem_simulation_attempt_v2');
    expect(migration).toContain('create or replace function public.submit_enem_simulation_attempt_v2');
    expect(migration).toContain('from public.learning_simulation_attempt_questions attempt_question');
  });

  it('gates availability on official provenance, five options, a valid answer and a validated statement crop', () => {
    expect(migration).toContain("question_bank.source_type = 'ENEM_OFFICIAL'");
    expect(migration).toMatch(/question_bank\.metadata->>'render_ready',\s*'false'\) = 'true'/);
    expect(migration).toMatch(/question_bank\.metadata->>'classification_state',\s*'REVIEW_REQUIRED'\) = 'VERIFIED'/);
    expect(migration).toContain('jsonb_array_length(question_bank.options) = 5');
    expect(migration).toContain("question_bank.metadata->>'official_answer_letter' in ('A', 'B', 'C', 'D', 'E')");
    expect(migration).toContain("question_row.official_answer_letter = answer_item->>'answer'");
    expect(migration).toContain("media_asset.quality_state = 'VALIDATED'");
    expect(migration).toContain("coalesce(media_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'");
    expect(migration).toContain('occurrence.language is not distinct from p_language');
    expect(migration).toContain('ENEM_POOL_INSUFFICIENT');
  });

  it('keeps the answer key out of the student payload and creates only the intended asset bucket', () => {
    expect(migration).toContain("'metadata', question_bank.metadata - 'official_answer_letter' - 'correct_answer'");
    expect(migration).toContain("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)");
    expect(migration).toContain("'enem-question-assets'");
    expect(migration).not.toContain('supabase db push');
  });

  it('does not edit deferred migration files', () => {
    expect(migration).not.toContain('20261004000100');
    expect(migration).not.toContain('20261004000200');
    expect(migration).not.toContain('20261004000300');
  });
});
