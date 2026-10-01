import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930000400_adaptive_learning_simulation_autosave_v1.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning simulation autosave migration', () => {
  it('persists only scoped in-progress answers without exposing correctness', () => {
    expect(migration).toContain('save_learning_simulation_attempt_answers');
    expect(migration).toContain("attempt.status = 'IN_PROGRESS'");
    expect(migration).toContain('student.institution_id = attempt.institution_id');
    expect(migration).toContain('question.question_bank_id::text = item->>\'question_bank_id\'');
    expect(migration).toContain("jsonb_build_object('answer', item->'answer')");
    expect(migration).not.toContain('is_correct');
  });

  it('grants the RPC only to authenticated users', () => {
    expect(migration).toContain('revoke all on function public.save_learning_simulation_attempt_answers(uuid, jsonb) from public, anon');
    expect(migration).toContain('grant execute on function public.save_learning_simulation_attempt_answers(uuid, jsonb) to authenticated');
  });
});
