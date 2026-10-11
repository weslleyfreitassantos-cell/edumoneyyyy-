begin;

-- V8 can select a bounded subset from a larger question set. The legacy
-- submitter scored every item in the set, which made the UI show one question
-- while the server graded hidden questions too. Keep the server as the source
-- of truth, but grade only answers that belong to the current set.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'public'
       and proc.proname = 'submit_guided_learning_step_v4'
       and pg_get_functiondef(proc.oid) like '%where set_item.question_set_id=step_row.question_set_id order by set_item.position loop%'
  loop
    execute replace(
      function_row.definition,
      'where set_item.question_set_id=step_row.question_set_id order by set_item.position loop',
      'where set_item.question_set_id=step_row.question_set_id and exists (select 1 from jsonb_array_elements(p_answers) submitted_answer where submitted_answer->>''question_bank_id''=bank.id::text) order by set_item.position loop'
    );
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
