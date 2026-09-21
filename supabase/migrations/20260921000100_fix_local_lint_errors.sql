begin;

-- The RPC contained an unused temporary mapping table. Removing only that
-- dead local structure keeps the function behavior unchanged and lets the
-- local lint pass without editing the historical migration.
alter function public.copy_academic_year_structure(uuid, uuid, uuid, boolean, boolean)
  set search_path = 'pg_catalog, public, pg_temp';

do $$
declare
  current_definition text;
  fixed_definition text;
begin
  select pg_get_functiondef(
    'public.copy_academic_year_structure(uuid, uuid, uuid, boolean, boolean)'::regprocedure
  )
  into current_definition;

  fixed_definition := regexp_replace(
    current_definition,
    'create temporary table academic_class_copy_map \([^;]+\) on commit drop;\s*',
    '',
    'g'
  );
  fixed_definition := regexp_replace(
    fixed_definition,
    'insert into academic_class_copy_map values \(source_class\.id, target_class_id\);\s*',
    '',
    'g'
  );

  if fixed_definition = current_definition
    or position('academic_class_copy_map' in fixed_definition) > 0 then
    raise exception 'Expected unused academic_class_copy_map block was not removed';
  end if;

  execute fixed_definition;
end;
$$;

-- Keep the existing enrollment RPC body and correct the only type mismatch
-- reported by plpgsql_check: birth_date is a date, not text.
do $$
declare
  current_definition text;
  fixed_definition text;
begin
  select pg_get_functiondef(
    'public.update_full_student_enrollment_bundle(jsonb)'::regprocedure
  )
  into current_definition;

  fixed_definition := replace(
    current_definition,
    $needle$set birth_date = nullif(p_payload->'identity'->>'birth_date', ''),$needle$,
    $replacement$set birth_date = nullif(p_payload->'identity'->>'birth_date', '')::date,$replacement$
  );

  if fixed_definition = current_definition then
    raise exception 'Expected birth_date assignment was not found';
  end if;

  execute fixed_definition;
end;
$$;

commit;
