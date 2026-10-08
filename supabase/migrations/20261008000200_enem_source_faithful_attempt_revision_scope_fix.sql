-- Forward-only repair for the source-faithful attempt RPC.
-- The v3 body used the variable name content_revision, which is also a table
-- column and is ambiguous in PL/pgSQL queries. Rebuild the already-installed
-- function with a distinct variable name without changing its behavior.
do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.start_enem_simulation_attempt_v2(uuid,uuid,uuid,text)'::regprocedure
  )
  into function_definition;

  if function_definition is null then
    raise exception 'ENEM_START_RPC_NOT_FOUND';
  end if;

  function_definition := replace(
    function_definition,
    'content_revision text := private.current_enem_content_revision();',
    'current_revision text := private.current_enem_content_revision();'
  );
  function_definition := replace(
    function_definition,
    '|| content_revision, 0)',
    '|| current_revision, 0)'
  );
  function_definition := replace(
    function_definition,
    'attempt.content_revision = content_revision',
    'attempt.content_revision = current_revision'
  );
  function_definition := replace(
    function_definition,
    E'    content_revision,\n    jsonb_build_object',
    E'    current_revision,\n    jsonb_build_object'
  );
  function_definition := replace(
    function_definition,
    '''content_revision'', content_revision',
    '''content_revision'', current_revision'
  );

  if position('content_revision text :=' in function_definition) > 0
     or position('attempt.content_revision = content_revision' in function_definition) > 0
     or position('''content_revision'', content_revision' in function_definition) > 0 then
    raise exception 'ENEM_START_RPC_REVISION_VARIABLE_REWRITE_FAILED';
  end if;

  execute function_definition;
end;
$migration$;

notify pgrst, 'reload schema';
