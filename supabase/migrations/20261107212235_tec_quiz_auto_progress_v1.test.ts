import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261107212235_tec_quiz_auto_progress_v1.sql', import.meta.url),
  'utf8',
);
const tick = migration.split('create or replace function public.tec_quiz_tick_v1(p_game_id uuid)')[1]
  ?.split('revoke all on function public.tec_quiz_tick_v1')[0] ?? '';

describe('Tec Quiz automatic reveal and progression migration', () => {
  it('authenticates and scopes each tick to an active participant or the owning teacher', () => {
    expect(migration).toContain("if auth.uid() is null or not private.is_current_profile_active() then");
    expect(migration).toContain('private.tec_quiz_teacher_can_access(p_game_id)');
    expect(migration).toContain('private.tec_quiz_student_can_access(p_game_id)');
    expect(tick.indexOf('raise exception \'TEC_QUIZ_ACCESS_DENIED\''))
      .toBeLessThan(tick.indexOf('for update;'));
    expect(migration).toContain("raise exception 'TEC_QUIZ_ACCESS_DENIED'");
  });

  it('repairs missing deadlines, locks expired answers and allows time to review the revealed answer', () => {
    expect(migration).toContain('if game_row.round_deadline_at is null then');
    expect(migration).toContain("set status = 'INTERMISSION'");
    expect(migration).toContain("round_deadline_at = now() + interval '15 seconds'");
    expect(migration).toContain('game_row.reveal_started_at is null');
    expect(migration).toContain('game_row.reveal_paused_at is not null');
    expect(migration).toContain("set status = 'IN_PROGRESS'");
    expect(migration).toContain("set status = 'FINISHED'");
  });

  it('lets only the teacher pause, resume while preserving the remaining time, or advance directly', () => {
    expect(migration).toContain('create or replace function public.tec_quiz_control_reveal_v1');
    expect(migration).toContain("if not private.tec_quiz_teacher_can_access(p_game_id) then");
    expect(migration).toContain("action_name = 'PAUSE'");
    expect(migration).toContain("action_name = 'RESUME'");
    expect(migration).toContain("action_name = 'ADVANCE'");
    expect(migration).toContain('(now() - reveal_paused_at)');
    expect(migration).toContain("'reveal_paused_at', game_row.reveal_paused_at");
    expect(migration).toContain('grant execute on function public.tec_quiz_control_reveal_v1(uuid, text) to authenticated;');
  });

  it('exposes the security-definer RPC only to authenticated users', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('revoke all on function public.tec_quiz_tick_v1(uuid) from public, anon;');
    expect(migration).toContain('grant execute on function public.tec_quiz_tick_v1(uuid) to authenticated;');
  });
});
