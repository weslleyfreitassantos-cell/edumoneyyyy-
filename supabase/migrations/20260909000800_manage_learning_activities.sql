-- Centraliza edição e exclusão de atividades no banco, preservando o escopo do professor.
create or replace function public.update_learning_activity(
  p_activity_id uuid,
  p_title text,
  p_description text,
  p_activity_type text,
  p_question_text text,
  p_options_json jsonb,
  p_correct_answer_json jsonb,
  p_explanation text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_activity public.learning_activities%rowtype;
  v_question_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Entre novamente para editar a atividade.';
  end if;

  select *
    into v_activity
    from public.learning_activities
   where id = p_activity_id;

  if not found or v_activity.teacher_id <> auth.uid() then
    raise exception 'Você não pode editar esta atividade.';
  end if;

  if not private.learning_is_teacher(v_activity.institution_id) then
    raise exception 'Seu perfil não possui permissão de professor nesta instituição.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Informe um título para a atividade.';
  end if;

  if p_activity_type not in ('PRACTICE', 'REINFORCEMENT') then
    raise exception 'Tipo de atividade inválido.';
  end if;

  update public.learning_activities
     set title = trim(p_title),
         description = nullif(trim(coalesce(p_description, '')), ''),
         activity_type = p_activity_type,
         updated_at = now()
   where id = p_activity_id;

  select q.id
    into v_question_id
    from public.learning_questions q
   where q.activity_id = p_activity_id
   order by q.sort_order, q.id
   limit 1;

  if v_question_id is null then
    insert into public.learning_questions (
      institution_id,
      activity_id,
      question_text,
      question_type,
      options_json,
      correct_answer_json,
      explanation,
      points,
      sort_order
    ) values (
      v_activity.institution_id,
      p_activity_id,
      trim(p_question_text),
      'MULTIPLE_CHOICE',
      coalesce(p_options_json, '[]'::jsonb),
      coalesce(p_correct_answer_json, '""'::jsonb),
      nullif(trim(coalesce(p_explanation, '')), ''),
      1,
      0
    );
  else
    update public.learning_questions
       set question_text = trim(p_question_text),
           options_json = coalesce(p_options_json, '[]'::jsonb),
           correct_answer_json = coalesce(p_correct_answer_json, '""'::jsonb),
           explanation = nullif(trim(coalesce(p_explanation, '')), '')
     where id = v_question_id;
  end if;

  return p_activity_id;
end;
$$;

create or replace function public.delete_learning_activity(
  p_activity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_institution_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Entre novamente para excluir a atividade.';
  end if;

  select institution_id
    into v_institution_id
    from public.learning_activities
   where id = p_activity_id
     and teacher_id = auth.uid();

  if v_institution_id is null then
    raise exception 'Você não pode excluir esta atividade.';
  end if;

  if not private.learning_is_teacher(v_institution_id) then
    raise exception 'Seu perfil não possui permissão de professor nesta instituição.';
  end if;

  delete from public.learning_activities where id = p_activity_id;
  return true;
end;
$$;

revoke all on function public.update_learning_activity(uuid, text, text, text, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.update_learning_activity(uuid, text, text, text, text, jsonb, jsonb, text) to authenticated;
revoke all on function public.delete_learning_activity(uuid) from public, anon;
grant execute on function public.delete_learning_activity(uuid) to authenticated;
