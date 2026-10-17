begin;

-- Authorial V5 content is compiled for review but remains inactive and unaligned.
-- No student can receive it until separate pedagogical and publication gates pass.
do $seed_question_first_content_v5$
declare
  v_catalog_id uuid;
  v_skill_id uuid;
  v_lesson_id uuid;
  v_set_id uuid;
  v_question_id uuid;
  v_question record;
begin
  select id into v_catalog_id
    from public.learning_curriculum_catalogs
   where code = 'TECESCOLA_CORE' and version = '1.0'
   limit 1;
  if v_catalog_id is null then raise exception 'V5_CONTENT_CATALOG_MISSING'; end if;
  select id into v_skill_id
    from public.learning_curriculum_skills
   where catalog_id = v_catalog_id and code = 'MATH_SUCCESSIVE_PERCENT_CHANGE';
  if v_skill_id is null then raise exception 'V5_CONTENT_SKILL_MISSING'; end if;

  insert into public.learning_skill_lessons(
    canonical_skill_id, version, title, summary, content_markdown,
    worked_example, tips, estimated_minutes, active, metadata
  ) values (
    v_skill_id, 5, 'A base muda a cada variação percentual', 'Uma variação percentual incide sobre o valor existente naquele momento. Por isso, a base da segunda etapa costuma ser diferente da base inicial.', 'Em cada etapa, transforme a taxa em um fator multiplicativo: um aumento de p% corresponde a 1 + p/100; uma redução de p% corresponde a 1 - p/100. Multiplique o valor atual pelo fator e use o resultado como nova base. Somar as taxas só funciona em situações especiais; não é uma regra geral.',
    'Um valor de R$ 200 aumenta 10% e depois diminui 10%. Primeiro: 200 x 1,10 = 220. Depois, a redução incide sobre 220: 220 x 0,90 = 198. O resultado não volta a R$ 200 porque as duas taxas incidem sobre bases diferentes.', array['Escreva a base antes de cada etapa.', 'Converta cada aumento ou redução em um fator multiplicativo.', 'Confira se a resposta final tem a unidade e a escala esperadas.']::text[], 5, false, '{"content_pack":"TECESCOLA_CORE_V5_QUESTION_FIRST","content_id":"v5-math-successive-percent-change","content_authoring_status":"AUTHORED","pedagogical_review_status":"PEDAGOGICAL_REVIEW_PENDING","publication_status":"STAGING","bncc_alignment_status":"NOT_CLAIMED"}'::jsonb
  ) on conflict (canonical_skill_id, version) do nothing;
  select id into v_lesson_id from public.learning_skill_lessons
   where canonical_skill_id = v_skill_id and version = 5
     and metadata->>'content_id' = 'v5-math-successive-percent-change' and active = false;
  if v_lesson_id is null then raise exception 'V5_CONTENT_LESSON_CONFLICT'; end if;

  for v_question in
    select * from jsonb_to_recordset('[{"id":"v5-math-successive-probe-01","purpose":"PROBE","difficulty":"EASY","cognitiveProcess":"APPLY","contextFamily":"MENSALIDADE","statement":"Uma mensalidade de R$ 80 recebe reajuste de 15%. No mês seguinte, o novo valor recebe desconto de 10%. Qual é o valor final?","options":["R$ 80,00","R$ 84,00","R$ 92,00","R$ 82,80"],"correctAnswer":"R$ 82,80","explanation":"O reajuste leva a mensalidade a R$ 92,00. O desconto seguinte usa R$ 92,00 como base: 92 x 0,90 = R$ 82,80.","hint":"Calcule primeiro o valor depois do reajuste; use esse resultado como base do desconto.","errorFocus":"BASE_DA_SEGUNDA_ETAPA","misconceptions":{"R$ 84,00":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":1},{"id":"v5-math-successive-probe-02","purpose":"PROBE","difficulty":"EASY","cognitiveProcess":"APPLY","contextFamily":"RESERVA_FINANCEIRA","statement":"Uma reserva de R$ 200 cresce 10% em um mês e mais 5% no mês seguinte. Qual é o saldo ao final das duas etapas?","options":["R$ 210,00","R$ 231,00","R$ 220,00","R$ 230,00"],"correctAnswer":"R$ 231,00","explanation":"A primeira etapa resulta em R$ 220,00. Cinco por cento de R$ 220,00 são R$ 11,00, totalizando R$ 231,00.","hint":"O segundo aumento incide sobre o saldo depois do primeiro aumento, não sobre R$ 200,00.","errorFocus":"TAXAS_SOMADAS","misconceptions":{"R$ 230,00":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":2},{"id":"v5-math-successive-practice-01","purpose":"PRACTICE","difficulty":"MEDIUM","cognitiveProcess":"APPLY","contextFamily":"COMPRA_DE_MATERIAL","statement":"Uma compra de R$ 250 recebe desconto de 12%. Depois, o valor com desconto sofre aumento de 8%. Quanto passa a custar?","options":["R$ 237,60","R$ 220,00","R$ 240,00","R$ 270,00"],"correctAnswer":"R$ 237,60","explanation":"Depois do desconto: 250 x 0,88 = R$ 220,00. O aumento incide sobre R$ 220,00: 220 x 1,08 = R$ 237,60.","hint":"Represente o desconto por 0,88 e o aumento seguinte por 1,08.","errorFocus":"ORDEM_E_BASE","misconceptions":{"R$ 240,00":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":1},{"id":"v5-math-successive-practice-02","purpose":"PRACTICE","difficulty":"MEDIUM","cognitiveProcess":"APPLY","contextFamily":"PLANO_DE_ASSINATURA","statement":"Um plano custa R$ 120,00. O preço aumenta 5% em cada um de dois meses consecutivos. Qual é o preço depois do segundo aumento?","options":["R$ 126,00","R$ 132,00","R$ 132,30","R$ 133,20"],"correctAnswer":"R$ 132,30","explanation":"Após o primeiro aumento, 120 x 1,05 = R$ 126,00. No segundo mês, 126 x 1,05 = R$ 132,30.","hint":"Aplique o fator 1,05 duas vezes, atualizando o valor entre as multiplicações.","errorFocus":"REUTILIZACAO_DA_BASE_INICIAL","misconceptions":{"R$ 132,00":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":2},{"id":"v5-math-successive-transfer-01","purpose":"TRANSFER","difficulty":"MEDIUM","cognitiveProcess":"INTERPRET","contextFamily":"POPULACAO_DE_PEIXES","statement":"Um viveiro tinha 1.200 peixes. A população diminuiu 15% e, depois, aumentou 15% em relação ao total restante. Quantos peixes havia ao final, considerando o modelo percentual?","options":["1.020","1.173","1.200","1.380"],"correctAnswer":"1.173","explanation":"A diminuição deixa 1.200 x 0,85 = 1.020. O aumento seguinte é 15% de 1.020, isto é, 153; o total passa a 1.173.","hint":"A expressão ''em relação ao total restante'' define a base do aumento final.","errorFocus":"PERCENTUAL_SOBRE_RESTANTE","misconceptions":{"1.200":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":1},{"id":"v5-math-successive-transfer-02","purpose":"TRANSFER","difficulty":"HARD","cognitiveProcess":"ANALYZE","contextFamily":"CAPACIDADE_DE_RESERVATORIO","statement":"Um reservatório comporta 800 mil litros. Uma obra reduz temporariamente a capacidade em 12,5%; uma ampliação posterior aumenta em 20% a capacidade já reduzida. Qual fica sendo a capacidade?","options":["700 mil litros","800 mil litros","840 mil litros","860 mil litros"],"correctAnswer":"840 mil litros","explanation":"A redução de 12,5% corresponde a multiplicar por 0,875: 800 x 0,875 = 700. A ampliação de 20% usa 700 como base: 700 x 1,20 = 840 mil litros.","hint":"Escreva cada etapa como um fator e aplique o segundo fator ao resultado da primeira.","errorFocus":"CONVERSAO_PARA_FATOR","misconceptions":{"860 mil litros":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":2},{"id":"v5-math-successive-lock-in-01","purpose":"LOCK_IN","difficulty":"HARD","cognitiveProcess":"ANALYZE","contextFamily":"AREA_PLANTADA","statement":"Uma área plantada de 100 hectares aumenta 30% em um ano e diminui 20% no seguinte. Qual afirmação descreve corretamente o resultado?","options":["Fica com 104 hectares porque a redução incide sobre 130.","Volta a 100 hectares porque as taxas se anulam.","Fica com 110 hectares porque o saldo das taxas é 10%.","Fica com 130 hectares porque a redução não altera a base."],"correctAnswer":"Fica com 104 hectares porque a redução incide sobre 130.","explanation":"O aumento leva a área a 130 hectares. Vinte por cento de 130 são 26; restam 104 hectares.","hint":"Antes de calcular a redução, determine a área após o aumento de 30%.","errorFocus":"VARIACAO_TOTAL_VS_SALDO_DAS_TAXAS","misconceptions":{"Volta a 100 hectares porque as taxas se anulam.":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":1},{"id":"v5-math-successive-lock-in-02","purpose":"LOCK_IN","difficulty":"HARD","cognitiveProcess":"COMPARE","contextFamily":"EVOLUCAO_SALARIAL","statement":"Um salário de R$ 600 recebe aumento de 12% e, no período seguinte, redução de 12% sobre o novo salário. Qual valor resulta?","options":["R$ 591,36","R$ 528,00","R$ 600,00","R$ 672,00"],"correctAnswer":"R$ 591,36","explanation":"O aumento resulta em R$ 672,00. A redução é 12% de R$ 672,00, ou R$ 80,64; restam R$ 591,36.","hint":"Taxas iguais em sentidos opostos não se anulam quando usam bases diferentes.","errorFocus":"CANCELAMENTO_INDEVIDO","misconceptions":{"R$ 600,00":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":2},{"id":"v5-math-successive-review-01","purpose":"REVIEW","difficulty":"HARD","cognitiveProcess":"EVALUATE","contextFamily":"COMPARACAO_DE_INVESTIMENTOS","statement":"Um aporte de R$ 1.000 rende 5% em cada um de dois períodos. Outro aporte igual rende 10% uma única vez. Qual comparação dos valores finais é correta?","options":["Os dois terminam em R$ 1.100,00.","Dois períodos de 5% terminam em R$ 1.102,50, R$ 2,50 acima do rendimento único de 10%.","Dois períodos de 5% terminam em R$ 1.105,00, R$ 5,00 acima.","O rendimento único termina acima, em R$ 1.150,00."],"correctAnswer":"Dois períodos de 5% terminam em R$ 1.102,50, R$ 2,50 acima do rendimento único de 10%.","explanation":"O fator dos dois períodos é 1,05 x 1,05 = 1,1025. Em R$ 1.000, isso resulta em R$ 1.102,50; um aumento único de 10% resulta em R$ 1.100,00.","hint":"Compare os fatores finais: 1,05 x 1,05 e 1,10.","errorFocus":"COMPOSICAO_DE_FATORES","misconceptions":{"Os dois terminam em R$ 1.100,00.":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":1},{"id":"v5-math-successive-review-02","purpose":"REVIEW","difficulty":"HARD","cognitiveProcess":"ANALYZE","contextFamily":"RECONSTRUCAO_DE_VALOR","statement":"Depois de uma redução de 10% e de um aumento de 20% sobre o valor reduzido, um equipamento custa R$ 108,00. Qual era o valor inicial?","options":["R$ 90,00","R$ 108,00","R$ 120,00","R$ 100,00"],"correctAnswer":"R$ 100,00","explanation":"O fator combinado é 0,90 x 1,20 = 1,08. Portanto, valor inicial x 1,08 = R$ 108,00, e o valor inicial era R$ 100,00.","hint":"Encontre primeiro o fator combinado e divida o valor final por ele.","errorFocus":"RACIOCINIO_INVERSO_COM_FATORES","misconceptions":{"R$ 108,00":["SUCCESSIVE_PERCENTAGES_CANCELLED"]},"position":2}]'::jsonb) as item(
      id text, purpose text, difficulty text, "cognitiveProcess" text,
      "contextFamily" text, statement text, options jsonb, "correctAnswer" text,
      explanation text, hint text, "errorFocus" text, misconceptions jsonb, position integer
    )
  loop
    insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, active, metadata)
    values ('GLOBAL', v_skill_id, v_question.purpose, 5, false,
      jsonb_build_object('content_pack', 'TECESCOLA_CORE_V5_QUESTION_FIRST', 'content_id', 'v5-math-successive-percent-change',
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING', 'publication_status', 'STAGING',
        'bncc_alignment_status', 'NOT_CLAIMED'))
    on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do nothing;
    select id into v_set_id from public.learning_question_sets
     where scope = 'GLOBAL' and canonical_skill_id = v_skill_id
       and purpose = v_question.purpose and version = 5
       and metadata->>'content_id' = 'v5-math-successive-percent-change' and active = false;
    if v_set_id is null then raise exception 'V5_CONTENT_QUESTION_SET_CONFLICT'; end if;

    select id into v_question_id from public.learning_question_bank
     where source_type = 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING' and metadata->>'content_id' = v_question.id;
    if v_question_id is null then
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty,
        estimated_minutes, provenance, metadata, active
      ) values (
        'TECESCOLA', 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING', 'TecEscola Question First V5 - Staging',
        'MATHEMATICS', 'PORCENTAGEM', 'variacoes sucessivas',
        v_question.statement, v_question.options, to_jsonb(v_question."correctAnswer"),
        v_question.explanation, v_question.difficulty, 2,
        'TECESCOLA_CORE_V5_AUTHORED',
        jsonb_build_object('content_pack', 'TECESCOLA_CORE_V5_QUESTION_FIRST', 'content_id', v_question.id,
          'purpose', v_question.purpose, 'context_family', v_question."contextFamily",
          'cognitive_process', v_question."cognitiveProcess", 'error_focus', v_question."errorFocus",
          'remediation_hint', v_question.hint, 'misconceptions', v_question.misconceptions,
          'content_authoring_status', 'AUTHORED', 'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING',
          'publication_status', 'STAGING', 'bncc_alignment_status', 'NOT_CLAIMED'), false
      ) returning id into v_question_id;
    end if;
    if v_question_id is null then raise exception 'V5_CONTENT_QUESTION_INSERT_FAILED'; end if;
    update public.learning_question_bank set active = false
     where id = v_question_id and source_type = 'TECESCOLA_CORE_V5_QUESTION_FIRST_STAGING';
    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    values (v_question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;
    insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
    values (v_set_id, v_question_id, v_question.position)
    on conflict (question_set_id, question_bank_id) do nothing;
  end loop;
end;
$seed_question_first_content_v5$;

commit;
-- CONTENT_SHA256=1be38e12db74fefc5dd7160bc5cf4a4a803dfb027bc8716693c9a0660da73152
