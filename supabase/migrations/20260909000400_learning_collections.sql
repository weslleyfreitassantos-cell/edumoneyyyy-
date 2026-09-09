-- Coleções pedagógicas com recursos externos curados pelo professor.
create table public.learning_collections (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  class_id uuid not null references public.classes(id),
  teacher_id uuid not null references public.profiles(id),
  title text not null,
  description text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_resources (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  collection_id uuid not null references public.learning_collections(id) on delete cascade,
  activity_id uuid references public.learning_activities(id) on delete set null,
  title text not null,
  description text,
  provider text,
  resource_type text not null check (resource_type in ('VIDEO', 'LINK', 'RESOURCE')),
  source_url text not null,
  thumbnail_url text,
  approved boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index learning_collections_class_idx on public.learning_collections(institution_id, class_id, status);
create index learning_resources_collection_idx on public.learning_resources(institution_id, collection_id, approved);

create or replace function private.learning_can_read_collection(target_collection_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.learning_collections c
    where c.id = target_collection_id
      and (
        c.teacher_id = auth.uid()
        or (
          c.status = 'PUBLISHED'
          and exists (
            select 1
            from public.enrollments e
            join public.students s on s.id = e.student_id and s.active
            where e.class_id = c.class_id
              and e.active
              and s.profile_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function private.learning_can_read_resource(target_resource_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.learning_resources r
    where r.id = target_resource_id
      and (
        private.learning_can_read_collection(r.collection_id)
        and (
          r.approved
          or exists (
            select 1
            from public.learning_collections c
            where c.id = r.collection_id
              and c.teacher_id = auth.uid()
          )
        )
      )
  );
$$;

alter table public.learning_collections enable row level security;
alter table public.learning_resources enable row level security;

create policy learning_collections_select on public.learning_collections
for select using (private.learning_can_read_collection(id));

create policy learning_collections_write on public.learning_collections
for all using (
  teacher_id = auth.uid()
  and private.learning_is_teacher(institution_id)
) with check (
  teacher_id = auth.uid()
  and private.learning_is_teacher(institution_id)
);

create policy learning_resources_select on public.learning_resources
for select using (private.learning_can_read_resource(id));

create policy learning_resources_write on public.learning_resources
for all using (
  exists (
    select 1
    from public.learning_collections c
    where c.id = collection_id
      and c.teacher_id = auth.uid()
      and private.learning_is_teacher(c.institution_id)
  )
) with check (
  exists (
    select 1
    from public.learning_collections c
    where c.id = collection_id
      and c.teacher_id = auth.uid()
      and c.institution_id = institution_id
      and private.learning_is_teacher(c.institution_id)
  )
);
