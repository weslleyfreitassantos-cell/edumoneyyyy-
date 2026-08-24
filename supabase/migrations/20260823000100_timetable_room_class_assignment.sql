-- Optional room-to-class assignment for automatic timetable generation.

begin;

alter table public.rooms
  add column if not exists class_id uuid
  references public.classes(id)
  on delete set null;

create index if not exists rooms_class_idx
  on public.rooms (institution_id, class_id)
  where class_id is not null;

create or replace function private.validate_rooms_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.institutions
    where id = new.institution_id
  ) then
    raise exception 'Room institution does not exist.'
      using errcode = '23503';
  end if;

  if new.class_id is not null and not exists (
    select 1 from public.classes
    where id = new.class_id
      and institution_id = new.institution_id
  ) then
    raise exception 'Room class must belong to the same institution.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists rooms_validate_tenant_integrity
  on public.rooms;

create trigger rooms_validate_tenant_integrity
before insert or update of institution_id, class_id
on public.rooms
for each row
execute function private.validate_rooms_tenant_integrity();

revoke all on function private.validate_rooms_tenant_integrity()
  from public, anon, authenticated;

grant execute on function private.validate_rooms_tenant_integrity()
  to service_role;

notify pgrst, 'reload schema';
commit;
