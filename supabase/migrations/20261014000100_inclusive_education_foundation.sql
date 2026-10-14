-- Educação Inclusiva: PEI, AEE/PAEE e histórico.
-- Preparada localmente; não aplicar em produção sem baseline/reconciliação.

create schema if not exists private;

create table public.inclusive_pei_plans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  review_due_on date,
  strengths text not null default '',
  interests text not null default '',
  learning_barriers text not null default '',
  participation_barriers text not null default '',
  pedagogical_objectives text not null default '',
  teaching_strategies text not null default '',
  accessibility_resources text not null default '',
  planned_activities text not null default '',
  monitoring_criteria text not null default '',
  pedagogical_evaluation text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, student_id, academic_year_id)
);

create table public.inclusive_aee_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  professional_profile_id uuid not null references public.profiles(id) on delete restrict,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (institution_id, student_id, professional_profile_id)
);

create table public.inclusive_aee_plans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  pei_plan_id uuid references public.inclusive_pei_plans(id) on delete set null,
  responsible_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  objectives text not null default '',
  resources_used text not null default '',
  pedagogical_observations text not null default '',
  review_due_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inclusive_aee_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  aee_plan_id uuid not null references public.inclusive_aee_plans(id) on delete restrict,
  professional_profile_id uuid not null references public.profiles(id) on delete restrict,
  attended_on date not null,
  objectives text not null default '',
  resources_used text not null default '',
  observations text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.inclusive_document_revisions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  document_type text not null check (document_type in ('PEI', 'AEE')),
  document_id uuid not null,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (document_type, document_id, version)
);

create index inclusive_pei_plans_institution_student_idx on public.inclusive_pei_plans (institution_id, student_id);
create index inclusive_aee_assignments_scope_idx on public.inclusive_aee_assignments (institution_id, professional_profile_id, active);
create index inclusive_aee_plans_scope_idx on public.inclusive_aee_plans (institution_id, student_id);
create index inclusive_aee_sessions_scope_idx on public.inclusive_aee_sessions (institution_id, student_id, attended_on desc);
create index inclusive_document_revisions_document_idx on public.inclusive_document_revisions (institution_id, document_type, document_id, version desc);

create or replace function private.inclusive_is_manager(target_institution_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships membership
    where membership.profile_id = (select auth.uid())
      and membership.institution_id = target_institution_id
      and membership.active is true
      and membership.role in ('ADMIN', 'DIRECTOR')
  );
$$;

create or replace function private.inclusive_member_belongs(target_institution_id uuid, target_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships membership
    where membership.profile_id = target_profile_id
      and membership.institution_id = target_institution_id
      and membership.active is true
      and membership.role in ('ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER')
  );
$$;

create or replace function private.inclusive_document_belongs(target_institution_id uuid, target_document_type text, target_document_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case target_document_type
    when 'PEI' then exists (
      select 1 from public.inclusive_pei_plans plan
      where plan.id = target_document_id
        and plan.institution_id = target_institution_id
    )
    when 'AEE' then exists (
      select 1 from public.inclusive_aee_plans plan
      where plan.id = target_document_id
        and plan.institution_id = target_institution_id
    )
    else false
  end;
$$;

create or replace function private.inclusive_teacher_can_student(target_institution_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.enrollments enrollment
    join public.subject_offerings offering on offering.class_id = enrollment.class_id
    join public.classes class on class.id = offering.class_id
    where enrollment.student_id = target_student_id
      and enrollment.academic_year_id is not null
      and offering.teacher_profile_id = (select auth.uid())
      and class.institution_id = target_institution_id
  );
$$;

create or replace function private.inclusive_aee_can_student(target_institution_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inclusive_aee_assignments assignment
    where assignment.institution_id = target_institution_id
      and assignment.student_id = target_student_id
      and assignment.professional_profile_id = (select auth.uid())
      and assignment.active is true
  );
$$;

create or replace function private.inclusive_student_belongs(target_institution_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students student
    where student.id = target_student_id
      and student.institution_id = target_institution_id
      and student.active is true
  );
$$;

alter table public.inclusive_pei_plans enable row level security;
alter table public.inclusive_aee_assignments enable row level security;
alter table public.inclusive_aee_plans enable row level security;
alter table public.inclusive_aee_sessions enable row level security;
alter table public.inclusive_document_revisions enable row level security;

create policy inclusive_pei_select on public.inclusive_pei_plans for select to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_teacher_can_student(institution_id, student_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);
create policy inclusive_pei_write on public.inclusive_pei_plans for insert to authenticated with check (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_teacher_can_student(institution_id, student_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);
create policy inclusive_pei_update on public.inclusive_pei_plans for update to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_teacher_can_student(institution_id, student_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
) with check (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_teacher_can_student(institution_id, student_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);

create policy inclusive_aee_assignment_select on public.inclusive_aee_assignments for select to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
    private.inclusive_is_manager(institution_id)
    or (
      professional_profile_id = (select auth.uid())
      and private.inclusive_member_belongs(institution_id, professional_profile_id)
    )
  )
);
create policy inclusive_aee_assignment_write on public.inclusive_aee_assignments for all to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and private.inclusive_is_manager(institution_id)
) with check (
  private.inclusive_student_belongs(institution_id, student_id)
  and private.inclusive_member_belongs(institution_id, professional_profile_id)
  and private.inclusive_is_manager(institution_id)
);

create policy inclusive_aee_plan_select on public.inclusive_aee_plans for select to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);
create policy inclusive_aee_plan_write on public.inclusive_aee_plans for insert to authenticated with check (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);
create policy inclusive_aee_plan_update on public.inclusive_aee_plans for update to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
) with check (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);

create policy inclusive_aee_session_select on public.inclusive_aee_sessions for select to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);
create policy inclusive_aee_session_write on public.inclusive_aee_sessions for all to authenticated using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
) with check (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
  private.inclusive_is_manager(institution_id)
  or private.inclusive_aee_can_student(institution_id, student_id)
  )
);

create policy inclusive_revision_select on public.inclusive_document_revisions for select to authenticated using (
  private.inclusive_is_manager(institution_id)
  and private.inclusive_document_belongs(institution_id, document_type, document_id)
);
create policy inclusive_revision_insert on public.inclusive_document_revisions for insert to authenticated with check (
  private.inclusive_is_manager(institution_id)
  and private.inclusive_document_belongs(institution_id, document_type, document_id)
  and changed_by = (select auth.uid())
);

grant usage on schema private to authenticated, service_role;
revoke all on function private.inclusive_is_manager(uuid) from public, anon, authenticated;
revoke all on function private.inclusive_member_belongs(uuid, uuid) from public, anon, authenticated;
revoke all on function private.inclusive_document_belongs(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.inclusive_teacher_can_student(uuid, uuid) from public, anon, authenticated;
revoke all on function private.inclusive_aee_can_student(uuid, uuid) from public, anon, authenticated;
revoke all on function private.inclusive_student_belongs(uuid, uuid) from public, anon, authenticated;
grant execute on function private.inclusive_is_manager(uuid) to authenticated;
grant execute on function private.inclusive_member_belongs(uuid, uuid) to authenticated;
grant execute on function private.inclusive_document_belongs(uuid, text, uuid) to authenticated;
grant execute on function private.inclusive_teacher_can_student(uuid, uuid) to authenticated;
grant execute on function private.inclusive_aee_can_student(uuid, uuid) to authenticated;
grant execute on function private.inclusive_student_belongs(uuid, uuid) to authenticated;
