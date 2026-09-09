-- Publica a atividade e cria sua atribuição em uma única operação autorizada.
-- Isso evita que o cliente dependa de um insert com referências cruzadas sob RLS.
create or replace function private.learning_teacher_can_assign_activity(
  target_activity_id uuid,
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.learning_activities a
    join public.subjects s on s.id = a.subject_id
    join public.classes c on c.id = target_class_id
    where a.id = target_activity_id
      and a.institution_id = target_institution_id
      and a.teacher_id = auth.uid()
      and s.institution_id = target_institution_id
      and coalesce(s.active, true)
      and c.institution_id = target_institution_id
      and coalesce(c.active, true)
      and (
        exists (
          select 1
          from public.subject_offerings so
          where so.subject_id = a.subject_id
            and so.class_id = target_class_id
            and so.teacher_profile_id = auth.uid()
            and coalesce(so.active, true)
        )
        or exists (
          select 1
          from public.subject_offerings so
          join public.subjects owned_subject on owned_subject.id = so.subject_id
          where so.class_id = target_class_id
            and so.teacher_profile_id = auth.uid()
            and coalesce(so.active, true)
            and owned_subject.institution_id = target_institution_id
            and coalesce(owned_subject.active, true)
        )
      )
  );
$$;

create or replace function private.learning_can_assign_activity(
  target_activity_id uuid,
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.learning_teacher_can_assign_activity(
    target_activity_id,
    target_institution_id,
    target_class_id
  );
$$;

create or replace function public.publish_learning_activity(
  p_activity_id uuid,
  p_class_id uuid,
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_activity public.learning_activities%rowtype;
  v_assignment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Entre novamente para publicar a atividade.';
  end if;

  select *
    into v_activity
    from public.learning_activities
   where id = p_activity_id;

  if not found then
    raise exception 'Atividade não encontrada.';
  end if;

  if v_activity.teacher_id <> auth.uid() then
    raise exception 'Você não pode publicar esta atividade.';
  end if;

  if not private.learning_is_teacher(v_activity.institution_id) then
    raise exception 'Seu perfil não possui permissão de professor nesta instituição.';
  end if;

  if not private.learning_teacher_can_assign_activity(
    v_activity.id,
    v_activity.institution_id,
    p_class_id
  ) then
    raise exception 'A turma selecionada não está vinculada ao seu perfil.';
  end if;

  update public.learning_activities
     set status = 'PUBLISHED',
         updated_at = now()
   where id = v_activity.id;

  insert into public.learning_assignments (
    institution_id,
    activity_id,
    class_id,
    assigned_by,
    due_at
  ) values (
    v_activity.institution_id,
    v_activity.id,
    p_class_id,
    auth.uid(),
    p_due_at
  )
  on conflict (activity_id, class_id)
  do update set due_at = excluded.due_at
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

revoke all on function public.publish_learning_activity(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.publish_learning_activity(uuid, uuid, timestamptz) to authenticated;

drop policy if exists learning_assignments_insert on public.learning_assignments;
create policy learning_assignments_insert on public.learning_assignments
for insert with check (
  assigned_by = auth.uid()
  and private.learning_can_assign_activity(activity_id, institution_id, class_id)
);
