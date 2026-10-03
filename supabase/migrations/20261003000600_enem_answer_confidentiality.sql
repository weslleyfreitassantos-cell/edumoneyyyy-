begin;

-- Students may read question content, but the official answer must remain
-- server-side until submit_learning_simulation_attempt is called.
revoke select on table public.learning_question_bank from authenticated;
grant select (
  id,
  institution_id,
  owner_profile_id,
  package_type,
  source_type,
  source_name,
  source_year,
  source_exam,
  source_application,
  source_day,
  source_number,
  subject_area,
  domain,
  topic,
  subtopic,
  statement,
  options,
  explanation,
  solution,
  difficulty,
  estimated_minutes,
  provenance,
  source_reference,
  metadata,
  active,
  version,
  created_at,
  updated_at
) on table public.learning_question_bank to authenticated;

commit;
