begin;

alter function private.append_guided_v4_next_step(
  public.learning_guided_sessions,
  public.learning_guided_steps,
  text,
  text
) rename to append_guided_v4_next_step_core_v1;

create or replace function private.pick_guided_v4_fresh_question_set(
  target_session public.learning_guided_sessions,
  target_skill_id uuid,
  target_purpose text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  target_teacher_profile_id uuid;
  fresh_set_id uuid;
begin
  select offering.teacher_profile_id
    into target_teacher_profile_id
    from public.subject_offerings offering
   where offering.class_id = target_session.class_id
     and offering.subject_id = target_session.subject_id
     and offering.active
   order by offering.teacher_profile_id
   limit 1;

  select question_set.id
    into fresh_set_id
    from public.learning_question_sets question_set
   where question_set.canonical_skill_id = target_skill_id
     and question_set.purpose = target_purpose
     and question_set.active
     and (
       (question_set.scope = 'TEACHER'
         and question_set.institution_id = target_session.institution_id
         and question_set.teacher_profile_id = target_teacher_profile_id)
       or (question_set.scope = 'INSTITUTION'
         and question_set.institution_id = target_session.institution_id)
       or (question_set.scope = 'GLOBAL'
         and question_set.institution_id is null)
     )
     and (
       select count(distinct candidate_item.question_bank_id)
         from public.learning_question_set_items candidate_item
         join public.learning_question_bank bank
           on bank.id = candidate_item.question_bank_id and bank.active
        where candidate_item.question_set_id = question_set.id
     ) = 2
     and (
       select count(distinct candidate_item.question_bank_id)
         from public.learning_question_set_items candidate_item
         join public.learning_question_bank bank
           on bank.id = candidate_item.question_bank_id and bank.active
        where candidate_item.question_set_id = question_set.id
          and not exists (
            select 1
              from public.learning_guided_step_attempts prior_attempt
              join public.learning_guided_steps prior_step
                on prior_step.id = prior_attempt.step_id
              join public.learning_guided_sessions prior_session
                on prior_session.id = prior_attempt.session_id
              cross join lateral jsonb_array_elements(
                case when jsonb_typeof(prior_attempt.answers) = 'array'
                  then prior_attempt.answers else '[]'::jsonb end
              ) answer
             where prior_session.institution_id = target_session.institution_id
               and prior_session.student_id = target_session.student_id
               and prior_step.canonical_skill_id = target_skill_id
               and answer->>'question_bank_id' = candidate_item.question_bank_id::text
          )
     ) = 2
   order by case question_set.scope when 'TEACHER' then 0 when 'INSTITUTION' then 1 else 2 end,
            question_set.version desc,
            question_set.id
   limit 1;

  return fresh_set_id;
end;
$$;

create or replace function private.append_guided_v4_next_step(
  session_row public.learning_guided_sessions,
  completed_step public.learning_guided_steps,
  outcome text,
  event_key text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  next_step uuid;
  next_step_row public.learning_guided_steps%rowtype;
  fresh_question_set_id uuid;
begin
  next_step := private.append_guided_v4_next_step_core_v1(
    session_row, completed_step, outcome, event_key
  );
  if next_step is null then return null; end if;

  if completed_step.step_type = 'LESSON'
     and completed_step.metadata->>'review_remediation' = 'true' then
    select step.* into next_step_row
      from public.learning_guided_steps step
     where step.id = next_step;

    if next_step_row.step_type = 'PRACTICE' then
      fresh_question_set_id := private.pick_guided_v4_fresh_question_set(
        session_row, next_step_row.canonical_skill_id, next_step_row.purpose
      );

      if fresh_question_set_id is null then
        update public.learning_guided_steps
           set status = 'SKIPPED',
               metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                 'runtime_reason', 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
                 'mastery_unproven', true
               ),
               updated_at = now()
         where id = next_step;

        update public.learning_guided_sessions
           set status = 'NEEDS_TEACHER_SUPPORT',
               current_step_id = null,
               decision_reason = 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
               metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                 'runtime_reason', 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
                 'mastery_unproven', true,
                 'review_remediation_question_pool_exhausted', true
               ),
               updated_at = now()
         where id = session_row.id;

        insert into public.learning_guided_session_events(
          institution_id, session_id, student_id, event_type, step_id,
          idempotency_key, payload
        ) values (
          session_row.institution_id, session_row.id, session_row.student_id,
          'TEACHER_SUPPORT_REQUIRED', next_step,
          event_key || ':review-question-pool-exhausted',
          jsonb_build_object(
            'reason', 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
            'mastery_unproven', true,
            'skipped_step_id', next_step
          )
        ) on conflict do nothing;
        return null;
      end if;

      update public.learning_guided_steps
         set question_set_id = fresh_question_set_id,
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'review_remediation_assessment', true,
               'fresh_questions_only', true
             ),
             updated_at = now()
       where id = next_step;
      update public.learning_guided_sessions
         set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'review_remediation_question_set_id', fresh_question_set_id,
           'review_remediation_fresh_questions_only', true
         ),
             updated_at = now()
       where id = session_row.id;
    end if;
  end if;

  return next_step;
end;
$$;

revoke all on function private.append_guided_v4_next_step_core_v1(
  public.learning_guided_sessions,
  public.learning_guided_steps,
  text,
  text
), private.pick_guided_v4_fresh_question_set(
  public.learning_guided_sessions,
  uuid,
  text
), private.append_guided_v4_next_step(
  public.learning_guided_sessions,
  public.learning_guided_steps,
  text,
  text
) from public, anon, authenticated, service_role;

do $recover$
declare
  session_row public.learning_guided_sessions%rowtype;
  current_step public.learning_guided_steps%rowtype;
  fresh_question_set_id uuid;
begin
  for session_row in
    select session.*
      from public.learning_guided_sessions session
      join public.learning_guided_steps current_step
        on current_step.id = session.current_step_id
     where session.planner_version = 'V4'
       and session.status = 'ACTIVE'
       and current_step.step_type = 'PRACTICE'
       and current_step.status = 'ACTIVE'
       and not exists (
         select 1
           from public.learning_guided_step_attempts current_attempt
          where current_attempt.step_id = current_step.id
       )
       and exists (
         select 1
           from public.learning_guided_steps remediation_lesson
          where remediation_lesson.session_id = session.id
            and remediation_lesson.position = current_step.position - 1
            and remediation_lesson.step_type = 'LESSON'
            and remediation_lesson.status = 'COMPLETED'
            and remediation_lesson.metadata->>'review_remediation' = 'true'
       )
     order by session.updated_at
  loop
    select step.* into current_step
      from public.learning_guided_steps step
     where step.id = session_row.current_step_id;

    fresh_question_set_id := private.pick_guided_v4_fresh_question_set(
      session_row, current_step.canonical_skill_id, current_step.purpose
    );

    if fresh_question_set_id is null then
      update public.learning_guided_steps
         set status = 'SKIPPED',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'runtime_reason', 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
               'mastery_unproven', true
             ),
             updated_at = now()
       where id = current_step.id;

      update public.learning_guided_sessions
         set status = 'NEEDS_TEACHER_SUPPORT',
             current_step_id = null,
             decision_reason = 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'runtime_reason', 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
               'mastery_unproven', true,
               'review_remediation_question_pool_exhausted', true
             ),
             updated_at = now()
       where id = session_row.id;

      insert into public.learning_guided_session_events(
        institution_id, session_id, student_id, event_type, step_id,
        idempotency_key, payload
      ) values (
        session_row.institution_id, session_row.id, session_row.student_id,
        'TEACHER_SUPPORT_REQUIRED', current_step.id,
        'v4-review-question-pool-exhausted:' || session_row.id::text,
        jsonb_build_object(
          'reason', 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
          'mastery_unproven', true,
          'skipped_step_id', current_step.id,
          'recovered_by_migration', '20261011000400'
        )
      ) on conflict do nothing;
    else
      update public.learning_guided_steps
         set question_set_id = fresh_question_set_id,
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'review_remediation_assessment', true,
               'fresh_questions_only', true
             ),
             updated_at = now()
       where id = current_step.id;
      update public.learning_guided_sessions
         set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'review_remediation_question_set_id', fresh_question_set_id,
           'review_remediation_fresh_questions_only', true
         ),
             updated_at = now()
       where id = session_row.id;
    end if;
  end loop;
end;
$recover$;

commit;
