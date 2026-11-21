begin;

-- Validate Spanish snapshots against the same accepted, verified language pool
-- used by the start RPC. Legacy official media follows the immutable source
-- revision of its question, not the newer global archive revision.
create or replace function private.validate_enem_attempt_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_revision text;
  attempt_enem_mode text;
  attempt_enem_subject text;
  occurrence_question_id uuid;
  structured_question_id uuid;
begin
  select attempt.content_revision,
         simulation.metadata->>'enem_mode',
         simulation.metadata->>'enem_subject'
    into attempt_revision, attempt_enem_mode, attempt_enem_subject
    from public.learning_simulation_attempts attempt
    join public.learning_simulations simulation on simulation.id = attempt.simulation_id
   where attempt.id = new.attempt_id;

  if attempt_revision is null then
    raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
  end if;

  if attempt_revision = private.current_enem_content_revision() then
    if attempt_enem_mode = 'SUBJECT' and attempt_enem_subject = 'ESPANHOL' then
      if new.occurrence_id is not null or new.structured_content_id is null then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
      end if;

      select ready.question_id
        into structured_question_id
        from private.enem_ready_provider_text_questions(null, 'ESPANHOL', 'SPANISH') ready
       where ready.question_id = new.question_bank_id
         and ready.occurrence_id is null
         and ready.structured_content_id = new.structured_content_id
         and ready.language = 'SPANISH'
         and ready.source_kind = 'STRUCTURED_PROVIDER';

      if structured_question_id is null then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
      end if;
    elsif attempt_enem_mode = 'SUBJECT' and attempt_enem_subject = 'INGLES' then
      if new.occurrence_id is not null then
        select occurrence.question_bank_id
          into occurrence_question_id
          from public.learning_enem_official_occurrences occurrence
          join public.learning_question_bank question_bank
            on question_bank.id = occurrence.question_bank_id
         where occurrence.id = new.occurrence_id
           and occurrence.question_bank_id = new.question_bank_id
           and question_bank.active
           and question_bank.package_type = 'ENEM'
           and question_bank.source_type = 'ENEM_OFFICIAL'
           and occurrence.language = 'ENGLISH'
           and occurrence.exam = 'ENEM'
           and occurrence.application in ('REGULAR', 'PPL')
           and occurrence.year between 2009 and 2025
           and occurrence.question_number is not null
           and occurrence.exam_url is not null
           and occurrence.official_answer in ('A', 'B', 'C', 'D', 'E')
           and question_bank.metadata->>'official_answer_letter' = occurrence.official_answer
           and question_bank.metadata->>'render_mode' = 'VISUAL_OPTIONS'
           and exists (
             select 1
               from public.learning_enem_media_assets statement_asset
              where statement_asset.occurrence_id = occurrence.id
                and statement_asset.quality_state = 'VALIDATED'
                and coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
                and (
                  statement_asset.storage_path ~* '^https?://'
                  or (
                    statement_asset.storage_path is not null
                    and exists (
                      select 1
                        from storage.objects object
                       where object.bucket_id = 'enem-question-assets'
                         and object.name = statement_asset.storage_path
                    )
                  )
                  or (
                    statement_asset.storage_path is null
                    and statement_asset.metadata->>'public_url' ~* '^https?://'
                  )
                )
           )
           and (
             select count(distinct option_asset.metadata->>'option_label')
               from public.learning_enem_media_assets option_asset
              where option_asset.occurrence_id = occurrence.id
                and option_asset.quality_state = 'VALIDATED'
                and option_asset.metadata->>'asset_role' in ('OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E')
                and option_asset.metadata->>'option_label' in ('A', 'B', 'C', 'D', 'E')
                and option_asset.metadata->>'asset_role' = 'OPTION_' || (option_asset.metadata->>'option_label')
                and (
                  option_asset.storage_path ~* '^https?://'
                  or (
                    option_asset.storage_path is not null
                    and exists (
                      select 1
                        from storage.objects object
                       where object.bucket_id = 'enem-question-assets'
                         and object.name = option_asset.storage_path
                    )
                  )
                  or (
                    option_asset.storage_path is null
                    and option_asset.metadata->>'public_url' ~* '^https?://'
                  )
                )
           ) = 5
           and not exists (
             select 1
               from public.learning_enem_media_assets required_asset
              where required_asset.occurrence_id = occurrence.id
                and required_asset.quality_state = 'VALIDATED'
                and (
                  coalesce(required_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'
                  or required_asset.metadata->>'asset_role' in ('OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E')
                )
                and not (
                  required_asset.storage_path ~* '^https?://'
                  or (
                    required_asset.storage_path is not null
                    and exists (
                      select 1
                        from storage.objects object
                       where object.bucket_id = 'enem-question-assets'
                         and object.name = required_asset.storage_path
                    )
                  )
                  or (
                    required_asset.storage_path is null
                    and required_asset.metadata->>'public_url' ~* '^https?://'
                  )
                )
           )
           and question_bank.metadata->>'source_integrity' = 'VERIFIED'
           and question_bank.metadata->>'statement_integrity' = 'VERIFIED'
           and question_bank.metadata->>'render_ready' = 'true'
           and question_bank.metadata->>'area_verified' = 'true'
           and question_bank.metadata->>'subject_verified' = 'true'
           and jsonb_typeof(question_bank.options) = 'array'
           and jsonb_array_length(question_bank.options) = 5;

        if occurrence_question_id is null then
          raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
        end if;
      else
        select structured.question_bank_id
          into structured_question_id
          from public.learning_enem_structured_content structured
          join public.learning_question_bank question_bank
            on question_bank.id = structured.question_bank_id
         where structured.id = new.structured_content_id
           and structured.question_bank_id = new.question_bank_id
           and question_bank.active
           and question_bank.package_type = 'ENEM'
           and question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
           and structured.source_kind = 'STRUCTURED_PROVIDER'
           and structured.content_acceptance_status = 'ACCEPTED'
           and structured.verification_status = 'VERIFIED'
           and structured.content_revision = attempt_revision
           and structured.question_bank_id is not null
           and structured.occurrence_id is null
           and structured.language = 'ENGLISH'
           and structured.structured_content_integrity = 'VERIFIED'
           and structured.statement_complete
           and private.enem_provider_statement_complete_v4(structured.context_text, structured.prompt_text)
           and structured.five_alternatives_complete
           and structured.no_control_chars
           and structured.no_previous_question_contamination
           and structured.no_next_question_contamination
           and not structured.required_media_present
           and structured.source_exam = 'ENEM'
           and structured.source_application in ('REGULAR', 'PPL')
           and structured.provider_year between 2009 and 2025
           and structured.source_question_number is not null
           and nullif(btrim(structured.source_url), '') is not null
           and structured.source_provider = 'xequemat'
           and structured.rights_status = 'VERIFIED'
           and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
           and not exists (
             select 1
               from jsonb_array_elements(structured.content_blocks_json) block
              where block->>'kind' = 'IMAGE'
                and jsonb_typeof(block->'media') = 'array'
                and jsonb_array_length(block->'media') > 0
           )
           and jsonb_typeof(structured.alternatives_json) = 'array'
           and jsonb_array_length(structured.alternatives_json) = 5
           and not exists (
             select 1
               from jsonb_array_elements(structured.alternatives_json) option_item
              where jsonb_typeof(option_item) <> 'object'
                or btrim(option_item->>'text') = ''
                or option_item ? 'file'
                or option_item->>'text' ~ '[[:cntrl:]]'
           );

        if structured_question_id is null then
          raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
        end if;
      end if;
    else
      if new.occurrence_id is not null or new.structured_content_id is null then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
      end if;

      select structured.question_bank_id
        into structured_question_id
        from public.learning_enem_structured_content structured
        join public.learning_question_bank question_bank
          on question_bank.id = structured.question_bank_id
       where structured.id = new.structured_content_id
         and structured.question_bank_id = new.question_bank_id
         and question_bank.active
         and question_bank.package_type = 'ENEM'
         and question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'
         and structured.source_kind = 'STRUCTURED_PROVIDER'
         and structured.content_acceptance_status = 'ACCEPTED'
         and structured.verification_status = 'VERIFIED'
         and structured.content_revision = attempt_revision
         and structured.question_bank_id is not null
         and structured.occurrence_id is null
         and structured.language is null
         and structured.render_mode in ('STRUCTURED_TEXT', 'STRUCTURED_TEXT_WITH_MEDIA')
         and structured.structured_content_integrity = 'VERIFIED'
         and structured.statement_complete
         and private.enem_provider_statement_complete_v4(structured.context_text, structured.prompt_text)
         and structured.five_alternatives_complete
         and structured.no_control_chars
         and structured.no_previous_question_contamination
         and structured.no_next_question_contamination
         and (not structured.required_media_present or structured.required_media_validated)
         and structured.provider_correct_alternative in ('A', 'B', 'C', 'D', 'E')
         and jsonb_typeof(structured.alternatives_json) = 'array'
         and jsonb_array_length(structured.alternatives_json) = 5
         and not exists (
           select 1
             from jsonb_array_elements(structured.alternatives_json) option_item
            where jsonb_typeof(option_item) <> 'object'
              or btrim(option_item->>'text') = ''
              or option_item ? 'file'
              or option_item->>'text' ~ '[[:cntrl:]]'
         );

      if structured_question_id is null then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
      end if;
    end if;
  else
    if new.occurrence_id is not null then
      select occurrence.question_bank_id
        into occurrence_question_id
        from public.learning_enem_official_occurrences occurrence
       where occurrence.id = new.occurrence_id;

      if occurrence_question_id is null
         or occurrence_question_id <> new.question_bank_id then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_OCCURRENCE_MISMATCH';
      end if;
    end if;

    if new.structured_content_id is not null then
      select structured.question_bank_id
        into structured_question_id
        from public.learning_enem_structured_content structured
       where structured.id = new.structured_content_id
         and structured.content_revision = attempt_revision
         and structured.verification_status = 'VERIFIED'
         and (
           (
             structured.source_kind = 'STRUCTURED_PROVIDER'
             and structured.content_acceptance_status = 'ACCEPTED'
           )
           or structured.source_kind = 'OFFICIAL_OCCURRENCE'
         );

      if structured_question_id is null
         or structured_question_id <> new.question_bank_id then
        raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
      end if;
    end if;

    if new.occurrence_id is not null
       and new.structured_content_id is not null
       and not exists (
         select 1
         from public.learning_enem_structured_content structured
         where structured.id = new.structured_content_id
           and structured.occurrence_id = new.occurrence_id
       ) then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_MISMATCH';
    end if;
  end if;

  return new;
end;
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
                  and option_asset.metadata->>'official_pdf_crop' = 'true'
                  and option_asset.metadata->>'render_ready' = 'true'
                  and option_asset.metadata->>'revision' = coalesce(nullif(question_bank.metadata->>'content_revision', ''), attempt_row.content_revision)
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
                  and option_asset.metadata->>'official_pdf_crop' = 'true'
                  and option_asset.metadata->>'render_ready' = 'true'
                  and option_asset.metadata->>'revision' = coalesce(nullif(question_bank.metadata->>'content_revision', ''), attempt_row.content_revision)
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
            and statement_asset.metadata->>'official_pdf_crop' = 'true'
            and statement_asset.metadata->>'render_ready' = 'true'
            and statement_asset.metadata->>'revision' = coalesce(nullif(question_bank.metadata->>'content_revision', ''), attempt_row.content_revision)
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
