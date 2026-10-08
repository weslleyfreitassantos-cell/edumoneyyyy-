begin;

-- Forward-only archive revision. Existing question-bank rows and attempt
-- snapshots remain immutable; only new attempts can use this revision.
alter table public.learning_question_bank
  add column if not exists source_question_number integer,
  add column if not exists source_url text,
  add column if not exists source_provider text;

alter table public.learning_simulation_attempt_questions
  add column if not exists source_reference_snapshot jsonb not null default '{}'::jsonb;

alter table public.learning_simulation_attempt_questions
  drop constraint if exists learning_simulation_attempt_questions_source_reference_snapshot_object_check;

alter table public.learning_simulation_attempt_questions
  add constraint learning_simulation_attempt_questions_source_reference_snapshot_object_check
  check (jsonb_typeof(source_reference_snapshot) = 'object');

alter table public.learning_enem_structured_content
  add column if not exists content_blocks_json jsonb not null default '[]'::jsonb,
  add column if not exists source_exam text,
  add column if not exists source_application text,
  add column if not exists source_question_number integer,
  add column if not exists source_day text,
  add column if not exists source_booklet text,
  add column if not exists source_booklet_color text,
  add column if not exists source_url text,
  add column if not exists source_provider text,
  add column if not exists rights_status text not null default 'UNRESOLVED',
  add column if not exists rejection_reasons_json jsonb not null default '[]'::jsonb;

alter table public.learning_enem_structured_content
  drop constraint if exists learning_enem_structured_content_provider_year_check,
  drop constraint if exists learning_enem_structured_content_content_blocks_array_check,
  drop constraint if exists learning_enem_structured_content_source_application_check,
  drop constraint if exists learning_enem_structured_content_rights_status_check;

alter table public.learning_enem_structured_content
  add constraint learning_enem_structured_content_provider_year_check
    check (provider_year between 2009 and 2025),
  add constraint learning_enem_structured_content_content_blocks_array_check
    check (jsonb_typeof(content_blocks_json) = 'array'),
  add constraint learning_enem_structured_content_source_application_check
    check (source_application is null or source_application in ('REGULAR', 'PPL')),
  add constraint learning_enem_structured_content_rights_status_check
    check (rights_status in ('UNRESOLVED', 'REVIEW_REQUIRED', 'VERIFIED'));

alter table public.learning_enem_structured_content
  drop constraint if exists learning_enem_structured_ready_consistency;

alter table public.learning_enem_structured_content
  add constraint learning_enem_structured_ready_consistency check (
    verification_status <> 'VERIFIED'
    or (
      structured_content_integrity = 'VERIFIED'
      and statement_complete
      and five_alternatives_complete
      and no_control_chars
      and no_previous_question_contamination
      and no_next_question_contamination
      and (not required_media_present or required_media_validated)
      and (
        (
          source_kind = 'STRUCTURED_PROVIDER'
          and content_acceptance_status = 'ACCEPTED'
          and question_bank_id is not null
          and occurrence_id is null
          and provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
        )
        or (
          source_kind = 'OFFICIAL_OCCURRENCE'
          and source_mapping_verified
          and answer_verified
        )
      )
    )
  );

create index if not exists learning_question_bank_enem_source_reference_idx
  on public.learning_question_bank(source_exam, source_application, source_year, source_question_number);

create index if not exists learning_enem_structured_source_identity_idx
  on public.learning_enem_structured_content(source_provider, source_application, source_exam, source_question_number, content_revision);

create or replace function private.current_enem_content_revision()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'xequemat-archive-v1'::text;
$$;

-- A record is eligible only when the complete statement, A-E alternatives,
-- provider answer, canonical source identity, rights decision and every
-- required media asset have passed validation.
create or replace function private.enem_ready_provider_text_questions(
  p_area text default null,
  p_subject text default null,
  p_language text default null
)
returns table(
  question_id uuid,
  occurrence_id uuid,
  structured_content_id uuid,
  language text,
  source_kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    question_bank.id,
    null::uuid,
    structured.id,
    structured.language,
    structured.source_kind
  from public.learning_enem_structured_content structured
  join public.learning_question_bank question_bank
    on question_bank.id = structured.question_bank_id
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
    and structured.provider = 'xequemat'
    and structured.source_kind = 'STRUCTURED_PROVIDER'
    and structured.content_acceptance_status = 'ACCEPTED'
    and structured.verification_status = 'VERIFIED'
    and structured.content_revision = private.current_enem_content_revision()
    and structured.question_bank_id is not null
    and structured.occurrence_id is null
    and structured.render_mode in ('STRUCTURED_TEXT', 'STRUCTURED_TEXT_WITH_MEDIA', 'STRUCTURED_TEXT_VISUAL_OPTIONS')
    and structured.structured_content_integrity = 'VERIFIED'
    and structured.statement_complete
    and structured.five_alternatives_complete
    and structured.no_control_chars
    and structured.no_previous_question_contamination
    and structured.no_next_question_contamination
    and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
    and structured.source_exam = 'ENEM'
    and structured.source_application in ('REGULAR', 'PPL')
    and structured.source_question_number is not null
    and structured.source_provider = 'xequemat'
    and structured.rights_status = 'VERIFIED'
    and jsonb_array_length(structured.content_blocks_json) > 0
    and (not structured.required_media_present or structured.required_media_validated)
    and (p_area is null or question_bank.metadata->>'enem_area' = p_area)
    and (p_subject is null or question_bank.metadata->>'enem_subject' = p_subject)
    and (p_language is null or structured.language = p_language)
  order by question_bank.id;
$$;

revoke all on function private.enem_ready_provider_text_questions(text, text, text) from public, anon, authenticated;
grant execute on function private.enem_ready_provider_text_questions(text, text, text) to service_role;

-- Keep the human-facing origin attached to the attempt item.  The question
-- bank can receive newer catalog revisions, but a historical attempt must
-- continue to show the origin that was selected when it started.
create or replace function private.snapshot_enem_question_source_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.source_reference_snapshot, '{}'::jsonb) = '{}'::jsonb then
    select jsonb_build_object(
      'source_year', coalesce(structured.provider_year, question_bank.source_year),
      'source_exam', coalesce(structured.source_exam, question_bank.source_exam),
      'source_application', coalesce(structured.source_application, question_bank.source_application),
      'source_question_number', coalesce(structured.source_question_number, question_bank.source_question_number, question_bank.source_number),
      'source_day', coalesce(structured.source_day, question_bank.source_day),
      'source_booklet', structured.source_booklet,
      'source_booklet_color', structured.source_booklet_color,
      'source_url', coalesce(structured.source_url, question_bank.source_url, question_bank.source_reference),
      'source_provider', coalesce(structured.source_provider, question_bank.source_provider, question_bank.source_name)
    )
    into new.source_reference_snapshot
    from public.learning_question_bank question_bank
    left join public.learning_enem_structured_content structured
      on structured.id = new.structured_content_id;
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_enem_question_source_reference
  on public.learning_simulation_attempt_questions;
create trigger snapshot_enem_question_source_reference
before insert on public.learning_simulation_attempt_questions
for each row execute function private.snapshot_enem_question_source_reference();

update public.learning_simulation_attempt_questions attempt_question
set source_reference_snapshot = jsonb_build_object(
  'source_year', coalesce(structured.provider_year, question_bank.source_year),
  'source_exam', coalesce(structured.source_exam, question_bank.source_exam),
  'source_application', coalesce(structured.source_application, question_bank.source_application),
  'source_question_number', coalesce(structured.source_question_number, question_bank.source_question_number, question_bank.source_number),
  'source_day', coalesce(structured.source_day, question_bank.source_day),
  'source_booklet', structured.source_booklet,
  'source_booklet_color', structured.source_booklet_color,
  'source_url', coalesce(structured.source_url, question_bank.source_url, question_bank.source_reference),
  'source_provider', coalesce(structured.source_provider, question_bank.source_provider, question_bank.source_name)
)
from public.learning_question_bank question_bank
left join public.learning_enem_structured_content structured
  on structured.id = attempt_question.structured_content_id
where attempt_question.question_bank_id = question_bank.id
  and attempt_question.source_reference_snapshot = '{}'::jsonb
  and (
    question_bank.source_year is not null
    or question_bank.source_number is not null
    or structured.source_question_number is not null
  );

-- Return the source identity as part of every question payload.  Structured
-- content blocks are also returned here so the reference and its rendering
-- remain tied to the immutable attempt snapshot.
create or replace function public.get_enem_simulation_attempt_v2(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
begin
  select attempt.* into attempt_row
  from public.learning_simulation_attempts attempt
  where attempt.id = p_attempt_id
    and exists (
      select 1 from public.students student
      where student.id = attempt.student_id
        and student.profile_id = auth.uid()
        and student.active
    );
  if not found then raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;

  return jsonb_build_object(
    'attempt_id', attempt_row.id,
    'simulation_id', attempt_row.simulation_id,
    'status', attempt_row.status,
    'content_revision', attempt_row.content_revision,
    'started_at', attempt_row.started_at,
    'completed_at', attempt_row.completed_at,
    'duration_seconds', attempt_row.duration_seconds,
    'total_questions', attempt_row.total_questions,
    'score', attempt_row.score,
    'correct_count', attempt_row.correct_count,
    'answers', attempt_row.answers - '__language_choice',
    'navigation_state', attempt_row.navigation_state,
    'simulation', (
      select jsonb_build_object(
        'id', simulation.id,
        'title', simulation.title,
        'simulation_type', simulation.simulation_type,
        'area', simulation.area,
        'question_count', simulation.question_count,
        'duration_minutes', simulation.duration_minutes,
        'metadata', simulation.metadata
      )
      from public.learning_simulations simulation
      where simulation.id = attempt_row.simulation_id
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', attempt_question.position,
        'question_bank_id', question_bank.id,
        'occurrence_id', attempt_question.occurrence_id,
        'structured_content_id', attempt_question.structured_content_id,
        'source_kind', coalesce(structured.source_kind, 'OFFICIAL_OCCURRENCE'),
        'source_reference', attempt_question.source_reference_snapshot,
        'statement', question_bank.statement,
        'structured_content', case when structured.id is null then null else jsonb_build_object(
          'context', structured.context_text,
          'prompt', structured.prompt_text,
          'alternatives', coalesce((
            select jsonb_agg(jsonb_build_object(
              'letter', option_item.option_value->>'letter',
              'text', option_item.option_value->>'text',
              'assets', case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else coalesce(option_item.option_value->'assets', '[]'::jsonb) end
            ) order by option_item.ordinality)
            from jsonb_array_elements(structured.alternatives_json) with ordinality option_item(option_value, ordinality)
          ), '[]'::jsonb),
          'render_mode', structured.render_mode,
          'essential_media', case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else structured.essential_media_json end,
          'content_blocks', structured.content_blocks_json,
          'source_reference', attempt_question.source_reference_snapshot
        ) end,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'label', coalesce(option_item.option_value->>'letter', chr(64 + option_item.ordinality::integer)),
            'text', case
              when structured.id is not null then option_item.option_value->>'text'
              when exists (
                select 1 from public.learning_enem_media_assets option_asset
                where option_asset.occurrence_id = attempt_question.occurrence_id
                  and option_asset.quality_state = 'VALIDATED'
                  and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
              ) then null
              when jsonb_typeof(option_item.option_value) = 'string' then option_item.option_value #>> '{}'
              else option_item.option_value->>'text'
            end,
            'assets', case when structured.id is not null then
              case when structured.source_kind = 'STRUCTURED_PROVIDER' then '[]'::jsonb else coalesce(option_item.option_value->'assets', '[]'::jsonb) end
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'media_type', option_asset.media_type,
                  'storage_path', option_asset.storage_path,
                  'public_url', option_asset.metadata->>'public_url',
                  'metadata', option_asset.metadata
                ) order by option_asset.source_page, option_asset.id)
                from public.learning_enem_media_assets option_asset
                where option_asset.occurrence_id = attempt_question.occurrence_id
                  and option_asset.quality_state = 'VALIDATED'
                  and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
              ), '[]'::jsonb) end
          ) order by option_item.ordinality)
          from jsonb_array_elements(coalesce(structured.alternatives_json, question_bank.options)) with ordinality option_item(option_value, ordinality)
        ), '[]'::jsonb),
        'source_year', coalesce(structured.provider_year, question_bank.source_year),
        'question_number', coalesce(structured.source_question_number, question_bank.source_question_number, question_bank.source_number),
        'metadata', (question_bank.metadata - 'official_answer_letter' - 'correct_answer' - 'provider_answer_letter') || jsonb_build_object(
          'source_year', coalesce(structured.provider_year, question_bank.source_year),
          'source_exam', coalesce(structured.source_exam, question_bank.source_exam),
          'source_application', coalesce(structured.source_application, question_bank.source_application),
          'source_question_number', coalesce(structured.source_question_number, question_bank.source_question_number, question_bank.source_number),
          'source_day', coalesce(structured.source_day, question_bank.source_day),
          'source_url', coalesce(structured.source_url, question_bank.source_url, question_bank.source_reference),
          'source_provider', coalesce(structured.source_provider, question_bank.source_provider, question_bank.source_name)
        ),
        'statement_assets', case when structured.id is not null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object(
            'media_type', statement_asset.media_type,
            'storage_path', statement_asset.storage_path,
            'public_url', statement_asset.metadata->>'public_url',
            'metadata', statement_asset.metadata
          ) order by statement_asset.source_page, statement_asset.id)
          from public.learning_enem_media_assets statement_asset
          where statement_asset.occurrence_id = attempt_question.occurrence_id
            and statement_asset.quality_state = 'VALIDATED'
            and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
        ), '[]'::jsonb) end
      ) order by attempt_question.position)
      from public.learning_simulation_attempt_questions attempt_question
      join public.learning_question_bank question_bank on question_bank.id = attempt_question.question_bank_id
      left join lateral (
        select structured_row.*
        from public.learning_enem_structured_content structured_row
        where structured_row.content_revision = attempt_row.content_revision
          and (
            structured_row.id = attempt_question.structured_content_id
            or (attempt_question.structured_content_id is null and structured_row.occurrence_id = attempt_question.occurrence_id)
          )
          and structured_row.verification_status = 'VERIFIED'
        order by case when structured_row.id = attempt_question.structured_content_id then 0 else 1 end, structured_row.updated_at desc
        limit 1
      ) structured on true
      where attempt_question.attempt_id = attempt_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon;
grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
