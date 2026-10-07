begin;

-- Official ENEM area simulations have a fixed 45-question set. Comparing only
-- against question_count would miss records whose declared count was already
-- reduced to the number of linked questions.
with incomplete as (
  select
    simulation.id,
    simulation.question_count as declared_question_count,
    45 as official_question_count,
    count(simulation_question.id)::integer as linked_question_count
  from public.learning_simulations simulation
  left join public.learning_simulation_questions simulation_question
    on simulation_question.simulation_id = simulation.id
  where simulation.institution_id is null
    and simulation.status = 'PUBLISHED'
    and simulation.source_year is not null
    and simulation.simulation_type = 'AREA'
    and simulation.metadata->>'source_integrity' = 'VERIFIED'
    and simulation.metadata ? 'enem_import_key'
    and coalesce(simulation.metadata->>'dynamic_pool', 'false') <> 'true'
  group by simulation.id, simulation.question_count
  having count(simulation_question.id) < 45
)
update public.learning_simulations simulation
   set status = 'ARCHIVED',
       metadata = simulation.metadata || jsonb_build_object(
         'publication_guard', jsonb_build_object(
           'reason', 'INCOMPLETE_OFFICIAL_QUESTION_SET',
           'declared_question_count', incomplete.declared_question_count,
           'official_question_count', incomplete.official_question_count,
           'linked_question_count', incomplete.linked_question_count,
           'resolution', 'ARCHIVED_UNTIL_VERIFIED_SET_IS_AVAILABLE',
           'migration', '20261007000300_enem_official_area_completeness_guard'
         )
       ),
       updated_at = now()
  from incomplete
 where simulation.id = incomplete.id;

commit;
