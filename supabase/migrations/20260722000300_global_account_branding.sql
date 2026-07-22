begin;

insert into storage.buckets (id, name, public)
values ('institution-branding', 'institution-branding', true)
on conflict (id) do update
set public = excluded.public;

-- Storage paths used by the frontend:
-- branding/global/logo/<uuid>.<ext>
-- branding/global/favicon/<uuid>.<ext>
-- branding/accounts/{accountId}/logo/<uuid>.<ext>
-- branding/accounts/{accountId}/favicon/<uuid>.<ext>

create table if not exists public.branding_settings (
  id uuid primary key default extensions.uuid_generate_v4(),
  scope_type text not null,
  account_id uuid null references public.accounts(id) on delete cascade,
  display_name text null,
  logo_url text null,
  logo_path text null,
  favicon_url text null,
  favicon_path text null,
  primary_color text not null default '#005bbf',
  secondary_color text not null default '#6ffbbe',
  created_by uuid null references public.profiles(id),
  updated_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint branding_settings_scope_type_check
    check (scope_type in ('GLOBAL', 'ACCOUNT')),

  constraint branding_settings_scope_account_check
    check (
      (scope_type = 'GLOBAL' and account_id is null)
      or (scope_type = 'ACCOUNT' and account_id is not null)
    ),

  constraint branding_settings_display_name_not_blank
    check (
      display_name is null
      or length(btrim(display_name)) > 0
    ),

  constraint branding_settings_primary_color_hex
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),

  constraint branding_settings_secondary_color_hex
    check (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index if not exists branding_settings_one_global_idx
  on public.branding_settings ((scope_type))
  where scope_type = 'GLOBAL';

create unique index if not exists branding_settings_one_account_idx
  on public.branding_settings (account_id)
  where scope_type = 'ACCOUNT';

create index if not exists branding_settings_scope_type_idx
  on public.branding_settings(scope_type);

create index if not exists branding_settings_account_id_idx
  on public.branding_settings(account_id);

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

create table if not exists public.account_domains (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  hostname text not null,
  status text not null default 'PENDING',
  is_primary boolean not null default false,
  requested_by uuid null references public.profiles(id),
  activated_by uuid null references public.profiles(id),
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint account_domains_status_check
    check (status in ('PENDING', 'ACTIVE', 'DISABLED')),

  constraint account_domains_hostname_normalized
    check (hostname = public.normalize_branding_hostname(hostname)),

  constraint account_domains_hostname_not_blank
    check (length(hostname) > 0),

  constraint account_domains_hostname_no_protocol_path_or_query
    check (hostname !~ '[:/?#[:space:]]'),

  constraint account_domains_hostname_shape
    check (
      hostname ~
      '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$'
    ),

  constraint account_domains_hostname_not_reserved
    check (not public.is_reserved_branding_hostname(hostname))
);

create unique index if not exists account_domains_hostname_unique_idx
  on public.account_domains (lower(hostname));

create unique index if not exists account_domains_one_primary_per_account_idx
  on public.account_domains (account_id)
  where is_primary is true;

create index if not exists account_domains_status_idx
  on public.account_domains(status);

create index if not exists account_domains_account_id_idx
  on public.account_domains(account_id);

create or replace function private.touch_branding_settings_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
  else
    new.created_by = old.created_by;
    new.updated_by = coalesce(auth.uid(), old.updated_by);
    new.updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists branding_settings_touch_audit
  on public.branding_settings;

create trigger branding_settings_touch_audit
before insert or update on public.branding_settings
for each row
execute function private.touch_branding_settings_audit();

create or replace function private.touch_account_domains_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.hostname = public.normalize_branding_hostname(new.hostname);

  if tg_op = 'INSERT' then
    new.requested_by = coalesce(new.requested_by, auth.uid());
  else
    new.requested_by = old.requested_by;
    new.updated_at = now();
  end if;

  if new.status = 'ACTIVE'
      and (tg_op = 'INSERT' or old.status is distinct from 'ACTIVE') then
    new.activated_by = coalesce(new.activated_by, auth.uid());
    new.verified_at = coalesce(new.verified_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists account_domains_touch_audit
  on public.account_domains;

create trigger account_domains_touch_audit
before insert or update on public.account_domains
for each row
execute function private.touch_account_domains_audit();

create or replace function public.resolve_public_branding(hostname text)
returns table (
  scope text,
  display_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_hostname text;
  global_branding public.branding_settings%rowtype;
  account_branding public.branding_settings%rowtype;
begin
  normalized_hostname := public.normalize_branding_hostname(hostname);

  select *
  into global_branding
  from public.branding_settings as branding
  where branding.scope_type = 'GLOBAL'
    and branding.account_id is null
  limit 1;

  if normalized_hostname <> ''
      and normalized_hostname <> 'edumoneyyyy.weslleyfreitassantos.workers.dev' then
    select branding.*
    into account_branding
    from public.account_domains as domain
    join public.branding_settings as branding
      on branding.account_id = domain.account_id
     and branding.scope_type = 'ACCOUNT'
    where lower(domain.hostname) = normalized_hostname
      and domain.status = 'ACTIVE'
    limit 1;

    if account_branding.id is not null then
      return query
      select
        'ACCOUNT'::text,
        coalesce(account_branding.display_name, global_branding.display_name),
        coalesce(account_branding.logo_url, global_branding.logo_url),
        coalesce(account_branding.favicon_url, global_branding.favicon_url),
        coalesce(account_branding.primary_color, global_branding.primary_color, '#005bbf'),
        coalesce(account_branding.secondary_color, global_branding.secondary_color, '#6ffbbe');
      return;
    end if;
  end if;

  if global_branding.id is not null then
    return query
    select
      'GLOBAL'::text,
      global_branding.display_name,
      global_branding.logo_url,
      global_branding.favicon_url,
      coalesce(global_branding.primary_color, '#005bbf'),
      coalesce(global_branding.secondary_color, '#6ffbbe');
    return;
  end if;

  return query
  select
    'FALLBACK'::text,
    null::text,
    null::text,
    null::text,
    '#005bbf'::text,
    '#6ffbbe'::text;
end;
$$;

create or replace function public.can_write_branding_storage_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
  target_account_id uuid;
begin
  folders := storage.foldername(object_name);

  if coalesce(folders[1], '') <> 'branding' then
    return false;
  end if;

  if folders[2] = 'global' then
    return
      public.is_platform_super_admin()
      and folders[3] in ('logo', 'favicon');
  end if;

  if folders[2] = 'accounts' then
    if coalesce(folders[3], '') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      return false;
    end if;

    target_account_id := folders[3]::uuid;

    return
      folders[4] in ('logo', 'favicon')
      and (
        public.is_platform_super_admin()
        or public.owns_account(target_account_id)
      );
  end if;

  return false;
end;
$$;

alter table public.branding_settings
  enable row level security;

alter table public.account_domains
  enable row level security;

drop policy if exists branding_settings_select_policy
  on public.branding_settings;

create policy branding_settings_select_policy
on public.branding_settings
for select
to authenticated
using (
  public.is_platform_super_admin()
  or scope_type = 'GLOBAL'
  or (
    scope_type = 'ACCOUNT'
    and public.owns_account(account_id)
  )
);

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

drop policy if exists branding_settings_update_policy
  on public.branding_settings;

create policy branding_settings_update_policy
on public.branding_settings
for update
to authenticated
using (
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
)
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

drop policy if exists branding_settings_delete_policy
  on public.branding_settings;

create policy branding_settings_delete_policy
on public.branding_settings
for delete
to authenticated
using (
  public.is_platform_super_admin()
  or (
    scope_type = 'ACCOUNT'
    and public.owns_account(account_id)
  )
);

drop policy if exists account_domains_select_policy
  on public.account_domains;

create policy account_domains_select_policy
on public.account_domains
for select
to authenticated
using (
  public.is_platform_super_admin()
  or public.owns_account(account_id)
);

drop policy if exists account_domains_insert_policy
  on public.account_domains;

create policy account_domains_insert_policy
on public.account_domains
for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (
    public.owns_account(account_id)
    and status = 'PENDING'
    and activated_by is null
    and verified_at is null
  )
);

drop policy if exists account_domains_update_policy
  on public.account_domains;

create policy account_domains_update_policy
on public.account_domains
for update
to authenticated
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

drop policy if exists account_domains_delete_policy
  on public.account_domains;

create policy account_domains_delete_policy
on public.account_domains
for delete
to authenticated
using (public.is_platform_super_admin());

drop policy if exists branding_storage_write_policy
  on storage.objects;

create policy branding_storage_write_policy
on storage.objects
for all
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.can_write_branding_storage_object(name)
)
with check (
  bucket_id = 'institution-branding'
  and public.can_write_branding_storage_object(name)
);

revoke all on table public.branding_settings
  from public, anon, authenticated;

revoke all on table public.account_domains
  from public, anon, authenticated;

grant select, insert, update, delete on table public.branding_settings
  to authenticated;

grant select, insert, update, delete on table public.account_domains
  to authenticated;

grant all on table public.branding_settings
  to service_role;

grant all on table public.account_domains
  to service_role;

revoke all on function public.normalize_branding_hostname(text)
  from public, anon, authenticated;

revoke all on function public.is_reserved_branding_hostname(text)
  from public, anon, authenticated;

revoke all on function public.resolve_public_branding(text)
  from public, anon, authenticated;

revoke all on function public.can_write_branding_storage_object(text)
  from public, anon, authenticated;

revoke all on function private.touch_branding_settings_audit()
  from public, anon, authenticated;

revoke all on function private.touch_account_domains_audit()
  from public, anon, authenticated;

grant execute on function public.normalize_branding_hostname(text)
  to authenticated, service_role;

grant execute on function public.is_reserved_branding_hostname(text)
  to authenticated, service_role;

grant execute on function public.resolve_public_branding(text)
  to anon, authenticated, service_role;

grant execute on function public.can_write_branding_storage_object(text)
  to authenticated, service_role;

grant execute on function private.touch_branding_settings_audit()
  to service_role;

grant execute on function private.touch_account_domains_audit()
  to service_role;

commit;
