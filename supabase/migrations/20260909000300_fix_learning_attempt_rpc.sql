-- Corrige o cálculo do total e mantém a submissão validada no servidor.
create or replace function public.submit_learning_attempt(p_activity_id uuid, p_answers jsonb)
returns table(attempt_id uuid, score integer, total_points integer, mastery_percent integer)
language plpgsql security definer set search_path = public, private
as $$
declare
  v_activity public.learning_activities%rowtype;
  v_student public.students%rowtype;
  v_attempt uuid;
  v_total integer := 0;
  v_score integer := 0;
  v_skill uuid;
  v_percent integer := 0;
begin
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'Respostas inválidas.';
  end if;

  select * into v_activity
  from public.learning_activities
  where id = p_activity_id
    and status = 'PUBLISHED';

  if not found then
    raise exception 'Atividade indisponível.';
  end if;

  select s.* into v_student
  from public.students s
  where s.profile_id = auth.uid()
    and s.institution_id = v_activity.institution_id
    and s.active;

  if not found or not private.learning_is_assigned_student(p_activity_id, v_student.id) then
    raise exception 'Aluno não possui acesso a esta atividade.';
  end if;

  select coalesce(sum(q.points), 0)::integer
    into v_total
  from public.learning_questions q
  where q.activity_id = p_activity_id;

  v_skill := v_activity.skill_id;

  insert into public.learning_attempts(
    institution_id,
    activity_id,
    student_id,
    total_points,
    completed_at
  )
  values (
    v_activity.institution_id,
    p_activity_id,
    v_student.id,
    v_total,
    now()
  )
  on conflict (activity_id, student_id) do update
    set started_at = now(),
        completed_at = now(),
        total_points = excluded.total_points
  returning id into v_attempt;

  delete from public.learning_answers where attempt_id = v_attempt;

  insert into public.learning_answers(
    institution_id,
    attempt_id,
    question_id,
    answer_json,
    is_correct,
    points_awarded
  )
  select
    v_activity.institution_id,
    v_attempt,
    q.id,
    item->'answer',
    q.correct_answer_json = item->'answer',
    case when q.correct_answer_json = item->'answer' then q.points else 0 end
  from public.learning_questions q
  join jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item
    on (item->>'question_id')::uuid = q.id
  where q.activity_id = p_activity_id;

  select coalesce(sum(points_awarded), 0)::integer
    into v_score
  from public.learning_answers
  where attempt_id = v_attempt;

  update public.learning_attempts
  set score = v_score
  where id = v_attempt;

  if v_skill is not null then
    v_percent := case
      when v_total = 0 then 0
      else least(100, round(v_score * 100.0 / v_total)::integer)
    end;

    insert into public.learning_skill_progress(
      institution_id,
      student_id,
      skill_id,
      mastery_percent,
      status,
      last_activity_at
    )
    values (
      v_activity.institution_id,
      v_student.id,
      v_skill,
      v_percent,
      case
        when v_percent >= 80 then 'MASTERED'
        when v_percent > 0 then 'IN_PROGRESS'
        else 'NOT_STARTED'
      end,
      now()
    )
    on conflict (institution_id, student_id, skill_id) do update
      set mastery_percent = excluded.mastery_percent,
          status = excluded.status,
          last_activity_at = excluded.last_activity_at,
          updated_at = now();
  end if;

  return query select v_attempt, v_score, v_total, v_percent;
end;
$$;

revoke all on function public.submit_learning_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_learning_attempt(uuid, jsonb) to authenticated, service_role;
