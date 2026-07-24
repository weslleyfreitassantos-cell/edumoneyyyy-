begin;

-- Recria as funções auxiliares que estavam ausentes em produção
create or replace function public.normalize_branding_hostname(input_hostname text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      btrim(coalesce(input_hostname, '')),
      '\.$',
      ''
    )
  );
$$;

create or replace function public.is_reserved_branding_hostname(input_hostname text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.normalize_branding_hostname(input_hostname) in (
    'localhost',
    '127.0.0.1',
    'edumoneyyyy.weslleyfreitassantos.workers.dev',
    'www.edumoneyyyy.weslleyfreitassantos.workers.dev',
    'edumoneyyyy.pages.dev',
    'edumoneyyyy-preview.pages.dev'
  )
  or public.normalize_branding_hostname(input_hostname) like '%.localhost'
  or public.normalize_branding_hostname(input_hostname) like '%.local'
  or public.normalize_branding_hostname(input_hostname) like '%.pages.dev';
$$;

-- Garante grants das funções auxiliares
revoke all on function public.normalize_branding_hostname(text)
  from public, anon, authenticated;

revoke all on function public.is_reserved_branding_hostname(text)
  from public, anon, authenticated;

grant execute on function public.normalize_branding_hostname(text)
  to authenticated, service_role;

grant execute on function public.is_reserved_branding_hostname(text)
  to authenticated, service_role;

-- Reconfirma grants da RPC pública
revoke all on function public.resolve_public_branding(text)
  from public, anon, authenticated;

grant execute on function public.resolve_public_branding(text)
  to anon, authenticated, service_role;

-- Corrige a policy de INSERT para aceitar o primeiro branding GLOBAL
-- sem exigir que já exista um registro.
drop policy if exists branding_settings_insert_policy
  on public.branding_settings;

create policy branding_settings_insert_policy
on public.branding_settings
for insert
to authenticated
with check (
  (
    scope_type = 'GLOBAL'
    and account_id is null
    and public.is_platform_super_admin()
  )
  or (
    scope_type = 'ACCOUNT'
    and account_id is not null
    and (
      public.is_platform_super_admin()
      or public.owns_account(account_id)
    )
  )
);

-- Recarrega o cache do PostgREST para registrar as novas funções
notify pgrst, 'reload schema';

commit;