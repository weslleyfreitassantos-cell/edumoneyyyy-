-- Subject codes are part of each institution's academic catalog.
-- The baseline constraint was global and prevented different schools from
-- using the same standard codes (for example, MAT or LP).

begin;
alter table public.subjects
  drop constraint if exists subjects_code_key;
create unique index if not exists subjects_institution_code_key
  on public.subjects (
    institution_id,
    upper(btrim(code))
  )
  where code is not null;
commit;
