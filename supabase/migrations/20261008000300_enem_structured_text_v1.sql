begin;

-- Structured provider data is a versioned representation, not a replacement for
-- the official occurrence/crop history.  Rows can be promoted only after the
-- provider content is reconciled with the official corpus and answer key.
create table if not exists public.learning_enem_structured_content (
  id uuid primary key default extensions.uuid_generate_v4(),
  provider text not null,
  provider_question_key text not null,
  question_bank_id uuid references public.learning_question_bank(id) on delete restrict,
  occurrence_id uuid references public.learning_enem_official_occurrences(id) on delete restrict,
  provider_year integer not null check (provider_year between 2009 and 2023),
  provider_index integer not null check (provider_index > 0),
  discipline text not null,
  language text check (language is null or language in ('ENGLISH', 'SPANISH')),
  context_text text not null default '',
  prompt_text text not null default '',
  alternatives_json jsonb not null default '[]'::jsonb,
  provider_correct_alternative text check (provider_correct_alternative is null or provider_correct_alternative in ('A', 'B', 'C', 'D', 'E', 'ANNULLED', 'UNKNOWN')),
  essential_media_json jsonb not null default '[]'::jsonb,
  raw_hash text not null,
  normalized_content_hash text not null,
  match_method text not null,
  match_level text not null check (match_level in ('EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'REJECTED')),
  match_confidence numeric(8, 6) not null default 0 check (match_confidence >= 0 and match_confidence <= 1.2),
  verification_status text not null check (verification_status in ('VERIFIED', 'REVIEW_REQUIRED', 'REJECTED')),
  content_revision text not null,
  render_mode text not null check (render_mode in ('STRUCTURED_TEXT', 'STRUCTURED_TEXT_WITH_MEDIA', 'STRUCTURED_TEXT_VISUAL_OPTIONS')),
  source_mapping_verified boolean not null default false,
  answer_verified boolean not null default false,
  structured_content_integrity text not null check (structured_content_integrity in ('VERIFIED', 'REVIEW_REQUIRED')),
  statement_complete boolean not null default false,
  five_alternatives_complete boolean not null default false,
  no_control_chars boolean not null default false,
  no_previous_question_contamination boolean not null default false,
  no_next_question_contamination boolean not null default false,
  required_media_present boolean not null default false,
  required_media_validated boolean not null default false,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_enem_structured_provider_key_unique unique (provider, provider_question_key, content_revision),
  constraint learning_enem_structured_alternatives_array check (jsonb_typeof(alternatives_json) = 'array'),
  constraint learning_enem_structured_ready_consistency check (
    verification_status <> 'VERIFIED'
    or (
      source_mapping_verified
      and answer_verified
      and structured_content_integrity = 'VERIFIED'
      and statement_complete
      and five_alternatives_complete
      and no_control_chars
      and no_previous_question_contamination
      and no_next_question_contamination
      and (not required_media_present or required_media_validated)
    )
  )
);

create index if not exists learning_enem_structured_occurrence_revision_idx
  on public.learning_enem_structured_content(occurrence_id, content_revision, verification_status);
create index if not exists learning_enem_structured_question_revision_idx
  on public.learning_enem_structured_content(question_bank_id, content_revision, verification_status);

alter table public.learning_enem_structured_content enable row level security;
revoke all on table public.learning_enem_structured_content from public, anon, authenticated;
grant all on table public.learning_enem_structured_content to service_role;

create or replace function private.current_enem_content_revision()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'structured-text-v1'::text;
$$;

create or replace function private.enem_ready_occurrences(
  p_area text default null,
  p_subject text default null,
  p_language text default null
)
returns table(occurrence_id uuid, question_id uuid, language text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (question_bank.id)
    occurrence.id, question_bank.id, occurrence.language
  from public.learning_enem_official_occurrences occurrence
  join public.learning_question_bank question_bank
    on question_bank.id = occurrence.question_bank_id
  left join public.learning_enem_structured_content structured
    on structured.occurrence_id = occurrence.id
   and structured.question_bank_id = question_bank.id
   and structured.content_revision = private.current_enem_content_revision()
  where question_bank.active
    and question_bank.package_type = 'ENEM'
    and question_bank.source_type = 'ENEM_OFFICIAL'
    and (
      (
        structured.verification_status = 'VERIFIED'
        and structured.source_mapping_verified
        and structured.answer_verified
        and structured.structured_content_integrity = 'VERIFIED'
        and structured.statement_complete
        and structured.five_alternatives_complete
        and structured.no_control_chars
        and structured.no_previous_question_contamination
        and structured.no_next_question_contamination
        and (not structured.required_media_present or structured.required_media_validated)
      )
      or (
        coalesce(structured.verification_status, '') <> 'VERIFIED'
        and question_bank.metadata->>'content_revision' = 'source-faithful-v3'
        and question_bank.metadata->>'source_integrity' = 'VERIFIED'
        and question_bank.metadata->>'statement_integrity' = 'VERIFIED'
        and question_bank.metadata->>'render_ready' = 'true'
        and question_bank.metadata->>'render_mode' in ('HYBRID', 'VISUAL_OPTIONS')
        and exists (
          select 1
          from public.learning_enem_media_assets legacy_statement_asset
          where legacy_statement_asset.occurrence_id = occurrence.id
            and legacy_statement_asset.quality_state = 'VALIDATED'
            and coalesce(legacy_statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
        )
      )
    )
    and (p_subject is null or question_bank.metadata->>'subject_verified' = 'true')
    and (p_area is null or question_bank.metadata->>'enem_area' = p_area)
    and (
      (p_language is null and occurrence.language is null)
      or (p_language is not null and occurrence.language = p_language)
    )
    and occurrence.official_answer in ('A', 'B', 'C', 'D', 'E')
  order by question_bank.id, occurrence.id;
$$;

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
        'statement', question_bank.statement,
        'structured_content', case when structured.id is null then null else jsonb_build_object(
          'context', structured.context_text,
          'prompt', structured.prompt_text,
          'alternatives', structured.alternatives_json,
          'render_mode', structured.render_mode,
          'essential_media', structured.essential_media_json
        ) end,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'label', coalesce(option_item.option_value->>'letter', chr(64 + option_item.ordinality::integer)),
            'text', case
              when structured.id is not null then option_item.option_value->>'text'
              when exists (
                select 1
                from public.learning_enem_media_assets option_asset
                where option_asset.occurrence_id = attempt_question.occurrence_id
                  and option_asset.quality_state = 'VALIDATED'
                  and option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)
              ) then null
              when jsonb_typeof(option_item.option_value) = 'string' then option_item.option_value #>> '{}'
              else option_item.option_value->>'text'
            end,
            'assets', case when structured.id is not null then coalesce(option_item.option_value->'assets', '[]'::jsonb) else coalesce((
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
        'source_year', question_bank.source_year,
        'question_number', question_bank.source_number,
        'metadata', question_bank.metadata - 'official_answer_letter' - 'correct_answer',
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
      join public.learning_question_bank question_bank
        on question_bank.id = attempt_question.question_bank_id
      left join lateral (
        select structured_row.*
        from public.learning_enem_structured_content structured_row
        where structured_row.occurrence_id = attempt_question.occurrence_id
          and structured_row.content_revision = attempt_row.content_revision
          and structured_row.verification_status = 'VERIFIED'
        order by structured_row.updated_at desc
        limit 1
      ) structured on true
      where attempt_question.attempt_id = attempt_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon;
grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated;

commit;
