begin;

create table public.learning_curriculum_units (
  id uuid primary key default extensions.uuid_generate_v4(),
  catalog_id uuid not null references public.learning_curriculum_catalogs(id) on delete restrict,
  code text not null,
  title text not null,
  description text,
  stage text not null check (stage in ('EDUCACAO_INFANTIL', 'FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'ENSINO_MEDIO')),
  subject_area text not null,
  domain text,
  grade_from smallint,
  grade_to smallint,
  official_codes text[] not null default '{}'::text[],
  bncc_alignment_status text not null default 'NOT_CLAIMED'
    check (bncc_alignment_status in ('NOT_CLAIMED', 'MAPPING_PENDING', 'MAPPED')),
  pedagogical_review_status text not null default 'PEDAGOGICAL_REVIEW_PENDING'
    check (pedagogical_review_status in ('PEDAGOGICAL_REVIEW_PENDING', 'PEDAGOGICALLY_REVIEWED')),
  publication_status text not null default 'STAGING'
    check (publication_status in ('STAGING', 'PUBLISHED', 'RETIRED')),
  active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_curriculum_units_code_unique unique (catalog_id, code),
  constraint learning_curriculum_units_grade_range_check check (
    (grade_from is null and grade_to is null)
    or (grade_from is not null and grade_to is not null and grade_from between 1 and 12 and grade_to between grade_from and 12)
  ),
  constraint learning_curriculum_units_mapping_claim_check check (
    (cardinality(official_codes) = 0 and bncc_alignment_status <> 'MAPPED')
    or (cardinality(official_codes) > 0 and bncc_alignment_status = 'MAPPED')
  ),
  constraint learning_curriculum_units_active_review_check check (
    active is false or (
      publication_status = 'PUBLISHED'
      and pedagogical_review_status = 'PEDAGOGICALLY_REVIEWED'
      and (cardinality(official_codes) = 0 or bncc_alignment_status = 'MAPPED')
    )
  )
);

create table public.learning_curriculum_unit_skills (
  id uuid primary key default extensions.uuid_generate_v4(),
  unit_id uuid not null references public.learning_curriculum_units(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  position integer not null check (position > 0),
  active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_curriculum_unit_skills_unique unique (unit_id, canonical_skill_id),
  constraint learning_curriculum_unit_skills_position_unique unique (unit_id, position)
);

create index learning_curriculum_units_discovery_idx
  on public.learning_curriculum_units(catalog_id, active, stage, subject_area, grade_from, grade_to);
create index learning_curriculum_unit_skills_skill_idx
  on public.learning_curriculum_unit_skills(canonical_skill_id, active, unit_id);

create or replace function private.validate_learning_curriculum_unit_skill_v4()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unit_catalog_id uuid;
  skill_catalog_id uuid;
  unit_is_active boolean;
  skill_is_active boolean;
begin
  select unit.catalog_id, unit.active
    into unit_catalog_id, unit_is_active
  from public.learning_curriculum_units unit
  where unit.id = new.unit_id;

  select skill.catalog_id, skill.active
    into skill_catalog_id, skill_is_active
  from public.learning_curriculum_skills skill
  where skill.id = new.canonical_skill_id;

  if unit_catalog_id is null or skill_catalog_id is null or unit_catalog_id <> skill_catalog_id then
    raise exception 'LEARNING_CURRICULUM_UNIT_SKILL_CATALOG_MISMATCH' using errcode = '23514';
  end if;

  if new.active is true and (unit_is_active is not true or skill_is_active is not true) then
    raise exception 'LEARNING_CURRICULUM_UNIT_SKILL_REQUIRES_ACTIVE_PARENTS' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger learning_curriculum_unit_skills_validate_scope
before insert or update on public.learning_curriculum_unit_skills
for each row execute function private.validate_learning_curriculum_unit_skill_v4();

alter table public.learning_curriculum_units enable row level security;
alter table public.learning_curriculum_unit_skills enable row level security;

create policy learning_curriculum_units_published_select
  on public.learning_curriculum_units for select to authenticated
  using (active is true and exists (
    select 1 from public.learning_curriculum_catalogs catalog
    where catalog.id = catalog_id and catalog.active is true
  ));

create policy learning_curriculum_unit_skills_published_select
  on public.learning_curriculum_unit_skills for select to authenticated
  using (active is true and exists (
    select 1
    from public.learning_curriculum_units unit
    join public.learning_curriculum_catalogs catalog on catalog.id = unit.catalog_id and catalog.active is true
    join public.learning_curriculum_skills skill on skill.id = canonical_skill_id and skill.active is true
    where unit.id = unit_id and unit.active is true
  ));

revoke all on public.learning_curriculum_units, public.learning_curriculum_unit_skills from public, anon, authenticated;
grant select on public.learning_curriculum_units, public.learning_curriculum_unit_skills to authenticated;
grant all on public.learning_curriculum_units, public.learning_curriculum_unit_skills to service_role;

commit;
