-- Endurece o escopo de leitura e permite que o RPC grave tentativas com RLS ativo.
create or replace function private.learning_is_activity_teacher(target_activity_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.learning_activities a
    where a.id = target_activity_id
      and a.teacher_id = auth.uid()
  );
$$;

create or replace function private.learning_can_read_activity(target_activity_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select private.learning_is_activity_teacher(target_activity_id)
    or exists (
      select 1
      from public.learning_assignments la
      join public.enrollments e on e.class_id = la.class_id and e.active
      join public.students s on s.id = e.student_id and s.active
      join public.learning_activities a on a.id = la.activity_id and a.status = 'PUBLISHED'
      where la.activity_id = target_activity_id
        and s.profile_id = auth.uid()
    );
$$;

create or replace function private.learning_can_read_assignment(target_assignment_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.learning_assignments la
    where la.id = target_assignment_id
      and (
        la.assigned_by = auth.uid()
        or private.learning_is_activity_teacher(la.activity_id)
        or exists (
          select 1
          from public.enrollments e
          join public.students s on s.id = e.student_id and e.active and s.active
          where e.class_id = la.class_id
            and s.profile_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists learning_activities_select on public.learning_activities;
create policy learning_activities_select on public.learning_activities
for select using (private.learning_can_read_activity(id));

drop policy if exists learning_questions_select on public.learning_questions;
create policy learning_questions_select on public.learning_questions
for select using (private.learning_can_read_activity(activity_id));

drop policy if exists learning_assignments_select on public.learning_assignments;
create policy learning_assignments_select on public.learning_assignments
for select using (private.learning_can_read_assignment(id));

drop policy if exists learning_assignments_insert on public.learning_assignments;
create policy learning_assignments_insert on public.learning_assignments
for insert with check (
  assigned_by = auth.uid()
  and exists (
    select 1
    from public.learning_activities a
    join public.subject_offerings so
      on so.subject_id = a.subject_id
     and so.class_id = learning_assignments.class_id
     and so.teacher_profile_id = auth.uid()
    where a.id = activity_id
      and a.institution_id = institution_id
      and a.teacher_id = auth.uid()
  )
);

drop policy if exists learning_attempts_select on public.learning_attempts;
create policy learning_attempts_select on public.learning_attempts
for select using (
  exists (
      select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
  )
  or exists (
    select 1 where private.learning_is_activity_teacher(activity_id)
  )
);

create policy learning_attempts_insert on public.learning_attempts
for insert with check (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
      and s.institution_id = institution_id
  )
  and private.learning_is_assigned_student(activity_id, student_id)
);

create policy learning_attempts_update on public.learning_attempts
for update using (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
  )
);

drop policy if exists learning_answers_select on public.learning_answers;
create policy learning_answers_select on public.learning_answers
for select using (
  exists (
    select 1
    from public.learning_attempts at
    join public.students s on s.id = at.student_id
    where at.id = attempt_id
      and (
        s.profile_id = auth.uid()
        or exists (
          select 1
          where private.learning_is_activity_teacher(at.activity_id)
        )
      )
  )
);

create policy learning_answers_insert on public.learning_answers
for insert with check (
  exists (
    select 1
    from public.learning_attempts at
    join public.students s on s.id = at.student_id
    where at.id = attempt_id
      and s.profile_id = auth.uid()
  )
);

create policy learning_answers_delete on public.learning_answers
for delete using (
  exists (
    select 1
    from public.learning_attempts at
    join public.students s on s.id = at.student_id
    where at.id = attempt_id
      and s.profile_id = auth.uid()
  )
);

drop policy if exists learning_progress_select on public.learning_skill_progress;
create policy learning_progress_select on public.learning_skill_progress
for select using (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.learning_activities a
    where a.skill_id = learning_skill_progress.skill_id
      and a.teacher_id = auth.uid()
  )
);

create policy learning_progress_insert on public.learning_skill_progress
for insert with check (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
      and s.institution_id = institution_id
  )
);

create policy learning_progress_update on public.learning_skill_progress
for update using (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.students s
    where s.id = student_id
      and s.profile_id = auth.uid()
  )
);

alter function public.submit_learning_attempt(uuid, jsonb) security definer;
