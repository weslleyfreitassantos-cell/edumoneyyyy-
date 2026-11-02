import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261102000100_bncc_guided_visual_stimulus_v1.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('guided question visual stimulus migration', () => {
  it('adds only optional metadata to both current and legacy V4 step payloads', () => {
    expect(migration).toContain("'public.get_guided_learning_step_v4(uuid)'::regprocedure");
    expect(migration).toContain("'public.get_guided_learning_step_v4_legacy_v9(uuid)'::regprocedure");
    expect(migration.match(/'visual_stimulus',\s*question\.metadata->'visual_stimulus'/g)).toHaveLength(2);
    expect(migration).toContain('BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_MISSING');
    expect(migration).toContain('BNCC_GUIDED_VISUAL_STIMULUS_PATCH_MISMATCH');
  });

  it('is idempotent and does not mutate question, publication, attempt, XP, or progress data', () => {
    expect(migration).toContain("if position('visual_stimulus' in function_definition) > 0 then");
    expect(migration).toMatch(/execute\s+function_definition/i);
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\s+(into\s+|from\s+)?public\.(learning_question_bank|learning_guided_step_attempts|learning_student_gamification|learning_gamification_events|learning_guided_sessions|learning_guided_steps)\b/i);
    expect(migration).not.toMatch(/\b(drop\s+table|disable\s+row\s+level\s+security|grant\s+all)\b/i);
  });
});
