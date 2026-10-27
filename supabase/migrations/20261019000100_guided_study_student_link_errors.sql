create or replace function public.get_recommended_guided_study_v10(
  p_institution_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_ids uuid[];
begin
  select coalesce(array_agg(student.id), '{}'::uuid[]) into student_ids
    from public.students student
   where student.profile_id = auth.uid()
     and student.institution_id = p_institution_id
     and student.active;

  if cardinality(student_ids) = 0 then
    return jsonb_build_object('state', 'STUDENT_PROFILE_LINK_MISSING');
  elsif cardinality(student_ids) > 1 then
    return jsonb_build_object('state', 'AMBIGUOUS_STUDENT_LINK');
  end if;

  return private.recommend_guided_discipline_study_v10(
    p_institution_id,
    student_ids[1],
    p_subject_id
  );
end;
$$;

revoke all on function public.get_recommended_guided_study_v10(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_recommended_guided_study_v10(uuid, uuid)
  to authenticated;
