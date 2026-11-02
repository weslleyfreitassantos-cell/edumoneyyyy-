import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261102000100_bncc_guided_visual_stimulus_v1.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('guided question visual stimulus migration', () => {
  it('adds only optional metadata to both current and legacy V4 step payloads', () => {
    expect(migration).toContain("'public.get_guided_learning_step_v4(uuid)'");
    expect(migration).toContain("'public.get_guided_learning_step_v4_legacy_v9(uuid)'");
    expect(migration).toContain("'jsonb'::regtype");
    expect(migration).toContain('p.prosecdef');
    expect(migration).toContain("where setting like 'search_path=%'");
    expect(migration.match(/question\[.\]metadata/g)).toHaveLength(2);
    expect(migration).toContain('BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_MISSING');
    expect(migration).toContain('BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_SHAPE_MISMATCH');
    expect(migration).toContain('BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_SECURITY_METADATA_CHANGED');
    expect(migration).toContain('BNCC_GUIDED_VISUAL_STIMULUS_PATCH_MISMATCH');
  });

  it('requires the canonical payload counts and validates both functions before replacement', () => {
    expect(migration).toContain('from regexp_matches(');
    expect(migration).toContain('candidate_definition := regexp_replace(');
    expect(migration).toContain('expected_payload_count := case target_index when 1 then 1 else 2 end');
    expect(migration).toContain('old_clause_count = expected_payload_count and patched_clause_count = 0');
    expect(migration).toContain('old_clause_count = 0 and patched_clause_count = expected_payload_count');
    expect(migration).toContain('No function is replaced until both targets pass');
    expect(migration).toMatch(/execute\s+candidate_definitions\[target_index\]/i);
    expect(migration).not.toContain("position('visual_stimulus' in function_definition)");
  });

  it('does not mutate question, publication, attempt, XP, or progress data', () => {
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\s+(into\s+|from\s+)?public\.(learning_question_bank|learning_guided_step_attempts|learning_student_gamification|learning_gamification_events|learning_guided_sessions|learning_guided_steps)\b/i);
    expect(migration).not.toMatch(/\b(drop\s+table|disable\s+row\s+level\s+security|grant\s+all)\b/i);
  });
});
