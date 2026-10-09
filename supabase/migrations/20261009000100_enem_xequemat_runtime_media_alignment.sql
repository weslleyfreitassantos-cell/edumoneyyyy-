begin;

-- The archive v1 pool accepts validated provider media. Keep the snapshot
-- trigger aligned with that single source of truth instead of the older
-- text-only gate from the previous provider revisions.
create or replace function private.validate_enem_attempt_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_revision text;
  occurrence_question_id uuid;
  structured_question_id uuid;
begin
  select attempt.content_revision
    into attempt_revision
  from public.learning_simulation_attempts attempt
  where attempt.id = new.attempt_id;

  if attempt_revision = private.current_enem_content_revision() then
    if new.occurrence_id is not null or new.structured_content_id is null then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED';
    end if;

    select ready.question_id
      into structured_question_id
    from private.enem_ready_provider_text_questions(null, null, null) ready
    where ready.question_id = new.question_bank_id
      and ready.structured_content_id = new.structured_content_id;

    if structured_question_id is null then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH';
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

-- Existing dynamic templates were created by the previous importer revision.
-- Keep their displayed revision synchronized with the pool used for new
-- attempts; historical attempts retain their own immutable revision.
update public.learning_simulations
set metadata = metadata || jsonb_build_object(
  'content_revision', private.current_enem_content_revision(),
  'integrity_version', private.current_enem_content_revision()
), updated_at = now()
where metadata->>'dynamic_pool' = 'true'
  and metadata->>'content_revision' is distinct from private.current_enem_content_revision();

notify pgrst, 'reload schema';
commit;
