-- This is a single reviewed official sample, kept small so the first release
-- proves the full provenance-to-simulation path without importing an entire exam.
do $$
declare
  v_skill_id uuid;
  v_question_id uuid;
  v_simulation_id uuid;
  v_source_reference constant text := 'https://download.inep.gov.br/enem/provas_e_gabaritos/2023_PV_impresso_D2_CD5.pdf';
  v_answer_key_reference constant text := 'https://download.inep.gov.br/enem/provas_e_gabaritos/2023_GB_impresso_D2_CD5.pdf';
  v_artifact_hash constant text := '818b89dec87eb0b77bf77f96d3e744502c7bdffb57166d2b5137beb3a6b9ac59';
  v_answer_key_hash constant text := '597ab9fab55c19351f1ac98d9d722ddbae6789943d9ae8da34e7776c28f532a4';
begin
  select canonical.id
    into v_skill_id
    from public.learning_curriculum_skills canonical
    join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id
   where catalog.code = 'TECESCOLA_CORE'
     and canonical.code = 'RATIO_PROPORTION';

  if v_skill_id is null then
    raise exception 'ENEM_SEED_CANONICAL_SKILL_MISSING';
  end if;

  select question.id
    into v_question_id
    from public.learning_question_bank question
   where question.package_type = 'ENEM'
     and question.source_type = 'ENEM_OFFICIAL_2023_D2_CD5'
     and question.source_year = 2023
     and question.source_number = 136;

  if v_question_id is null then
    insert into public.learning_question_bank(
      package_type, source_type, source_name, source_year, source_exam,
      source_application, source_day, source_number, subject_area, domain,
      topic, statement, options, correct_answer, explanation, difficulty,
      estimated_minutes, provenance, source_reference, metadata, active
    ) values (
      'ENEM', 'ENEM_OFFICIAL_2023_D2_CD5', 'INEP', 2023, 'ENEM',
      'REGULAR', 'D2', 136, 'MATEMATICA', 'GRANDEZAS', 'RATIO_PROPORTION',
      'Alguns estudos comprovam que os carboidratos fornecem energia ao corpo, preservam as proteínas estruturais dos músculos durante a prática de atividade física e ainda dão força para o cérebro coordenar os movimentos, o que de fato tem impacto positivo no desenvolvimento do praticante.' || E'\n\n' ||
      'Um casal realizará diariamente 30 minutos de caminhada, ingerindo, antes dessa atividade, a quantidade ideal de carboidratos recomendada. Para ter o consumo ideal apenas por meio do consumo de pão de forma integral, o casal planeja garantir o suprimento de pães para um período de 30 dias ininterruptos. Sabe-se que cada pacote desse pão vem com 18 fatias, e que cada uma delas tem 15 gramas de carboidratos.' || E'\n\n' ||
      'A quantidade mínima de pacotes de pães de forma necessários para prover o suprimento desse casal é',
      jsonb_build_array('1', '4', '6', '7', '8'), to_jsonb('7'::text),
      'Gabarito oficial: alternativa D.', 'MEDIUM', 4,
      'INEP ENEM 2023, segundo dia, caderno 5, questão 136. Prova e gabarito conferidos pelos hashes registrados.',
      v_source_reference,
      jsonb_build_object(
        'catalog_reference', 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos',
        'download_url', v_source_reference,
        'answer_key_url', v_answer_key_reference,
        'artifact_sha256', v_artifact_hash,
        'answer_key_sha256', replace(v_answer_key_hash, ' ', ''),
        'question_number', 136,
        'classification_source', 'TECESCOLA_DERIVED'
      ), true
    ) returning id into v_question_id;
  else
    update public.learning_question_bank
       set active = true,
           source_reference = v_source_reference,
           metadata = jsonb_build_object(
             'catalog_reference', 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos',
             'download_url', v_source_reference,
             'answer_key_url', v_answer_key_reference,
             'artifact_sha256', v_artifact_hash,
             'answer_key_sha256', replace(v_answer_key_hash, ' ', ''),
             'question_number', 136,
             'classification_source', 'TECESCOLA_DERIVED'
           ),
           updated_at = now()
     where id = v_question_id;
  end if;

  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
  values (v_question_id, v_skill_id, 'PRIMARY')
  on conflict (question_bank_id, canonical_skill_id) do nothing;

  select simulation.id
    into v_simulation_id
    from public.learning_simulations simulation
   where simulation.institution_id is null
     and simulation.title = 'ENEM 2023 · Matemática · Caderno 5';

  if v_simulation_id is null then
    insert into public.learning_simulations(
      institution_id, title, simulation_type, area, source_year,
      question_count, duration_minutes, status, metadata
    ) values (
      null, 'ENEM 2023 · Matemática · Caderno 5', 'HISTORICAL_EXAM',
      'MATEMATICA', 2023, 1, 4, 'PUBLISHED',
      jsonb_build_object(
        'source', 'INEP',
        'source_reference', v_source_reference,
        'answer_key_reference', v_answer_key_reference,
        'artifact_sha256', v_artifact_hash,
        'answer_key_sha256', replace(v_answer_key_hash, ' ', ''),
        'official_question_numbers', jsonb_build_array(136)
      )
    ) returning id into v_simulation_id;
  else
    update public.learning_simulations
       set simulation_type = 'HISTORICAL_EXAM',
           area = 'MATEMATICA',
           source_year = 2023,
           question_count = 1,
           duration_minutes = 4,
           status = 'PUBLISHED',
           metadata = jsonb_build_object(
             'source', 'INEP',
             'source_reference', v_source_reference,
             'answer_key_reference', v_answer_key_reference,
             'artifact_sha256', v_artifact_hash,
             'answer_key_sha256', replace(v_answer_key_hash, ' ', ''),
             'official_question_numbers', jsonb_build_array(136)
           ),
           updated_at = now()
     where id = v_simulation_id;
  end if;

  delete from public.learning_simulation_questions where simulation_id = v_simulation_id;
  insert into public.learning_simulation_questions(simulation_id, position, question_bank_id)
  values (v_simulation_id, 0, v_question_id);
end;
$$;
