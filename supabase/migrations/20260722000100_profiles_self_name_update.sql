drop policy if exists profiles_update_own_name_policy
  on public.profiles;

create policy profiles_update_own_name_policy
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
  and full_name = btrim(full_name)
  and char_length(full_name) between 2 and 120
);

revoke update on table public.profiles
  from authenticated;

grant update (full_name) on table public.profiles
  to authenticated;
