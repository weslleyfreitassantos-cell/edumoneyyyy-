begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.get_enem_simulation_attempt_v2(uuid)'::regprocedure)
    into definition;

  if definition is null
    or length(definition) - length(replace(definition, 'official_pdf_crop', '')) < 3
    or length(definition) - length(replace(definition, 'render_ready', '')) < 3
    or length(definition) - length(replace(definition, 'attempt_row.content_revision', '')) < 3
    or position('student.profile_id = auth.uid()' in definition) = 0
  then
    raise exception 'ENEM attempt media revision filter is incomplete';
  end if;
end;
$$;

rollback;
