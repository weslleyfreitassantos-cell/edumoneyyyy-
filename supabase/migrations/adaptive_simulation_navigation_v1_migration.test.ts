import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20261003000700_adaptive_simulation_navigation_v1.sql', import.meta.url), 'utf8');

describe('adaptive simulation navigation migration', () => {
  it('stores navigation separately and scopes persistence to the active student attempt', () => {
    expect(migration).toContain('add column if not exists navigation_state jsonb');
    expect(migration).toContain('save_learning_simulation_attempt_navigation');
    expect(migration).toContain("attempt.status = 'IN_PROGRESS'");
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain('revoke all on function public.save_learning_simulation_attempt_navigation(uuid, jsonb) from public, anon');
    expect(migration).not.toContain('correct_answer');
  });
});
