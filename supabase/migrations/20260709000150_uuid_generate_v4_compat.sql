-- Compatibilidade para migrations antigas que usam uuid_generate_v4()
-- sem schema qualificado.

create extension if not exists "uuid-ossp" with schema extensions;

create or replace function public.uuid_generate_v4()
returns uuid
language sql
volatile
parallel safe
set search_path = ''
as $$
  select extensions.uuid_generate_v4();
$$;

revoke all on function public.uuid_generate_v4() from public;
grant execute on function public.uuid_generate_v4() to postgres, service_role;