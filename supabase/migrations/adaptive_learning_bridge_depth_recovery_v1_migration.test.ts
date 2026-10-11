import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261011000200_bncc_adaptive_bridge_depth_recovery_v1.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning bridge depth recovery migration', () => {
  it('counts distinct prerequisite skills rather than repeated steps', () => {
    expect(migration).toContain("jsonb_agg(visited.skill_id::text order by visited.first_position)");
    expect(migration).toContain('group by step.canonical_skill_id');
    expect(migration).toContain("bridge_skill_ids := bridge_skill_ids || jsonb_build_array(next_skill::text)");
    expect(migration).toContain('bridge_depth := jsonb_array_length(bridge_skill_ids)');
  });

  it('returns to the original target without asserting unproven mastery at the depth limit', () => {
    expect(migration).toContain("'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET'");
    expect(migration).toContain("'mastery_unproven', true");
    expect(migration).toContain("'RETURN_TO_TARGET'");
    expect(migration).toContain("not (bridge_skill_ids @> jsonb_build_array(candidate_skill::text))");
  });

  it('recovers only sessions paused by the old guard and preserves their saved attempts', () => {
    expect(migration).toContain("session.status = 'PAUSED'");
    expect(migration).toContain("session.decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'");
    expect(migration).toContain("'bridge_limit_recovery', true");
    expect(migration.toLowerCase()).not.toContain('delete from public.learning_guided_step_attempts');
    expect(migration.toLowerCase()).not.toContain('truncate ');
  });
});
