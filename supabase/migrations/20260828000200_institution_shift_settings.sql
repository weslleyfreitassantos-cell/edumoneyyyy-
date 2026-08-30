-- Institution-wide academic shifts used by classes and school time slots.
-- The UI exposes this configuration inside Academic Policy, but the scope is
-- institutional because school_time_slots is shared by academic years.
-- Existing records are intentionally not rewritten by this migration. The
-- application infers their current shifts until an administrator saves this
-- configuration explicitly.

begin;

create table if not exists public.institution_shift_settings (
  institution_id uuid primary key
    references public.institutions(id)
    on delete cascade,
  enabled_shifts text[] not null default array['MATUTINO']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_shift_settings_not_empty
    check (cardinality(enabled_shifts) between 1 and 4),
  constraint institution_shift_settings_supported
    check (enabled_shifts <@ array[
      'MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO'
    ]::text[])
);

comment on table public.institution_shift_settings is
  'Institution-wide academic shifts allowed for classes and school time slots.';

create trigger institution_shift_settings_touch_updated_at
before update on public.institution_shift_settings
for each row
execute function public.touch_academic_record_updated_at();

alter table public.institution_shift_settings enable row level security;
revoke all on table public.institution_shift_settings from anon;
grant select, insert, update on table public.institution_shift_settings to authenticated;

drop policy if exists institution_shift_settings_select_policy
  on public.institution_shift_settings;
create policy institution_shift_settings_select_policy
on public.institution_shift_settings
for select to authenticated
using (public.can_access_institution(institution_id));

drop policy if exists institution_shift_settings_insert_policy
  on public.institution_shift_settings;
create policy institution_shift_settings_insert_policy
on public.institution_shift_settings
for insert to authenticated
with check (public.is_institution_admin(institution_id));

drop policy if exists institution_shift_settings_update_policy
  on public.institution_shift_settings;
create policy institution_shift_settings_update_policy
on public.institution_shift_settings
for update to authenticated
using (public.is_institution_admin(institution_id))
with check (public.is_institution_admin(institution_id));

notify pgrst, 'reload schema';
commit;
