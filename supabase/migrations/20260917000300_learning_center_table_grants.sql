-- The Learning Center policies are tenant- and role-scoped, but PostgREST
-- still needs table privileges before it can evaluate those policies.
begin;

grant select, insert, update
  on table public.learning_units
  to authenticated;

grant select, insert, update
  on table public.learning_skills
  to authenticated;

grant select, insert, update
  on table public.learning_activities
  to authenticated;

grant select, insert
  on table public.learning_questions
  to authenticated;

grant select, insert
  on table public.learning_assignments
  to authenticated;

grant select, insert
  on table public.learning_collections
  to authenticated;

grant select, insert
  on table public.learning_resources
  to authenticated;

grant select
  on table public.learning_attempts
  to authenticated;

grant select
  on table public.learning_skill_progress
  to authenticated;

commit;
