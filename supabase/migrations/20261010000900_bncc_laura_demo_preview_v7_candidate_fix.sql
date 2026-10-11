begin;

-- The four demo skills are still CANDIDATE because pedagogical review is
-- pending. Allow that state only inside the already restricted v7 preview
-- branch; published skills continue to require MAPPED.
do $$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace
        on namespace.oid = proc.pronamespace
     where namespace.nspname in ('public', 'private')
       and proc.proname in (
         'list_student_guided_learning_targets',
         'assert_bncc_guided_session_scope',
         'start_guided_learning_session_v4',
         'assert_published_v4_session_target'
       )
       and pg_get_functiondef(proc.oid) like '%skill.bncc_alignment_status = ''MAPPED''%'
  loop
    execute replace(
      function_row.definition,
      'skill.bncc_alignment_status = ''MAPPED''',
      'skill.bncc_alignment_status in (''MAPPED'', ''CANDIDATE'')'
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
