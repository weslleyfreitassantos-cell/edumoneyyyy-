import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930001000_adaptive_learning_guided_journey_v2.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning guided journey v2 migration', () => {
  it('adds the append-only journey event and question-set contracts', () => {
    expect(migration).toContain('learning_guided_session_events');
    expect(migration).toContain('learning_question_sets');
    expect(migration).toContain('learning_question_set_items');
    expect(migration).toContain("scope in ('GLOBAL', 'INSTITUTION', 'TEACHER')");
  });

  it('keeps future steps server planned and idempotent', () => {
    expect(migration).toContain('start_guided_learning_session_v2');
    expect(migration).toContain('advance_guided_learning_session_v2');
    expect(migration).toContain('submit_guided_learning_step_v2');
    expect(migration).toContain('p_idempotency_key');
    expect(migration).toContain('LEARNING_GUIDED_QUESTION_SET_EMPTY');
  });

  it('does not return answer keys before submission', () => {
    const readStepFunction = migration.slice(migration.indexOf('create or replace function public.get_guided_learning_step_v2'));
    const functionEnd = readStepFunction.indexOf('create or replace function public.advance_guided_learning_session_v2');
    const body = readStepFunction.slice(0, functionEnd);
    expect(body).not.toContain("'correct_answer'");
    expect(body).not.toContain("'explanation'");
    expect(migration).toContain('LEARNING_REVIEW_REQUIRES_REAL_QUESTIONS');
  });

  it('uses V2 mastery policy invariants and tenant-scoped grants', () => {
    expect(migration).toContain("strong_count, 'V2'");
    expect(migration).toContain('valid_count >= 3 and run_count >= 2');
    expect(migration).toContain("evidence.source in ('TRANSFER', 'LOCK_IN', 'REVIEW')");
    expect(migration).toContain("case step_row.purpose when 'PROBE' then 'DIAGNOSTIC' else step_row.purpose end");
    expect(migration).toContain("next_skill is null or next_skill = session_row.target_canonical_skill_id");
    expect(migration).toContain("source in ('PRACTICE', 'DIAGNOSTIC', 'TRANSFER', 'LOCK_IN', 'REVIEW', 'SIMULATION', 'EXAM')");
    expect(migration).toContain('private.learning_v2_scope_student');
    expect(migration).toContain('grant execute on function public.start_guided_learning_session_v2');
  });

  it('uses versioned purpose-qualified packs and does not repeat submitted items', () => {
    expect(migration).toContain('GENERATED FROM content/adaptive/tec-escola-core-v2/*.json');
    expect(migration).toContain("question.metadata->>'adaptive_v2_purpose' = purpose_row.purpose");
    expect(migration).toContain('previous_attempt.session_id = step_row.session_id');
    expect(migration).toContain("feedback_item->>'misconception_code'");
    expect(migration).toContain('content_pack');
    expect(migration).toContain("('LINEAR_FUNCTION', 'EQUATIONS')");
    expect(migration).toContain('session.status in (\'ACTIVE\', \'PAUSED\')');
    expect(migration).not.toContain("jsonb_build_object('fallback', true)");
  });
});
