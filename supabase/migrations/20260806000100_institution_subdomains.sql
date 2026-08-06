-- Add subdomain column to institutions table
alter table public.institutions
  add column if not exists subdomain text;

-- Add check constraint for valid subdomain format (lowercased alphanumeric + hyphens, no leading/trailing hyphen)
alter table public.institutions
  drop constraint if exists institutions_subdomain_format_check;

alter table public.institutions
  add constraint institutions_subdomain_format_check
  check (subdomain is null or subdomain ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Create unique index on subdomain (ignoring nulls)
drop index if exists public.institutions_subdomain_idx;

create unique index institutions_subdomain_idx
  on public.institutions (subdomain)
  where subdomain is not null;

-- Grant column update privilege on subdomain to authenticated role
grant update (subdomain)
  on table public.institutions
  to authenticated;
