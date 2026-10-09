begin;

create table public.student_writing_drafts (
  id uuid primary key default extensions.uuid_generate_v4(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  client_id text not null check (char_length(trim(client_id)) between 1 and 160),
  name text not null check (char_length(trim(name)) between 1 and 80),
  theme text not null check (char_length(trim(theme)) between 1 and 300),
  text text not null default '' check (char_length(text) <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, client_id)
);

create index student_writing_drafts_profile_updated_idx
  on public.student_writing_drafts(profile_id, updated_at desc);

create or replace function private.set_student_writing_draft_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger student_writing_drafts_set_updated_at
before update on public.student_writing_drafts
for each row
execute function private.set_student_writing_draft_updated_at();

alter table public.student_writing_drafts enable row level security;

create policy student_writing_drafts_select
  on public.student_writing_drafts for select to authenticated
  using (profile_id = auth.uid());

create policy student_writing_drafts_insert
  on public.student_writing_drafts for insert to authenticated
  with check (profile_id = auth.uid());

create policy student_writing_drafts_update
  on public.student_writing_drafts for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy student_writing_drafts_delete
  on public.student_writing_drafts for delete to authenticated
  using (profile_id = auth.uid());

revoke all on table public.student_writing_drafts from public, anon;
grant select, insert, update, delete on table public.student_writing_drafts to authenticated;
grant all on table public.student_writing_drafts to service_role;

revoke all on function private.set_student_writing_draft_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
