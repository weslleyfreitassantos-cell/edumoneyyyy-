begin;

-- The allowlist is present only for the authorized demo institution. Align its
-- private membership check with the production ACTIVE enrollment value.
do $$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace
        on namespace.oid = proc.pronamespace
     where namespace.nspname = 'private'
       and proc.proname = 'bncc_demo_preview_allowed'
       and pg_get_functiondef(proc.oid) like '%enrollment.status = ''active''%'
  loop
    execute replace(
      function_row.definition,
      'enrollment.status = ''active''',
      'upper(enrollment.status::text) = ''ACTIVE'''
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
