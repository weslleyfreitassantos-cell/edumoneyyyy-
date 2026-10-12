import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261012000200_enem_english_multimodal_full_practice_v1.sql', import.meta.url),
  'utf8',
);

describe('English multimodal full practice migration', () => {
  it('uses the shared ready pool and validates the exact source and rendered assets', () => {
    expect(migration).toContain('private.enem_ready_questions(null, \'INGLES\', \'ENGLISH\')');
    expect(migration).toContain("ready.source_kind = 'STRUCTURED_PROVIDER'");
    expect(migration).toContain('structured.rights_status = \'VERIFIED\'');
    expect(migration).toContain('structured.provider_year between 2009 and 2025');
    expect(migration).toContain("nullif(btrim(structured.source_url), '') is not null");
    expect(migration).toContain("structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')");
    expect(migration).toContain('question_bank.metadata->>\'official_answer_letter\' = occurrence.official_answer');
    expect(migration).toContain('occurrence.canonical_fingerprint');
    expect(migration).toContain('structured.normalized_content_hash');
    expect(migration).toContain('occurrence.booklet');
    expect(migration).toContain('storage.objects');
    expect(migration).toContain('statement_asset.quality_state = \'VALIDATED\'');
    expect(migration).toContain('count(distinct option_asset.metadata->>\'option_label\')');
    expect(migration).toContain('source_identity');
    expect(migration).toContain('earlier.question_id = candidate.question_id');
  });

  it('uses the same deduplicated English pool for availability, start and snapshot validation', () => {
    expect(migration).toContain('private.enem_ready_english_practice_questions_v1()');
    expect(migration).toContain('least(counts.question_count, counts.pool_count)');
    expect(migration).toContain('count(distinct question_id)::integer into available_count');
    expect(migration).toContain('selected_occurrences := array_append(selected_occurrences, question_row.occurrence_id)');
    expect(migration).toContain('unnest(selected_questions, selected_occurrences, selected_structured_content)');
    expect(migration).toContain('ready.occurrence_id is not distinct from new.occurrence_id');
    expect(migration).toContain('ready.structured_content_id is not distinct from new.structured_content_id');
    expect(migration).toContain("attempt_enem_subject = 'INGLES'");
    expect(migration).toContain("'reduced_practice', counts.pool_count > 0 and counts.pool_count < counts.question_count");
  });

  it('keeps resume snapshots complete and pins the source reference to the selected occurrence', () => {
    expect(migration).toContain('count(distinct attempt_question.question_bank_id)::integer');
    expect(migration).toContain('(attempt_question.occurrence_id is not null)');
    expect(migration).toContain('occurrence.exam_url');
    expect(migration).toContain('occurrence.question_number');
    expect(migration).toContain('occurrence.booklet');
    expect(migration).toContain('occurrence.metadata->>\'booklet_color\'');
    expect(migration).not.toMatch(/update\s+public\.learning_simulation_attempt_questions/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.learning_simulation_attempts/i);
    expect(migration).not.toMatch(/truncate\s+/i);
  });

  it('does not broaden the RPC to anonymous users or change Spanish and area selection', () => {
    expect(migration).toContain('revoke all on function public.list_enem_simulation_templates_v2(uuid) from public, anon');
    expect(migration).toContain('revoke all on function public.start_enem_simulation_attempt_v3(uuid, uuid, uuid, text)');
    expect(migration).toContain('to authenticated');
    expect(migration).toContain('private.enem_ready_provider_text_questions(null, \'ESPANHOL\', \'SPANISH\')');
    expect(migration).toContain('private.enem_ready_provider_text_questions(template.area, null, \'ENGLISH\')');
    expect(migration).toContain('public.start_enem_simulation_attempt_v2(');
    expect(migration).not.toContain('disable row level security');
    expect(migration).not.toContain('migration repair');
  });
});
