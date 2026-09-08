create or replace function private.valid_camera_host(target_host text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_host is not null
    and length(btrim(target_host)) between 1 and 253
    and target_host !~ '[[:space:]/?#@]'
    and lower(target_host) not in ('0.0.0.0')
    and target_host !~* '(^|\.)169\.254\.';
$$;

notify pgrst, 'reload schema';
