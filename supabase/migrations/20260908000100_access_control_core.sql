create table if not exists public.access_devices (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null, provider text not null, model text,
  status text not null default 'OFFLINE' check (status in ('ONLINE','OFFLINE','ERROR')),
  endpoint text, direction_entry text not null default 'LEFT', direction_exit text not null default 'RIGHT',
  last_seen_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.access_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid references public.students(id), device_id uuid references public.access_devices(id),
  provider text not null, provider_event_id text not null, event_type text not null,
  direction text, occurred_at timestamptz not null, received_at timestamptz not null default now(),
  identification_method text, status text, raw_payload jsonb,
  unique(provider, device_id, provider_event_id)
);
create index if not exists access_events_institution_time_idx on public.access_events(institution_id, occurred_at desc);
alter table public.access_devices enable row level security;
alter table public.access_events enable row level security;
create policy access_devices_staff on public.access_devices for all using (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=access_devices.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY'))) with check (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=access_devices.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY')));
create policy access_events_staff on public.access_events for select using (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=access_events.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY')));
