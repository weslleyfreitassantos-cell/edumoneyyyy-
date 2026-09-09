-- Central de aprendizagem: usa subjects/classes/enrollments existentes.
create table public.learning_units (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, subject_id, title)
);

create table public.learning_skills (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  unit_id uuid not null references public.learning_units(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, unit_id, title)
);

create table public.learning_activities (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  unit_id uuid references public.learning_units(id),
  skill_id uuid references public.learning_skills(id),
  teacher_id uuid not null references public.profiles(id),
  title text not null,
  description text,
  activity_type text not null default 'PRACTICE' check (activity_type in ('PRACTICE', 'REINFORCEMENT')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_questions (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'MULTIPLE_CHOICE' check (question_type in ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER')),
  options_json jsonb not null default '[]'::jsonb,
  correct_answer_json jsonb not null,
  explanation text,
  points integer not null default 1 check (points > 0),
  sort_order integer not null default 0
);

create table public.learning_assignments (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (activity_id, class_id)
);

create table public.learning_attempts (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score integer not null default 0,
  total_points integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (activity_id, student_id)
);

create table public.learning_answers (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  attempt_id uuid not null references public.learning_attempts(id) on delete cascade,
  question_id uuid not null references public.learning_questions(id) on delete cascade,
  answer_json jsonb not null,
  is_correct boolean not null default false,
  points_awarded integer not null default 0,
  unique (attempt_id, question_id)
);

create table public.learning_skill_progress (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.learning_skills(id) on delete cascade,
  mastery_percent integer not null default 0 check (mastery_percent between 0 and 100),
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED', 'IN_PROGRESS', 'MASTERED')),
  last_activity_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (institution_id, student_id, skill_id)
);

create index learning_units_subject_idx on public.learning_units(institution_id, subject_id, active);
create index learning_skills_unit_idx on public.learning_skills(institution_id, unit_id, active);
create index learning_activities_teacher_idx on public.learning_activities(institution_id, teacher_id, status);
create index learning_assignments_class_idx on public.learning_assignments(institution_id, class_id);
create index learning_attempts_student_idx on public.learning_attempts(institution_id, student_id);

create or replace function private.learning_is_teacher(target_institution_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1 from public.memberships m
    where m.profile_id = auth.uid()
      and m.institution_id = target_institution_id
      and m.role = 'TEACHER'::public.user_role
      and m.active
  );
$$;

create or replace function private.learning_is_assigned_student(target_activity_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.learning_assignments a
    join public.enrollments e on e.class_id = a.class_id and e.active
    join public.students s on s.id = e.student_id and s.active
    where a.activity_id = target_activity_id
      and s.id = target_student_id
      and s.profile_id = auth.uid()
  );
$$;

alter table public.learning_units enable row level security;
alter table public.learning_skills enable row level security;
alter table public.learning_activities enable row level security;
alter table public.learning_questions enable row level security;
alter table public.learning_assignments enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_answers enable row level security;
alter table public.learning_skill_progress enable row level security;

create policy learning_units_select on public.learning_units for select using (public.can_access_institution(institution_id));
create policy learning_units_write on public.learning_units for all using (private.learning_is_teacher(institution_id) or public.is_institution_admin(institution_id)) with check (private.learning_is_teacher(institution_id) or public.is_institution_admin(institution_id));
create policy learning_skills_select on public.learning_skills for select using (public.can_access_institution(institution_id));
create policy learning_skills_write on public.learning_skills for all using (private.learning_is_teacher(institution_id) or public.is_institution_admin(institution_id)) with check (private.learning_is_teacher(institution_id) or public.is_institution_admin(institution_id));
create policy learning_activities_select on public.learning_activities for select using ((status = 'PUBLISHED' and public.can_access_institution(institution_id)) or teacher_id = auth.uid());
create policy learning_activities_write on public.learning_activities for all using (teacher_id = auth.uid() and private.learning_is_teacher(institution_id)) with check (teacher_id = auth.uid() and private.learning_is_teacher(institution_id));
create policy learning_questions_select on public.learning_questions for select using (exists (select 1 from public.learning_activities a where a.id = activity_id and ((a.status = 'PUBLISHED' and public.can_access_institution(a.institution_id)) or a.teacher_id = auth.uid())));
create policy learning_questions_write on public.learning_questions for all using (exists (select 1 from public.learning_activities a where a.id = activity_id and a.teacher_id = auth.uid())) with check (exists (select 1 from public.learning_activities a where a.id = activity_id and a.teacher_id = auth.uid()));
create policy learning_assignments_select on public.learning_assignments for select using (public.can_access_institution(institution_id));
create policy learning_assignments_insert on public.learning_assignments for insert with check (assigned_by = auth.uid() and exists (select 1 from public.learning_activities a join public.subject_offerings so on so.subject_id = a.subject_id and so.class_id = learning_assignments.class_id and so.teacher_profile_id = auth.uid() where a.id = activity_id and a.institution_id = institution_id));
create policy learning_attempts_select on public.learning_attempts for select using (exists (select 1 from public.students s where s.id = student_id and (s.profile_id = auth.uid() or private.learning_is_teacher(institution_id))));
create policy learning_answers_select on public.learning_answers for select using (exists (select 1 from public.learning_attempts a where a.id = attempt_id and (exists (select 1 from public.students s where s.id = a.student_id and s.profile_id = auth.uid()) or private.learning_is_teacher(a.institution_id))));
create policy learning_progress_select on public.learning_skill_progress for select using (exists (select 1 from public.students s where s.id = student_id and (s.profile_id = auth.uid() or private.learning_is_teacher(institution_id))));

create or replace function public.submit_learning_attempt(p_activity_id uuid, p_answers jsonb)
returns table(attempt_id uuid, score integer, total_points integer, mastery_percent integer)
language plpgsql security invoker set search_path = public, private
as $$
declare
  v_activity public.learning_activities%rowtype;
  v_student public.students%rowtype;
  v_attempt uuid;
  v_total integer := 0;
  v_score integer := 0;
  v_skill uuid;
  v_percent integer;
begin
  select * into v_activity from public.learning_activities where id = p_activity_id and status = 'PUBLISHED';
  if not found then raise exception 'Atividade indisponível.'; end if;
  select s.* into v_student from public.students s where s.profile_id = auth.uid() and s.institution_id = v_activity.institution_id and s.active;
  if not found or not private.learning_is_assigned_student(p_activity_id, v_student.id) then raise exception 'Aluno não possui acesso a esta atividade.'; end if;
  select coalesce(sum(points), 0), skill_id into v_total, v_skill from public.learning_questions where activity_id = p_activity_id group by skill_id;
  insert into public.learning_attempts(institution_id, activity_id, student_id, total_points, completed_at) values (v_activity.institution_id, p_activity_id, v_student.id, v_total, now()) on conflict (activity_id, student_id) do update set started_at = now(), completed_at = now(), total_points = excluded.total_points returning id into v_attempt;
  delete from public.learning_answers where attempt_id = v_attempt;
  insert into public.learning_answers(institution_id, attempt_id, question_id, answer_json, is_correct, points_awarded)
    select v_activity.institution_id, v_attempt, q.id, item->'answer', q.correct_answer_json = item->'answer', case when q.correct_answer_json = item->'answer' then q.points else 0 end
    from public.learning_questions q join jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item on (item->>'question_id')::uuid = q.id where q.activity_id = p_activity_id;
  select coalesce(sum(points_awarded), 0) into v_score from public.learning_answers where attempt_id = v_attempt;
  update public.learning_attempts set score = v_score where id = v_attempt;
  if v_skill is not null then
    v_percent := case when v_total = 0 then 0 else least(100, round(v_score * 100.0 / v_total)::integer) end;
    insert into public.learning_skill_progress(institution_id, student_id, skill_id, mastery_percent, status, last_activity_at) values (v_activity.institution_id, v_student.id, v_skill, v_percent, case when v_percent >= 80 then 'MASTERED' when v_percent > 0 then 'IN_PROGRESS' else 'NOT_STARTED' end, now()) on conflict (institution_id, student_id, skill_id) do update set mastery_percent = excluded.mastery_percent, status = excluded.status, last_activity_at = excluded.last_activity_at, updated_at = now();
  end if;
  return query select v_attempt, v_score, v_total, coalesce(v_percent, 0);
end;
$$;

revoke all on function public.submit_learning_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_learning_attempt(uuid, jsonb) to authenticated, service_role;
