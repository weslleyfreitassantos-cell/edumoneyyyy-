import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261110040000_tec_quiz_live_authoritative_round_v1.sql', import.meta.url),
  'utf8',
);
const answer = migration.split('create or replace function public.tec_quiz_submit_answer_v2')[1]
  ?.split('create or replace function public.tec_quiz_tick_v1')[0] ?? '';
const tick = migration.split('create or replace function public.tec_quiz_tick_v1')[1]
  ?.split('create or replace function public.tec_quiz_control_reveal_v1')[0] ?? '';
const start = migration.split('create or replace function public.tec_quiz_start_v1')[1]
  ?.split('create or replace function public.tec_quiz_submit_answer_v1')[0] ?? '';
const reveal = migration.split('create or replace function public.tec_quiz_control_reveal_v1')[1]
  ?.split('revoke all on function public.tec_quiz_submit_answer_v1')[0] ?? '';

describe('Tec Quiz Live authoritative round migration', () => {
  it('uses a monotonic database timestamp only after serializing the game and participant', () => {
    expect(answer).toContain('for update;');
    expect(answer).toContain('for update of participant;');
    expect(answer).toContain('action_now := clock_timestamp();');
    expect(answer.indexOf('for update of participant;')).toBeLessThan(answer.indexOf('action_now := clock_timestamp();'));
    expect(answer).toContain('action_now >= game_row.round_deadline_at');
    expect(answer).toContain('game_row.question_index <> p_expected_question_index');
    expect(answer).toContain('p_expected_question_index, participant_row.id');
    expect(answer).toContain('answered_at');
    expect(answer).toContain('and answer.question_index = p_expected_question_index');
    expect(answer).toContain("return jsonb_build_object('accepted', true, 'already_submitted', true)");
  });

  it('prevents legacy clients from submitting without the displayed question identity', () => {
    const legacy = migration.split('create or replace function public.tec_quiz_submit_answer_v1')[1]
      ?.split('create or replace function public.tec_quiz_submit_answer_v2')[0] ?? '';
    expect(legacy).toContain("raise exception 'TEC_QUIZ_CLIENT_UPDATE_REQUIRED'");
    expect(migration).toContain('grant execute on function public.tec_quiz_submit_answer_v2(uuid, integer, integer) to authenticated');
  });

  it('repairs a missing reveal deadline instead of treating it as expired', () => {
    expect(tick).toContain('game_row.reveal_started_at is null or game_row.round_deadline_at is null');
    expect(tick).toContain("round_deadline_at = action_now + interval '15 seconds'");
    expect(tick.indexOf('game_row.round_deadline_at is null')).toBeLessThan(tick.indexOf('action_now >= game_row.round_deadline_at'));
  });

  it('checks all automatic transitions against the database clock after acquiring the game lock', () => {
    expect(tick.indexOf('for update;')).toBeLessThan(tick.indexOf('action_now := clock_timestamp();'));
    expect(tick).toContain('action_now >= game_row.round_deadline_at');
    expect(tick).not.toContain('now()');
    expect(start).toContain('started_at = action_now, round_started_at = action_now');
    expect(reveal).toContain('action_now - reveal_paused_at');
  });
});
