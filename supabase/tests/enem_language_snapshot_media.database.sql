-- Disposable PostgreSQL integration test only. All fixture writes roll back.
begin;

insert into auth.users(id, email) values
  ('91000000-0000-0000-0000-000000000001', 'v1400-student-a@example.invalid'),
  ('91000000-0000-0000-0000-000000000002', 'v1400-student-b@example.invalid');

insert into public.profiles(id, full_name, email, role) values
  ('91000000-0000-0000-0000-000000000001', 'V1400 Student A', 'v1400-student-a@example.invalid', 'STUDENT'),
  ('91000000-0000-0000-0000-000000000002', 'V1400 Student B', 'v1400-student-b@example.invalid', 'STUDENT');

insert into public.institutions(id, name, plan) values
  ('92000000-0000-0000-0000-000000000001', 'V1400 ENEM fixture A', 'PROFESSIONAL'),
  ('92000000-0000-0000-0000-000000000002', 'V1400 ENEM fixture B', 'PROFESSIONAL');

insert into public.students(id, profile_id, institution_id, registration_number) values
  ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'V1400-A'),
  ('93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'V1400-B');

insert into public.learning_simulations(id, institution_id, title, simulation_type, area, question_count, duration_minutes, status, metadata) values
  ('94000000-0000-0000-0000-000000000001', null, 'V1400 Inglês fixture', 'SUBJECT', 'LINGUAGENS', 1, 10, 'PUBLISHED', '{"dynamic_pool":true,"enem_mode":"SUBJECT","enem_subject":"INGLES","enem_area":"LINGUAGENS"}'),
  ('94000000-0000-0000-0000-000000000002', null, 'V1400 Espanhol fixture', 'SUBJECT', 'LINGUAGENS', 2, 10, 'PUBLISHED', '{"dynamic_pool":true,"enem_mode":"SUBJECT","enem_subject":"ESPANHOL","enem_area":"LINGUAGENS"}'),
  ('94000000-0000-0000-0000-000000000003', null, 'V1400 Espanhol mismatch fixture', 'SUBJECT', 'LINGUAGENS', 1, 10, 'PUBLISHED', '{"dynamic_pool":true,"enem_mode":"SUBJECT","enem_subject":"ESPANHOL","enem_area":"LINGUAGENS"}');

insert into public.learning_question_bank(
  id, package_type, source_type, source_name, source_year, source_exam, source_application,
  source_day, source_number, subject_area, statement, options, correct_answer, metadata, active
) values (
  '95000000-0000-0000-0000-000000000001', 'ENEM', 'ENEM_OFFICIAL', 'V1400 official English media fixture',
  2022, 'ENEM', 'REGULAR', '1', 10, 'LINGUAGENS', 'Official English statement fixture.',
  '[{"letter":"A","text":"Alternative A"},{"letter":"B","text":"Alternative B"},{"letter":"C","text":"Alternative C"},{"letter":"D","text":"Alternative D"},{"letter":"E","text":"Alternative E"}]',
  '"A"',
  '{"content_revision":"source-faithful-v3","enem_area":"LINGUAGENS","enem_subject":"INGLES","source_integrity":"VERIFIED","statement_integrity":"VERIFIED","render_ready":true,"area_verified":true,"subject_verified":true,"official_answer_letter":"A","render_mode":"VISUAL_OPTIONS","options_integrity":"VERIFIED"}',
  true
);

insert into public.learning_question_bank(
  id, package_type, source_type, source_name, source_year, source_exam, source_application,
  source_day, source_number, subject_area, statement, options, correct_answer, metadata, active
) values (
  '95000000-0000-0000-0000-000000000004', 'ENEM', 'ENEM_OFFICIAL', 'V1400 verified English text fixture',
  2025, 'ENEM', 'REGULAR', 'D1', 1, 'LINGUAGENS', 'Verified official English text fixture.',
  '["Text alternative A","Text alternative B","Text alternative C","Text alternative D","Text alternative E"]',
  '"C"',
  jsonb_build_object(
    'content_revision', 'source-faithful-v3', 'enem_area', 'LINGUAGENS', 'enem_subject', 'INGLES',
    'source_integrity', 'VERIFIED', 'statement_integrity', 'VERIFIED', 'text_options_integrity', 'VERIFIED',
    'options_integrity', 'VERIFIED', 'render_ready', true, 'area_verified', true, 'subject_verified', true,
    'official_answer_letter', 'C', 'render_mode', 'VISUAL_OPTIONS',
    'source_provenance', jsonb_build_object('source_sha256', repeat('f', 64))
  ),
  true
);

insert into public.learning_enem_import_batches(
  id, manifest_version, manifest_fingerprint, source_catalog_reference, years, status, artifact_count, canonical_question_count, occurrence_count
) values (
  '97000000-0000-0000-0000-000000000001', 'v1400-test', repeat('a', 64), 'https://example.invalid/fixture', array[2022], 'IMPORTED', 1, 1, 1
);

insert into public.learning_enem_import_batches(
  id, manifest_version, manifest_fingerprint, source_catalog_reference, years, status, artifact_count, canonical_question_count, occurrence_count
) values (
  '97000000-0000-0000-0000-000000000002', 'v1400-text-test', repeat('b', 64), 'https://example.invalid/text-fixture', array[2025], 'IMPORTED', 1, 1, 1
);

insert into public.learning_enem_official_occurrences(
  id, batch_id, question_bank_id, canonical_fingerprint, year, exam, application, day, booklet,
  question_number, language, official_answer, quality_state, source_reference, exam_url,
  answer_key_url, artifact_sha256, answer_key_sha256, source_page, metadata
) values (
  '98000000-0000-0000-0000-000000000002', '97000000-0000-0000-0000-000000000002',
  '95000000-0000-0000-0000-000000000004', repeat('b', 64), 2025, 'ENEM', 'REGULAR', 'D1', 'TEST',
  1, 'ENGLISH', 'C', 'IMPORTED', 'V1400 verified text fixture', 'https://example.invalid/text-enem.pdf',
  'https://example.invalid/text-answer-key.pdf', repeat('f', 64), repeat('e', 64), 2, '{"booklet_color":"AZUL"}'
);

insert into public.learning_enem_structured_content(
  provider, provider_question_key, question_bank_id, occurrence_id, provider_year, provider_index,
  discipline, language, context_text, prompt_text, alternatives_json, provider_correct_alternative,
  essential_media_json, raw_hash, normalized_content_hash, match_method, match_level, match_confidence,
  verification_status, content_revision, render_mode, source_mapping_verified, answer_verified,
  structured_content_integrity, statement_complete, five_alternatives_complete, no_control_chars,
  no_previous_question_contamination, no_next_question_contamination, required_media_present,
  required_media_validated, source_metadata, content_blocks_json, source_exam, source_application,
  source_question_number, source_day, source_url, source_provider, rights_status, source_kind,
  content_acceptance_status
)
select
  'INEP_OFFICIAL_PDF_PARSE', 'v1400-english-text-fixture', question_bank.id, occurrence.id,
  2025, 1, 'linguagens', 'ENGLISH', question_bank.statement, '',
  private.enem_english_normalized_options_v1(question_bank.options),
  occurrence.official_answer, '[]', occurrence.artifact_sha256,
  encode(extensions.digest(convert_to(question_bank.statement || E'\n' || (
    select string_agg((option_item.value->>'letter') || ':' || (option_item.value->>'text'), E'\n' order by option_item.ordinality)
    from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options)) with ordinality option_item(value, ordinality)
  ), 'UTF8'), 'sha256'), 'hex'),
  'INEP_OFFICIAL_PDF_TEXT_PARSE', 'EXACT', 1.0, 'VERIFIED', private.current_enem_content_revision(),
  'STRUCTURED_TEXT', true, true, 'VERIFIED', true, true, true, true, true, false, false,
  jsonb_build_object(
    'evidence_method', 'INEP_OFFICIAL_PDF_PARSE', 'evidence_revision', 'official-text-layout-v1',
    'source_sha256', occurrence.artifact_sha256,
    'statement_sha256', encode(extensions.digest(convert_to(question_bank.statement, 'UTF8'), 'sha256'), 'hex'),
    'options_sha256', encode(extensions.digest(convert_to((select string_agg((option_item.value->>'letter') || ':' || (option_item.value->>'text'), E'\n' order by option_item.ordinality)
      from jsonb_array_elements(private.enem_english_normalized_options_v1(question_bank.options)) with ordinality option_item(value, ordinality)), 'UTF8'), 'sha256'), 'hex'),
    'media_status', 'NOT_DETECTED', 'source_integrity', 'VERIFIED', 'statement_integrity', 'VERIFIED',
    'options_integrity', 'VERIFIED', 'text_options_integrity', 'VERIFIED'
  ),
  '[]', 'ENEM', 'REGULAR', 1, 'D1', occurrence.exam_url, 'INEP', 'VERIFIED',
  'OFFICIAL_OCCURRENCE', 'ACCEPTED'
from public.learning_enem_official_occurrences occurrence
join public.learning_question_bank question_bank on question_bank.id = occurrence.question_bank_id
where occurrence.id = '98000000-0000-0000-0000-000000000002';

insert into public.learning_enem_official_occurrences(
  id, batch_id, question_bank_id, canonical_fingerprint, year, exam, application, day, booklet,
  question_number, language, official_answer, quality_state, source_reference, exam_url,
  answer_key_url, artifact_sha256, answer_key_sha256, source_page, metadata
) values (
  '98000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001', repeat('c', 64), 2022, 'ENEM', 'REGULAR', '1', 'AZUL',
  10, 'ENGLISH', 'A', 'IMPORTED', 'V1400 isolated source', 'https://example.invalid/enem.pdf',
  'https://example.invalid/answer-key.pdf', repeat('d', 64), repeat('e', 64), 1, '{"booklet_color":"AZUL"}'
);

do $$
declare
  role_name text;
  occurrence_id uuid;
  option_label text;
  crop_url text;
begin
  foreach occurrence_id in array array[
    '98000000-0000-0000-0000-000000000001'::uuid,
    '98000000-0000-0000-0000-000000000002'::uuid
  ] loop
    foreach role_name in array array['STATEMENT', 'OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'OPTION_E'] loop
      option_label := case when role_name = 'STATEMENT' then null else right(role_name, 1) end;
      crop_url := 'https://assets.example.invalid/v1400/source-faithful/' || lower(role_name) || '-' || right(occurrence_id::text, 1) || '.webp';
      insert into public.learning_enem_media_assets(
        occurrence_id, media_fingerprint, media_type, source_page, storage_path, quality_state, metadata
      ) values (
        occurrence_id, 'v1400-source-' || occurrence_id::text || '-' || role_name, 'image/webp', 1, crop_url, 'VALIDATED',
        jsonb_strip_nulls(jsonb_build_object(
          'asset_role', role_name,
          'option_label', option_label,
          'official_pdf_crop', true,
          'render_ready', true,
          'revision', 'source-faithful-v3',
          'public_url', crop_url,
          'crop', case when option_label is null then null else '{"left":0,"bottom":12,"width":280,"height":18}'::jsonb end
        ))
      );
    end loop;
  end loop;

  -- A page-level PDF marked with a different revision must never leak into an option.
  insert into public.learning_enem_media_assets(
    occurrence_id, media_fingerprint, media_type, source_page, storage_path, quality_state, metadata
  ) values (
    '98000000-0000-0000-0000-000000000001', 'v1400-page-decoy', 'application/pdf', 1,
    'https://assets.example.invalid/v1400/full-page.pdf', 'VALIDATED',
    '{"asset_role":"OPTION_A","option_label":"A","official_pdf_crop":true,"render_ready":true,"revision":"xequemat-archive-v1","public_url":"https://assets.example.invalid/v1400/full-page.pdf"}'
  );
end;
$$;

do $$
declare
  i integer;
  question_id uuid;
  structured_id uuid;
  options_json jsonb;
  source_url text;
begin
  for i in 1..2 loop
    question_id := ('95000000-0000-0000-0000-' || lpad((i + 1)::text, 12, '0'))::uuid;
    structured_id := ('96000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    source_url := 'https://example.invalid/spanish-source-' || i || '.pdf';
    select jsonb_agg(jsonb_build_object('letter', chr(64 + item), 'text', 'Respuesta de prueba ' || item) order by item)
      into options_json
      from generate_series(1, 5) item;

    insert into public.learning_question_bank(
      id, package_type, source_type, source_name, source_year, source_exam, source_application,
      source_day, source_number, subject_area, statement, options, correct_answer, metadata, active
    ) values (
      question_id, 'ENEM', 'ENEM_STRUCTURED_PROVIDER', 'V1400 disposable Spanish fixture', 2023,
      'ENEM', 'REGULAR', '1', 100 + i, 'LINGUAGENS', 'Enunciado sintético de teste isolado.',
      options_json, to_jsonb('A'::text),
      jsonb_build_object('enem_area', 'LINGUAGENS', 'enem_subject', 'ESPANHOL'), true
    );

    insert into public.learning_enem_structured_content(
      id, provider, provider_question_key, question_bank_id, provider_year, provider_index,
      discipline, language, context_text, prompt_text, alternatives_json, provider_correct_alternative,
      essential_media_json, raw_hash, normalized_content_hash, match_method, match_level, match_confidence,
      verification_status, content_revision, render_mode, source_mapping_verified, answer_verified,
      structured_content_integrity, statement_complete, five_alternatives_complete, no_control_chars,
      no_previous_question_contamination, no_next_question_contamination, required_media_present,
      required_media_validated, source_metadata, content_blocks_json, source_exam, source_application,
      source_question_number, source_url, source_provider, rights_status, source_kind, content_acceptance_status
    ) values (
      structured_id, 'xequemat', 'v1400-spanish-fixture-' || i, question_id, 2023, i,
      'linguagens', 'SPANISH', 'El texto describe una situación cotidiana con información suficiente para compreender a ideia principal.',
      'Según el texto, ¿qué alternativa resume mejor la situación descrita?', options_json,
      'A', '[]', repeat('a', 64), 'v1400-spanish-accepted-' || i,
      'EXACT_SOURCE_FIXTURE', 'HIGH_CONFIDENCE', 1.0, 'VERIFIED', private.current_enem_content_revision(),
      'STRUCTURED_TEXT', true, true, 'VERIFIED', true, true, true, true, true, false, false,
      '{"test_fixture":true}', '[]', 'ENEM', 'REGULAR', 100 + i, source_url, 'xequemat', 'VERIFIED',
      'STRUCTURED_PROVIDER', 'ACCEPTED'
    );
  end loop;
end;
$$;

insert into public.learning_simulation_attempts(
  id, institution_id, simulation_id, student_id, total_questions, content_revision
) values (
  '99000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000001',
  1, private.current_enem_content_revision()
);

do $$
begin
  begin
    insert into public.learning_simulation_attempt_questions(attempt_id, position, question_bank_id, structured_content_id)
    values (
      '99000000-0000-0000-0000-000000000001', 1,
      '95000000-0000-0000-0000-000000000002',
      '96000000-0000-0000-0000-000000000002'
    );
    raise exception 'Spanish snapshot mismatch should have been rejected';
  exception when others then
    if sqlerrm <> 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH' then raise; end if;
  end;
end;
$$;

insert into public.learning_simulation_attempts(
  id, institution_id, simulation_id, student_id, total_questions, content_revision
) values (
  '99000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000002',
  '94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000002',
  1, private.current_enem_content_revision()
);

do $$
declare
  structured_id uuid;
begin
  select id into structured_id
  from public.learning_enem_structured_content
  where provider = 'INEP_OFFICIAL_PDF_PARSE'
    and provider_question_key = 'v1400-english-text-fixture';

  if structured_id is null then
    raise exception 'Verified English structured fixture is missing';
  end if;

  update public.learning_enem_structured_content
  set alternatives_json = jsonb_set(alternatives_json, '{0,text}', '"Tampered alternative"'::jsonb, false)
  where id = structured_id;

  begin
    insert into public.learning_simulation_attempt_questions(
      attempt_id, position, question_bank_id, occurrence_id, structured_content_id
    ) values (
      '99000000-0000-0000-0000-000000000003', 1,
      '95000000-0000-0000-0000-000000000004',
      '98000000-0000-0000-0000-000000000002', structured_id
    );
    raise exception 'Tampered English alternatives should not enter a new attempt';
  exception when others then
    if sqlerrm <> 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH' then raise; end if;
  end;

  update public.learning_enem_structured_content
  set alternatives_json = private.enem_english_normalized_options_v1((
    select question_bank.options
    from public.learning_question_bank question_bank
    where question_bank.id = '95000000-0000-0000-0000-000000000004'
  ))
  where id = structured_id;
end;
$$;

insert into public.learning_simulation_attempts(
  id, institution_id, simulation_id, student_id, status, total_questions, content_revision,
  started_at, completed_at, duration_seconds, score, correct_count, answers
) values (
  '99000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001',
  'ABANDONED', 1, 'source-faithful-v3', now() - interval '1 hour', now(), 60, 0, 0, '{}'
);

insert into public.learning_simulation_attempt_questions(attempt_id, position, question_bank_id, occurrence_id)
values (
  '99000000-0000-0000-0000-000000000002', 1,
  '95000000-0000-0000-0000-000000000001', '98000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);

do $$
declare
  english_start jsonb;
  spanish_start jsonb;
  english_attempt uuid;
  spanish_attempt uuid;
  english_payload jsonb;
  legacy_payload jsonb;
  spanish_payload jsonb;
  english_answers jsonb;
  spanish_answers jsonb;
  navigation jsonb;
  result jsonb;
  question_ids uuid[];
begin
  english_start := public.start_enem_simulation_attempt_v3(
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001', null
  );
  english_attempt := (english_start->>'attempt_id')::uuid;
  english_payload := public.get_enem_simulation_attempt_v2(english_attempt);

  if jsonb_array_length(english_payload->'questions') <> 1
     or english_payload->'questions'->0->>'source_kind' <> 'OFFICIAL_OCCURRENCE'
     or english_payload->'questions'->0->'structured_content'->>'render_mode' <> 'STRUCTURED_TEXT'
     or english_payload->'questions'->0->'structured_content'->>'context' <> 'Verified official English text fixture.'
     or jsonb_array_length(english_payload->'questions'->0->'statement_assets') <> 0
     or jsonb_array_length(english_payload->'questions'->0->'options') <> 5
     or exists (
       select 1
       from jsonb_array_elements(english_payload->'questions'->0->'options') option_item
       where jsonb_array_length(option_item->'assets') <> 0
          or nullif(btrim(option_item->>'text'), '') is null
     )
     or english_payload::text like '%full-page.pdf%' then
    raise exception 'approved English text must return a structured prompt and five individual text options';
  end if;
  if english_payload->'questions'->0->>'question_bank_id' <> '95000000-0000-0000-0000-000000000004' then
    raise exception 'new English attempts must select the verified structured question instead of the unreviewed visual question';
  end if;

  legacy_payload := public.get_enem_simulation_attempt_v2('99000000-0000-0000-0000-000000000002');
  if jsonb_typeof(legacy_payload->'questions'->0->'structured_content') is distinct from 'null'
     or jsonb_array_length(legacy_payload->'questions'->0->'statement_assets') <> 1
     or jsonb_array_length(legacy_payload->'questions'->0->'options'->0->'assets') <> 1 then
    raise exception 'previously saved visual English attempts must remain readable without changing their snapshot';
  end if;

  spanish_start := public.start_enem_simulation_attempt_v3(
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000002', null
  );
  spanish_attempt := (spanish_start->>'attempt_id')::uuid;
  spanish_payload := public.get_enem_simulation_attempt_v2(spanish_attempt);

  if spanish_start->>'created' <> 'true'
     or (spanish_start->>'question_count')::integer <> 2
     or jsonb_array_length(spanish_payload->'questions') <> 2
     or spanish_payload->'questions'->0->'structured_content'->>'prompt' not like 'Según el texto%'
     or jsonb_array_length(spanish_payload->'questions'->0->'options') <> 5 then
    raise exception 'Spanish attempt must start with the validated structured question and five alternatives';
  end if;

  select array_agg((question->>'question_bank_id')::uuid order by question_position)
    into question_ids
    from jsonb_array_elements(spanish_payload->'questions') with ordinality as question_rows(question, question_position);
  navigation := public.save_learning_simulation_attempt_navigation(
    spanish_attempt,
    jsonb_build_object('current_index', 1, 'flagged', jsonb_build_array(question_ids[2]::text))
  );
  if navigation->'navigation_state'->>'current_index' <> '1' then
    raise exception 'Spanish attempt navigation did not persist';
  end if;

  spanish_answers := jsonb_build_array(
    jsonb_build_object('question_bank_id', question_ids[1], 'answer', 'A'),
    jsonb_build_object('question_bank_id', question_ids[2], 'answer', 'A')
  );
  perform public.save_enem_simulation_attempt_answers_v2(spanish_attempt, spanish_answers);
  result := public.submit_enem_simulation_attempt_v2(spanish_attempt, spanish_answers, 45);
  if (result->>'score')::integer <> 100 or (result->>'correct_count')::integer <> 2 then
    raise exception 'Spanish attempt did not score and conclude correctly';
  end if;

  english_answers := jsonb_build_array(
    jsonb_build_object('question_bank_id', english_payload->'questions'->0->>'question_bank_id', 'answer', 'C')
  );
  perform public.save_enem_simulation_attempt_answers_v2(english_attempt, english_answers);
  result := public.submit_enem_simulation_attempt_v2(english_attempt, english_answers, 30);
  if (result->>'score')::integer <> 100 then
    raise exception 'English official attempt did not complete correctly';
  end if;

  perform set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
  begin
    perform public.get_enem_simulation_attempt_v2(spanish_attempt);
    raise exception 'Cross-student ENEM attempt access should have been denied';
  exception when others then
    if sqlerrm <> 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED' then raise; end if;
  end;
end;
$$;

rollback;
