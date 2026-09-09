-- Impede referências cruzadas entre instituições e turmas sem vínculo docente.
create or replace function private.learning_teacher_owns_subject(
  target_institution_id uuid,
  target_subject_id uuid
)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.subject_offerings so
    join public.subjects s on s.id = so.subject_id
    where so.subject_id = target_subject_id
      and so.teacher_profile_id = auth.uid()
      and so.active
      and s.institution_id = target_institution_id
      and s.active
  );
$$;

create or replace function private.learning_teacher_owns_subject_class(
  target_institution_id uuid,
  target_subject_id uuid,
  target_class_id uuid
)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.subject_offerings so
    join public.subjects s on s.id = so.subject_id
    join public.classes c on c.id = so.class_id
    where so.subject_id = target_subject_id
      and so.class_id = target_class_id
      and so.teacher_profile_id = auth.uid()
      and so.active
      and s.institution_id = target_institution_id
      and c.institution_id = target_institution_id
      and s.active
      and c.active
  );
$$;

drop policy if exists learning_activities_write on public.learning_activities;
create policy learning_activities_write on public.learning_activities
for all using (
  teacher_id = auth.uid()
  and private.learning_is_teacher(institution_id)
  and private.learning_teacher_owns_subject(institution_id, subject_id)
) with check (
  teacher_id = auth.uid()
  and private.learning_is_teacher(institution_id)
  and private.learning_teacher_owns_subject(institution_id, subject_id)
);

drop policy if exists learning_units_write on public.learning_units;
create policy learning_units_write on public.learning_units
for all using (
  public.is_institution_admin(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and private.learning_teacher_owns_subject(institution_id, subject_id)
  )
) with check (
  public.is_institution_admin(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and private.learning_teacher_owns_subject(institution_id, subject_id)
  )
);

drop policy if exists learning_skills_write on public.learning_skills;
create policy learning_skills_write on public.learning_skills
for all using (
  public.is_institution_admin(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and exists (
      select 1
      from public.learning_units u
      where u.id = unit_id
        and u.institution_id = institution_id
        and private.learning_teacher_owns_subject(institution_id, u.subject_id)
    )
  )
) with check (
  public.is_institution_admin(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and exists (
      select 1
      from public.learning_units u
      where u.id = unit_id
        and u.institution_id = institution_id
        and private.learning_teacher_owns_subject(institution_id, u.subject_id)
    )
  )
);

drop policy if exists learning_collections_write on public.learning_collections;
create policy learning_collections_write on public.learning_collections
for all using (
  teacher_id = auth.uid()
  and private.learning_is_teacher(institution_id)
  and private.learning_teacher_owns_subject_class(institution_id, subject_id, class_id)
) with check (
  teacher_id = auth.uid()
  and private.learning_is_teacher(institution_id)
  and private.learning_teacher_owns_subject_class(institution_id, subject_id, class_id)
);
