import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261002000200_fix_adaptive_learning_step_question_reuse.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning step question reuse migration', () => {
  it('scopes question exclusion to the current step', () => {
    expect(migration).toContain('previous_attempt.step_id = step_row.id');
    expect(migration).not.toContain('previous_attempt.session_id = step_row.session_id');
    expect(migration).toContain('LEARNING_V4_QUESTION_SET_EMPTY');
  });

  it('keeps the student RPC protected', () => {
    expect(migration).toContain('revoke all on function public.get_guided_learning_step_v4(uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.get_guided_learning_step_v4(uuid) to authenticated');
  });
});
