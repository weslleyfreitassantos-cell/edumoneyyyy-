-- Entrega ao aluno somente as atividades publicadas para uma turma em que ele
-- possui uma matrícula ativa, sem expor as respostas corretas.
create or replace function public.list_student_learning_activities(
  p_institution_id uuid
)
returns table (
  id uuid,
  subject_id uuid,
  unit_id uuid,
  skill_id uuid,
  teacher_id uuid,
  title text,
  description text,
  activity_type text,
  status text,
  created_at timestamptz,
  subjects jsonb,
  learning_questions jsonb
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    a.id,
    a.subject_id,
    a.unit_id,
    a.skill_id,
    a.teacher_id,
    a.title,
    a.description,
    a.activity_type,
    a.status,
    a.created_at,
    jsonb_build_object('name', s.name),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'question_text', q.question_text,
            'question_type', q.question_type,
            'options_json', q.options_json,
            'explanation', q.explanation,
            'points', q.points,
            'sort_order', q.sort_order
          )
          order by q.sort_order, q.id
        )
        from public.learning_questions q
        where q.activity_id = a.id
      ),
      '[]'::jsonb
    )
  from public.learning_activities a
  join public.subjects s on s.id = a.subject_id
  where a.institution_id = p_institution_id
    and a.status = 'PUBLISHED'
    and s.institution_id = p_institution_id
    and coalesce(s.active, true)
    and exists (
      select 1
      from public.learning_assignments la
      join public.enrollments e
        on e.class_id = la.class_id
       and e.active
      join public.students st
        on st.id = e.student_id
       and st.active
      where la.activity_id = a.id
        and la.institution_id = p_institution_id
        and st.profile_id = auth.uid()
        and st.institution_id = p_institution_id
    )
  order by a.created_at desc;
$$;

revoke all on function public.list_student_learning_activities(uuid) from public, anon;
grant execute on function public.list_student_learning_activities(uuid) to authenticated;
