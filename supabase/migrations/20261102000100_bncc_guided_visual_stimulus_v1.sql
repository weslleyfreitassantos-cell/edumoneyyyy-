begin;

-- Restore the optional image prompt contract from the historical BNCC tutor
-- without changing answer selection, scoring, publication state, or progress.
-- Keep both the V9 getter and its preserved legacy getter on the same payload.
do $patch_guided_step_visual_stimulus_v1$
declare
  target_function_names text[] := array[
    'public.get_guided_learning_step_v4(uuid)',
    'public.get_guided_learning_step_v4_legacy_v9(uuid)'
  ];
  target_function regprocedure;
  function_definition text;
  candidate_definition text;
  original_definitions text[] := array[]::text[];
  candidate_definitions text[] := array[]::text[];
  original_signatures text[] := array[]::text[];
  old_clause_count integer;
  patched_clause_count integer;
  target_index integer;
  function_owner oid;
  function_return_type oid;
  is_security_definer boolean;
  function_config text[];
  function_acl aclitem[];
  current_signature text;
  expected_payload_count integer;
begin
  -- Validate and prepare both definitions before executing either CREATE OR REPLACE.
  for target_index in 1..cardinality(target_function_names) loop
    target_function := to_regprocedure(target_function_names[target_index]);
    if target_function is null then
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_MISSING';
    end if;

    select pg_get_functiondef(p.oid), p.proowner,
           p.prorettype, p.prosecdef,
           p.proconfig, p.proacl
      into function_definition, function_owner, function_return_type,
           is_security_definer, function_config, function_acl
      from pg_proc p
     where p.oid = target_function::oid;

    if function_definition is null then
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_MISSING';
    end if;
    if function_return_type <> 'jsonb'::regtype
       or not is_security_definer
       or not exists (
         select 1 from unnest(coalesce(function_config, array[]::text[])) setting
          where setting like 'search_path=%'
       ) then
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_SHAPE_MISMATCH';
    end if;

    -- The V9 getter has one question payload; its preserved V8 legacy getter
    -- has two structurally equivalent payload branches.
    expected_payload_count := case target_index when 1 then 1 else 2 end;

    select count(*) into old_clause_count
      from regexp_matches(
        function_definition,
        $old$'position'[[:space:]]*,[[:space:]]*item[.]position$old$,
        'g'
      );
    select count(*) into patched_clause_count
      from regexp_matches(
        function_definition,
        $patched$'position'[[:space:]]*,[[:space:]]*item[.]position[[:space:]]*,[[:space:]]*'visual_stimulus'[[:space:]]*,[[:space:]]*question[.]metadata[[:space:]]*->[[:space:]]*'visual_stimulus'$patched$,
        'g'
      );

    if old_clause_count = expected_payload_count and patched_clause_count = 0 then
      candidate_definition := regexp_replace(
        function_definition,
        $old$'position'[[:space:]]*,[[:space:]]*item[.]position$old$,
        $replacement$'position', item.position, 'visual_stimulus', question.metadata->'visual_stimulus'$replacement$,
        'g'
      );
    elsif old_clause_count = 0 and patched_clause_count = expected_payload_count then
      -- Idempotency is based on the complete question payload clause, not a word occurrence.
      candidate_definition := function_definition;
    else
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_PATCH_MISMATCH: %', target_function_names[target_index];
    end if;

    select count(*) into old_clause_count
      from regexp_matches(
        candidate_definition,
        $old$'position'[[:space:]]*,[[:space:]]*item[.]position$old$,
        'g'
      );
    select count(*) into patched_clause_count
      from regexp_matches(
        candidate_definition,
        $patched$'position'[[:space:]]*,[[:space:]]*item[.]position[[:space:]]*,[[:space:]]*'visual_stimulus'[[:space:]]*,[[:space:]]*question[.]metadata[[:space:]]*->[[:space:]]*'visual_stimulus'$patched$,
        'g'
      );
    if old_clause_count <> 0 or patched_clause_count <> expected_payload_count then
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_PATCH_MISMATCH: %', target_function_names[target_index];
    end if;

    current_signature := concat_ws(
      '|', function_owner::text, function_return_type::text,
      is_security_definer::text, coalesce(function_config::text, '<null>'),
      coalesce(function_acl::text, '<null>')
    );
    original_definitions := array_append(original_definitions, function_definition);
    candidate_definitions := array_append(candidate_definitions, candidate_definition);
    original_signatures := array_append(original_signatures, current_signature);
  end loop;

  -- No function is replaced until both targets pass all shape and patch checks.
  for target_index in 1..cardinality(target_function_names) loop
    if candidate_definitions[target_index] <> original_definitions[target_index] then
      execute candidate_definitions[target_index];
    end if;

    target_function := to_regprocedure(target_function_names[target_index]);
    select concat_ws(
      '|', p.proowner::text, p.prorettype::text,
      p.prosecdef::text, coalesce(p.proconfig::text, '<null>'),
      coalesce(p.proacl::text, '<null>')
    )
      into current_signature
      from pg_proc p
     where p.oid = target_function::oid;
    if current_signature is distinct from original_signatures[target_index] then
      raise exception 'BNCC_GUIDED_VISUAL_STIMULUS_FUNCTION_SECURITY_METADATA_CHANGED';
    end if;
  end loop;
end;
$patch_guided_step_visual_stimulus_v1$;

commit;
