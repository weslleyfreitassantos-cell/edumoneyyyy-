begin;

-- Publication is intentionally separate from technical readiness and from
-- pedagogical review. Existing validated journeys stay published; new
-- content is promoted only when both fields are explicitly advanced.
alter table public.learning_curriculum_skills
  add column if not exists publication_status text not null default 'PUBLISHED';

alter table public.learning_adaptive_content_packs
  add column if not exists publication_status text not null default 'PUBLISHED';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'learning_curriculum_skills_publication_status_check'
  ) then
    alter table public.learning_curriculum_skills
      add constraint learning_curriculum_skills_publication_status_check
      check (publication_status in ('STAGING', 'QA_ONLY', 'PUBLISHED'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'learning_adaptive_content_packs_publication_status_check'
  ) then
    alter table public.learning_adaptive_content_packs
      add constraint learning_adaptive_content_packs_publication_status_check
      check (publication_status in ('STAGING', 'QA_ONLY', 'PUBLISHED'));
  end if;
end;
$$;

create index if not exists learning_curriculum_skills_publication_idx
  on public.learning_curriculum_skills(catalog_id, active, publication_status, bncc_alignment_status);

-- This trigger runs before the V4 migration's upsert. It therefore removes
-- the unsafe ADAPTIVE_READY/MAPPED state before V4 can redefine discovery.
create or replace function private.enforce_bncc_high_school_v4_publication_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_pack text := coalesce(new.metadata->>'content_pack', '');
begin
  if content_pack = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'
     and (
       coalesce(new.pedagogical_review_status, '') <> 'PEDAGOGICAL_REVIEWED'
       or coalesce(new.publication_status, '') <> 'PUBLISHED'
     ) then
    if coalesce(new.publication_status, 'STAGING') <> 'QA_ONLY' then
      new.publication_status := 'STAGING';
    end if;
    new.bncc_alignment_status := 'CANDIDATE';
    new.content_readiness := 'CONTENT_READY';
    new.mastery_targetable := false;
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'publication_status', new.publication_status,
    'publication_gate', case
      when content_pack = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'
       and new.publication_status <> 'PUBLISHED'
        then 'PEDAGOGICAL_REVIEW_REQUIRED'
      else 'PASSED'
    end
  );

  return new;
end;
$$;

drop trigger if exists bncc_high_school_v4_publication_gate
  on public.learning_curriculum_skills;
create trigger bncc_high_school_v4_publication_gate
before insert or update on public.learning_curriculum_skills
for each row execute function private.enforce_bncc_high_school_v4_publication_gate();

-- The direct V4 RPC is also protected. This trigger covers callers that skip
-- the public BNCC wrapper and call start_guided_learning_session_v4 directly.
create or replace function private.assert_published_v4_session_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.planner_version = 'V4'
     and not exists (
       select 1
         from public.learning_curriculum_skills skill
         join public.learning_curriculum_catalogs catalog
           on catalog.id = skill.catalog_id
          and catalog.code = 'BNCC_2018'
          and catalog.active
         join public.learning_curriculum_grade_targets grade
           on grade.canonical_skill_id = skill.id
          and grade.catalog_id = skill.catalog_id
          and grade.active
         join public.enrollments enrollment
           on enrollment.student_id = new.student_id
          and enrollment.active
          and enrollment.status = 'active'
         join public.classes class
           on class.id = enrollment.class_id
          and class.institution_id = new.institution_id
          and class.active
         cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
        where skill.id = new.target_canonical_skill_id
          and skill.active
          and skill.node_kind = 'LEAF'
          and skill.content_readiness = 'ADAPTIVE_READY'
          and skill.mastery_targetable
          and skill.bncc_alignment_status = 'MAPPED'
          and skill.publication_status = 'PUBLISHED'
          and skill.metadata->>'official_code' is not null
          and normalized.value->>'stage' = grade.stage
          and nullif(normalized.value->>'grade_level', '')::smallint = grade.grade_level
     ) then
    raise exception 'LEARNING_V4_CONTENT_NOT_PUBLISHED';
  end if;
  return new;
end;
$$;

drop trigger if exists guided_session_v4_publication_gate
  on public.learning_guided_sessions;
create trigger guided_session_v4_publication_gate
before insert on public.learning_guided_sessions
for each row execute function private.assert_published_v4_session_target();

revoke all on function private.enforce_bncc_high_school_v4_publication_gate() from public, anon, authenticated;
revoke all on function private.assert_published_v4_session_target() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
