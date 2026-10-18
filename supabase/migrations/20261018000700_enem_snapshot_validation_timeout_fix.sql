begin;

-- Validate each snapshot row by its indexed source ids. The previous trigger
-- rescanned the complete eligible-question pool for every inserted question,
-- which made a 45-question attempt exceed the authenticated 8s timeout.
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
    if attempt_enem_mode = 'SUBJECT' and attempt_enem_subject = 'INGLES' then
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

notify pgrst, 'reload schema';
commit;
