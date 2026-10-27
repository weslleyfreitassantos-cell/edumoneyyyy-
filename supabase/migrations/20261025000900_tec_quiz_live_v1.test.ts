import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261025000900_tec_quiz_live_v1.sql', import.meta.url),
  'utf8',
);

describe('Tec Quiz Live V1 migration', () => {
  it('stores game snapshots and denies direct table access to client roles', () => {
    for (const table of ['tec_quiz_games', 'tec_quiz_game_questions', 'tec_quiz_participants', 'tec_quiz_answers']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toMatch(/revoke all on public\.tec_quiz_games,[\s\S]*?from public, anon, authenticated/);
    expect(migration).toContain('unique (game_id, question_index, participant_id)');
    expect(migration).toContain('source_question_id');
    expect(migration).toContain('private.tec_quiz_options_are_valid');
  });

  it('limits room creation and joining to authenticated, active institutional roles and enrollments', () => {
    expect(migration).toContain("membership.role = 'TEACHER'::public.user_role");
    expect(migration).toContain("membership.role = 'STUDENT'::public.user_role");
    expect(migration).toContain('student.institution_id = game_row.institution_id');
    expect(migration).toContain('enrollment.class_id = game_row.class_id');
    expect(migration).toContain("upper(enrollment.status) = 'ACTIVE'");
    expect(migration).toContain('assignment.institution_id = activity_row.institution_id');
    expect(migration).toContain('offering.teacher_profile_id = auth.uid()');
  });

  it('calculates unique answers and points on the server, and hides the key until reveal', () => {
    expect(migration).toContain('for update');
    expect(migration).toMatch(/if found then\s+return jsonb_build_object\('accepted', true, 'already_submitted', true\)/);
    expect(migration).toContain('game_row.base_points + floor(');
    expect(migration).toContain('p_selected_option_index = question_row.correct_option_index');
    expect(migration).toContain("reveal := game_row.status in ('INTERMISSION', 'FINISHED')");
    expect(migration).toContain("'leaderboard', case when reveal then scoreboard else '[]'::jsonb end");
    expect(migration).toContain("'correct_option_index', question_row.correct_option_index");
    expect(migration).not.toContain("'full_name'");
    expect(migration).toContain("'Jogador ' || lpad");
  });

  it('uses private Realtime broadcasts with server-checked topic membership', () => {
    expect(migration).toContain("extension = 'broadcast'");
    expect(migration).toContain('private.tec_quiz_can_access_realtime_topic(topic)');
    expect(migration).toContain("'tec-quiz:' || target_game_id::text");
    expect(migration).toContain("realtime.send(");
    expect(migration).toContain('true);');
  });

  it('grants only the explicit game RPCs to authenticated users', () => {
    for (const name of [
      'tec_quiz_teacher_options_v1', 'tec_quiz_create_game_v1', 'tec_quiz_join_v1',
      'tec_quiz_my_current_game_v1', 'tec_quiz_start_v1', 'tec_quiz_submit_answer_v1',
      'tec_quiz_advance_v1', 'tec_quiz_state_v1',
    ]) {
      expect(migration).toContain(`grant execute on function public.${name}`);
      expect(migration).toContain(`revoke all on function public.${name}`);
    }
  });
});
