import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261106001500_tec_quiz_shared_activity_support.sql', import.meta.url),
  'utf8',
);

const teacherOptions = migration.split('create or replace function public.tec_quiz_teacher_options_v1()')[1]
  ?.split('create or replace function public.tec_quiz_create_game_v1')[0] ?? '';
const createGame = migration.split('create or replace function public.tec_quiz_create_game_v1')[1]
  ?.split('notify pgrst')[0] ?? '';

describe('Tec Quiz availability for published class activities', () => {
  it('lets a teacher use published activities assigned to classes where they teach the subject', () => {
    expect(teacherOptions).toContain("activity.status = 'PUBLISHED'");
    expect(teacherOptions).toContain('assignment.activity_id = activity.id');
    expect(teacherOptions).toContain('offering.teacher_profile_id = auth.uid()');
    expect(teacherOptions).not.toMatch(/activity\.teacher_id\s*=\s*auth\.uid\(\)/);
    expect(createGame).not.toMatch(/activity\.teacher_id\s*=\s*auth\.uid\(\)/);
    expect(createGame).toContain('assignment.class_id = p_class_id');
    expect(createGame).toContain('membership.role = \'TEACHER\'::public.user_role');
  });

  it('requires 3 to 100 valid supported questions and ignores other formats', () => {
    expect(teacherOptions).toContain('question.question_type in (\'MULTIPLE_CHOICE\', \'TRUE_FALSE\')');
    expect(teacherOptions).toContain('having count(question.id) between 3 and 100');
    expect(teacherOptions).not.toContain('all_question');
    expect(createGame).toContain('if question_count not between 3 and 100 then');
    expect(createGame).toMatch(/insert into public\.tec_quiz_game_questions[\s\S]*?question\.question_type in \('MULTIPLE_CHOICE', 'TRUE_FALSE'\)/);
  });

  it('restricts privileged RPC execution and expires games only within the teacher institution', () => {
    expect(migration).toContain(
      'revoke all on function public.tec_quiz_teacher_options_v1() from public, anon;',
    );
    expect(migration).toContain(
      'grant execute on function public.tec_quiz_teacher_options_v1() to authenticated;',
    );
    expect(migration).toContain(
      'revoke all on function public.tec_quiz_create_game_v1(uuid, uuid, integer, integer) from public, anon;',
    );
    expect(migration).toContain(
      'grant execute on function public.tec_quiz_create_game_v1(uuid, uuid, integer, integer) to authenticated;',
    );
    expect(createGame).toMatch(
      /update public\.tec_quiz_games game[\s\S]*?where game\.institution_id = activity_row\.institution_id/,
    );
  });
});
