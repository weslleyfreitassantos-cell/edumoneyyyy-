import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261110030000_tec_quiz_live_server_clock_v2.sql', import.meta.url),
  'utf8',
);

describe('Tec Quiz Live server clock migration', () => {
  it('preserves the authenticated state implementation behind a restricted wrapper', () => {
    expect(migration).toContain("alter function public.tec_quiz_state_v1(uuid) rename to tec_quiz_state_core_v1");
    expect(migration).toContain('public.tec_quiz_state_core_v1(p_game_id)');
    expect(migration).toContain('revoke all on function public.tec_quiz_state_core_v1(uuid)');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("grant execute on function public.tec_quiz_state_v1(uuid) to authenticated");
  });

  it('returns database wall time alongside the existing game state without changing the deadline', () => {
    expect(migration).toContain("jsonb_build_object('server_now', clock_timestamp())");
    expect(migration).not.toMatch(/update\s+public\.tec_quiz_games/i);
    expect(migration).not.toMatch(/delete\s+from/i);
  });
});
