-- Add subdomain, primary_color, and secondary_color columns to institutions table
alter table public.institutions
  add column if not exists subdomain text,
  add column if not exists primary_color text,
  add column if not exists secondary_color text;

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

-- Grant column update privileges for subdomain and branding columns to authenticated role
grant update (subdomain, logo_url, primary_color, secondary_color, updated_at)
  on table public.institutions
  to authenticated;
