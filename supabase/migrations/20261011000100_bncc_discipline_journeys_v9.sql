begin;

create table public.learning_bncc_discipline_journeys (
  id uuid primary key default extensions.uuid_generate_v4(),
  journey_code text not null unique,
  canonical_subject_id uuid not null references public.learning_canonical_subjects(id) on delete restrict,
  execution_skill_id uuid not null unique references public.learning_curriculum_skills(id) on delete restrict,
  unit_code text not null,
  unit_title text not null,
  title text not null,
  suggested_stage text not null,
  suggested_grade smallint not null check (suggested_grade between 1 and 12),
  publication_status text not null default 'DEMO_PREVIEW'
    check (publication_status in ('DEMO_PREVIEW', 'STAGING', 'PUBLISHED')),
  mapping_status text not null default 'MAPPING_PENDING'
    check (mapping_status in ('MAPPING_PENDING', 'MAPPED', 'HUMAN_REVIEW_BLOCKED')),
  pedagogical_review_status text not null default 'PEDAGOGICAL_REVIEW_PENDING'
    check (pedagogical_review_status in ('PEDAGOGICAL_REVIEW_PENDING', 'PEDAGOGICAL_REVIEWED')),
  content_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_bncc_discipline_journey_skills (
  journey_id uuid not null references public.learning_bncc_discipline_journeys(id) on delete cascade,
  official_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  relation_type text not null check (relation_type in ('PRIMARY', 'SUPPORTING')),
  mapping_status text not null default 'MAPPING_PENDING'
    check (mapping_status in ('MAPPING_PENDING', 'MAPPED', 'HUMAN_REVIEW_BLOCKED')),
  mapping_reason text not null,
  source_document text not null,
  source_section text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (journey_id, official_skill_id)
);

create table private.learning_demo_subject_bindings (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  canonical_subject_id uuid not null references public.learning_canonical_subjects(id) on delete restrict,
  mapping_source text not null,
  created_at timestamptz not null default now(),
  primary key (institution_id, subject_id),
  unique (institution_id, canonical_subject_id)
);

revoke all on table public.learning_bncc_discipline_journeys,
  public.learning_bncc_discipline_journey_skills,
  private.learning_demo_subject_bindings from public, anon, authenticated;

alter table public.learning_guided_sessions
  add column discipline_journey_id uuid references public.learning_bncc_discipline_journeys(id) on delete restrict;

create index learning_guided_sessions_discipline_journey_idx
  on public.learning_guided_sessions(institution_id, student_id, discipline_journey_id, status, updated_at desc)
  where discipline_journey_id is not null;

create unique index learning_guided_sessions_one_active_discipline_journey_idx
  on public.learning_guided_sessions(institution_id, student_id, discipline_journey_id)
  where discipline_journey_id is not null and status in ('ACTIVE', 'PAUSED');

do $bindings$
declare
  missing_count integer;
begin
  with expected(subject_code, subject_name, canonical_code) as (
    values
      ('ART', 'ARTE', 'ART'),
      ('BIO', 'BIOLOGIA', 'BIOLOGY'),
      ('EDF', 'EDUCAÇÃO FÍSICA', 'PHYSICAL_EDUCATION'),
      ('FIL', 'FILOSOFIA', 'PHILOSOPHY'),
      ('FIS', 'FÍSICA', 'PHYSICS'),
      ('GEO', 'GEOGRAFIA', 'GEOGRAPHY'),
      ('HIS', 'HISTÓRIA', 'HISTORY'),
      ('ING', 'LÍNGUA INGLESA', 'ENGLISH'),
      ('LP', 'LÍNGUA PORTUGUESA', 'PORTUGUESE'),
      ('MAT', 'MATEMÁTICA', 'MATHEMATICS'),
      ('QUI', 'QUÍMICA', 'CHEMISTRY'),
      ('SOC', 'SOCIOLOGIA', 'SOCIOLOGY')
  ), demo_subjects as (
    select preview.institution_id, subject.id as subject_id, canonical.id as canonical_subject_id
      from private.bncc_demo_preview_institutions preview
      cross join expected
      join public.subjects subject
        on subject.institution_id = preview.institution_id
       and subject.active
       and upper(btrim(subject.code)) = expected.subject_code
       and upper(btrim(subject.name)) = expected.subject_name
      join public.learning_canonical_subjects canonical
        on canonical.code = expected.canonical_code
       and canonical.active
     where preview.active
  )
  insert into private.learning_demo_subject_bindings(
    institution_id, subject_id, canonical_subject_id, mapping_source
  )
  select institution_id, subject_id, canonical_subject_id, 'V9_DEMO_EXACT_SUBJECT_CODE_AND_NAME'
    from demo_subjects
  on conflict (institution_id, subject_id) do update
    set canonical_subject_id = excluded.canonical_subject_id,
        mapping_source = excluded.mapping_source;

  select count(*) into missing_count
    from private.bncc_demo_preview_institutions preview
   where preview.active
     and (select count(*) from private.learning_demo_subject_bindings binding
           where binding.institution_id = preview.institution_id) <> 12;
  if missing_count > 0 then
    raise exception 'V9_DEMO_SUBJECT_BINDINGS_INCOMPLETE';
  end if;
end;
$bindings$;

-- V4 execution skills remain separate from the official BNCC skill records.
-- This keeps discipline-specific mastery independent when an official area
-- skill is later linked to more than one discipline.
update public.learning_curriculum_skills execution_skill
   set canonical_subject_id = canonical_subject.id
  from public.learning_curriculum_catalogs catalog,
       public.learning_canonical_subjects canonical_subject
 where execution_skill.catalog_id = catalog.id
   and catalog.code = 'TECESCOLA_CORE'
   and catalog.version = '1.0'
   and execution_skill.canonical_subject_id is null
   and execution_skill.code in (
     'ART_COMPARE_COMPOSITIONS', 'BIOLOGY_CELL_FUNCTION', 'CHEMISTRY_STOICHIOMETRY',
     'PE_ANALYZE_MOVEMENT', 'PHILOSOPHY_EVALUATE_ARGUMENT', 'PHYSICS_AVERAGE_SPEED',
     'GEOGRAPHY_INTERPRET_TERRITORY', 'HISTORY_INTERPRET_EVIDENCE', 'ENGLISH_INFER_FROM_TEXT',
     'PORTUGUESE_ARGUMENT_EVIDENCE', 'MATH_PERCENT_OF_QUANTITY', 'SOCIOLOGY_EXPLAIN_INSTITUTIONS'
   )
   and canonical_subject.code = execution_skill.subject_area
   and canonical_subject.active;

with candidates(
  journey_code, canonical_subject_code, execution_skill_code, unit_code,
  unit_title, title, official_code, mapping_reason
) as (
  values
    ('ART_COMPOSITION_FOUNDATIONS', 'ART', 'ART_COMPARE_COMPOSITIONS', 'ART_VISUAL_LANGUAGE', 'Linguagens artísticas', 'Comparar escolhas de composição', 'EM13LGG602', 'Candidato: comparar elementos de composição pode apoiar a apreciação de manifestações artísticas; validar o recorte disciplinar e os exemplos antes de afirmar alinhamento.'),
    ('BIOLOGY_CELL_FOUNDATIONS', 'BIOLOGY', 'BIOLOGY_CELL_FUNCTION', 'BIOLOGY_CELL', 'Organização dos seres vivos', 'Relacionar estrutura e função celular', 'EM13CNT202', 'Candidato: a habilidade oficial trata níveis de organização da vida; validar se as atividades existentes cobrem adequadamente esse escopo.'),
    ('PHYSICAL_EDUCATION_MOVEMENT_FOUNDATIONS', 'PHYSICAL_EDUCATION', 'PE_ANALYZE_MOVEMENT', 'PE_BODY_MOVEMENT', 'Práticas corporais e movimento', 'Analisar o movimento corporal', 'EM13LGG501', 'Candidato: a habilidade oficial trata o uso consciente do movimento em práticas corporais; validar a correspondência entre os exercícios e esse objetivo.'),
    ('PHILOSOPHY_ARGUMENT_FOUNDATIONS', 'PHILOSOPHY', 'PHILOSOPHY_EVALUATE_ARGUMENT', 'PHILOSOPHY_REASONING', 'Pensamento filosófico', 'Avaliar argumentos', 'EM13CHS103', 'Candidato: a habilidade oficial inclui composição de argumentos e evidências epistemológicas; validar a pertinência filosófica dos itens.'),
    ('PHYSICS_SPEED_FOUNDATIONS', 'PHYSICS', 'PHYSICS_AVERAGE_SPEED', 'PHYSICS_MOTION', 'Movimento e interações', 'Calcular velocidade média', 'EM13CNT101', 'Candidato: a habilidade oficial menciona movimento e previsões em sistemas; validar a profundidade conceitual e a modelagem física.'),
    ('GEOGRAPHY_TERRITORY_FOUNDATIONS', 'GEOGRAPHY', 'GEOGRAPHY_INTERPRET_TERRITORY', 'GEOGRAPHY_SPACE', 'Cartografia e espaço geográfico', 'Interpretar território e paisagem', 'EM13CHS203', 'Candidato: a habilidade oficial aborda significados de território e fronteiras; validar o tratamento de diferentes contextos sociais e espaciais.'),
    ('HISTORY_SOURCE_FOUNDATIONS', 'HISTORY', 'HISTORY_INTERPRET_EVIDENCE', 'HISTORY_SOURCES', 'Fontes e interpretação histórica', 'Interpretar evidências históricas', 'EM13CHS101', 'Candidato: a habilidade oficial propõe comparar fontes e narrativas para compreender processos históricos; validar a contextualização e autoria das fontes usadas.'),
    ('ENGLISH_READING_FOUNDATIONS', 'ENGLISH', 'ENGLISH_INFER_FROM_TEXT', 'ENGLISH_READING', 'Leitura em língua inglesa', 'Inferir sentidos em textos em inglês', 'EM13LGG403', 'Candidato: a habilidade oficial trata usos do inglês no mundo contemporâneo; validar se a jornada trabalha usos, contextos e diversidade, além da inferência textual.'),
    ('PORTUGUESE_ARGUMENT_FOUNDATIONS', 'PORTUGUESE', 'PORTUGUESE_ARGUMENT_EVIDENCE', 'PORTUGUESE_ARGUMENTATION', 'Leitura e argumentação', 'Identificar tese e evidência', 'EM13LP02', 'Candidato: a habilidade oficial inclui relações entre partes do texto e relações tese-argumentos; validar a cobertura textual e os gêneros utilizados.'),
    ('MATHEMATICS_PERCENT_FOUNDATIONS', 'MATHEMATICS', 'MATH_PERCENT_OF_QUANTITY', 'MATHEMATICS_NUMBERS', 'Números e porcentagem', 'Calcular porcentagens em contexto', 'EM13MAT303', 'Candidato: a habilidade oficial trata problemas com porcentagens; validar contextos, juros compostos e progressão antes de afirmar cobertura completa.'),
    ('CHEMISTRY_MATTER_FOUNDATIONS', 'CHEMISTRY', 'CHEMISTRY_STOICHIOMETRY', 'CHEMISTRY_TRANSFORMATIONS', 'Matéria e transformações', 'Relacionar quantidades em transformações químicas', 'EM13CNT101', 'Candidato: a habilidade oficial contempla quantidade de matéria e transformações; validar fórmulas, unidades e limites do conteúdo existente.'),
    ('SOCIOLOGY_INSTITUTIONS_FOUNDATIONS', 'SOCIOLOGY', 'SOCIOLOGY_EXPLAIN_INSTITUTIONS', 'SOCIOLOGY_SOCIAL_LIFE', 'Indivíduo, cultura e sociedade', 'Explicar instituições sociais', 'EM13CHS502', 'Candidato: a habilidade oficial trata situações da vida cotidiana, valores e desigualdades; validar se os itens abordam esses aspectos sem reduzir instituições a definições.')
), source_skill as (
  select catalog.id as catalog_id
    from public.learning_curriculum_catalogs catalog
   where catalog.code = 'TECESCOLA_CORE'
     and catalog.version = '1.0'
     and catalog.active
), journey_rows as (
  select candidates.*,
         canonical_subject.id as canonical_subject_id,
         execution_skill.id as execution_skill_id,
         execution_skill.stage as execution_stage,
         execution_skill.grade_level as execution_grade,
         execution_skill.content_readiness,
         execution_skill.mastery_targetable,
         execution_skill.pedagogical_review_status as skill_review_status,
         execution_skill.metadata
    from candidates
    cross join source_skill
    join public.learning_canonical_subjects canonical_subject
      on canonical_subject.code = candidates.canonical_subject_code
     and canonical_subject.active
    join public.learning_curriculum_skills execution_skill
      on execution_skill.catalog_id = source_skill.catalog_id
     and execution_skill.code = candidates.execution_skill_code
     and execution_skill.active
     and execution_skill.node_kind = 'LEAF'
     and execution_skill.content_readiness = 'ADAPTIVE_READY'
     and execution_skill.mastery_targetable
     and execution_skill.canonical_subject_id = canonical_subject.id
)
insert into public.learning_bncc_discipline_journeys(
  journey_code, canonical_subject_id, execution_skill_id, unit_code, unit_title,
  title, suggested_stage, suggested_grade, publication_status, mapping_status,
  pedagogical_review_status, content_version, metadata
)
select journey_code, canonical_subject_id, execution_skill_id, unit_code, unit_title,
       title, 'ENSINO_MEDIO', 1, 'DEMO_PREVIEW', 'MAPPING_PENDING',
       'PEDAGOGICAL_REVIEW_PENDING', 'tec-escola-core-v4',
       jsonb_build_object(
         'source_pack', 'tec-escola-core-v4',
         'skill_code', execution_skill_code,
         'execution_stage', execution_stage,
         'execution_grade', execution_grade,
         'content_readiness', content_readiness,
         'skill_pedagogical_review_status', skill_review_status,
         'learning_role', case when execution_stage = 'ENSINO_MEDIO' and execution_grade = 1
                               then 'INTRODUCTORY_CONTENT'
                               else 'FOUNDATION_REVIEW' end,
         'mapping_status', 'MAPPING_PENDING',
         'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING',
         'demonstration_only', true
       )
  from journey_rows
on conflict (journey_code) do update
  set canonical_subject_id = excluded.canonical_subject_id,
      execution_skill_id = excluded.execution_skill_id,
      unit_code = excluded.unit_code,
      unit_title = excluded.unit_title,
      title = excluded.title,
      suggested_stage = excluded.suggested_stage,
      suggested_grade = excluded.suggested_grade,
      publication_status = 'DEMO_PREVIEW',
      mapping_status = 'MAPPING_PENDING',
      pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING',
      content_version = excluded.content_version,
      metadata = excluded.metadata,
      active = true,
      updated_at = now();

with candidates(journey_code, official_code, mapping_reason, source_page) as (
  values
    ('ART_COMPOSITION_FOUNDATIONS', 'EM13LGG602', 'Candidato pendente: apreciação artística e composição visual; verificar se o conjunto cobre a habilidade integralmente.', 'p. 64, competência específica 6 da área de Linguagens'),
    ('BIOLOGY_CELL_FOUNDATIONS', 'EM13CNT202', 'Candidato pendente: níveis de organização da vida; verificar se o conteúdo celular corresponde ao recorte oficial.', 'p. 119, habilidade EM13CNT202'),
    ('PHYSICAL_EDUCATION_MOVEMENT_FOUNDATIONS', 'EM13LGG501', 'Candidato pendente: uso consciente do movimento em práticas corporais; validar as dimensões sociais e culturais.', 'p. 63, habilidade EM13LGG501'),
    ('PHILOSOPHY_ARGUMENT_FOUNDATIONS', 'EM13CHS103', 'Candidato pendente: elaboração de argumentos e seleção de evidências; validar a abordagem filosófica.', 'p. 136, habilidade EM13CHS103'),
    ('PHYSICS_SPEED_FOUNDATIONS', 'EM13CNT101', 'Candidato pendente: movimento e previsões em sistemas; validar a cobertura conceitual de Física.', 'p. 117, habilidade EM13CNT101'),
    ('GEOGRAPHY_TERRITORY_FOUNDATIONS', 'EM13CHS203', 'Candidato pendente: conceitos de território, fronteiras e espacialidade; validar o contexto geográfico.', 'p. 138, habilidade EM13CHS203'),
    ('HISTORY_SOURCE_FOUNDATIONS', 'EM13CHS101', 'Candidato pendente: comparação de fontes e narrativas históricas; verificar autoria, temporalidade e contexto dos itens.', 'p. 136, habilidade EM13CHS101'),
    ('ENGLISH_READING_FOUNDATIONS', 'EM13LGG403', 'Candidato pendente: usos do inglês no mundo contemporâneo; validar se a jornada contempla usos e contextos, não apenas inferência.', 'p. 62, habilidade EM13LGG403'),
    ('PORTUGUESE_ARGUMENT_FOUNDATIONS', 'EM13LP02', 'Candidato pendente: coesão, coerência e relações tese-argumentos; validar gêneros e progressão textual.', 'p. 74, habilidade EM13LP02'),
    ('MATHEMATICS_PERCENT_FOUNDATIONS', 'EM13MAT303', 'Candidato pendente: problemas com porcentagens; validar variedade de contextos e presença de juros compostos.', 'p. 104, habilidade EM13MAT303'),
    ('CHEMISTRY_MATTER_FOUNDATIONS', 'EM13CNT101', 'Candidato pendente: quantidade de matéria e transformações; validar cálculos, unidades e conservação.', 'p. 117, habilidade EM13CNT101'),
    ('SOCIOLOGY_INSTITUTIONS_FOUNDATIONS', 'EM13CHS502', 'Candidato pendente: situações cotidianas, valores e desigualdades; validar o recorte sociológico dos itens.', 'p. 140, habilidade EM13CHS502')
), resolved as (
  select journey.id as journey_id,
         official_skill.id as official_skill_id,
         candidate.mapping_reason,
         candidate.source_page,
         official_skill.metadata->>'official_code' as official_code,
         official_skill.subject_area as official_area
    from candidates candidate
    join public.learning_bncc_discipline_journeys journey
      on journey.journey_code = candidate.journey_code
    join public.learning_curriculum_skills official_skill
      on official_skill.metadata->>'official_code' = candidate.official_code
     and official_skill.active
     and official_skill.stage = 'ENSINO_MEDIO'
     and official_skill.bncc_alignment_status in ('MAPPED', 'CANDIDATE')
    join public.learning_curriculum_catalogs catalog
      on catalog.id = official_skill.catalog_id
     and catalog.code = 'BNCC_2018'
     and catalog.active
)
insert into public.learning_bncc_discipline_journey_skills(
  journey_id, official_skill_id, relation_type, mapping_status, mapping_reason,
  source_document, source_section, metadata
)
select journey_id, official_skill_id, 'PRIMARY', 'MAPPING_PENDING', mapping_reason,
       'BNCC_EM_2018', source_page,
       jsonb_build_object('official_code', official_code, 'official_area', official_area,
                          'source_url', 'https://basenacionalcomum.mec.gov.br/images/historico/BNCC_EnsinoMedio_embaixa_site_110518.pdf',
                          'review_status', 'PEDAGOGICAL_REVIEW_PENDING')
  from resolved
on conflict (journey_id, official_skill_id) do update
  set relation_type = excluded.relation_type,
      mapping_status = 'MAPPING_PENDING',
      mapping_reason = excluded.mapping_reason,
      source_document = excluded.source_document,
      source_section = excluded.source_section,
      metadata = excluded.metadata;

alter table public.learning_bncc_discipline_journeys enable row level security;
alter table public.learning_bncc_discipline_journey_skills enable row level security;

create or replace function private.assert_bncc_discipline_journey_v9(
  p_institution_id uuid,
  p_student_id uuid,
  p_journey_id uuid,
  p_execution_skill_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  journey_row public.learning_bncc_discipline_journeys%rowtype;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id)
     or not private.bncc_demo_preview_allowed(p_institution_id, p_student_id) then
    raise exception 'LEARNING_V9_DEMO_SCOPE_DENIED';
  end if;

  select journey.* into journey_row
    from public.learning_bncc_discipline_journeys journey
    join private.learning_demo_subject_bindings binding
      on binding.institution_id = p_institution_id
     and binding.canonical_subject_id = journey.canonical_subject_id
   where journey.id = p_journey_id
     and journey.active
     and journey.publication_status = 'DEMO_PREVIEW'
     and journey.mapping_status = 'MAPPING_PENDING'
     and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     and journey.suggested_stage = 'ENSINO_MEDIO'
     and journey.suggested_grade = 1
     and (p_execution_skill_id is null or journey.execution_skill_id = p_execution_skill_id)
     and exists (
       select 1
         from public.learning_curriculum_skills skill
        where skill.id = journey.execution_skill_id
          and skill.active
          and skill.node_kind = 'LEAF'
          and skill.content_readiness = 'ADAPTIVE_READY'
          and skill.mastery_targetable
          and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
     );
  if not found then
    raise exception 'LEARNING_V9_JOURNEY_NOT_AVAILABLE';
  end if;

  if not exists (
    select 1
      from public.enrollments enrollment
      join public.classes class on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where enrollment.student_id = p_student_id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
       and normalized.value->>'stage' = journey_row.suggested_stage
       and nullif(normalized.value->>'grade_level', '')::smallint = journey_row.suggested_grade
  ) then
    raise exception 'LEARNING_V9_GRADE_NOT_ELIGIBLE';
  end if;
end;
$$;

create or replace function private.enforce_bncc_discipline_journey_session_v9()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.discipline_journey_id is not null then
    perform private.assert_bncc_discipline_journey_v9(
      new.institution_id, new.student_id, new.discipline_journey_id,
      new.target_canonical_skill_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists learning_guided_sessions_discipline_journey_v9_guard
  on public.learning_guided_sessions;
create trigger learning_guided_sessions_discipline_journey_v9_guard
before insert or update of discipline_journey_id, institution_id, student_id, target_canonical_skill_id
on public.learning_guided_sessions
for each row execute function private.enforce_bncc_discipline_journey_session_v9();

create or replace function private.enforce_bncc_discipline_journey_step_v9()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.learning_guided_sessions%rowtype;
begin
  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = new.session_id;
   if session_row.discipline_journey_id is not null then
     perform private.assert_bncc_discipline_journey_v9(
      session_row.institution_id, session_row.student_id,
      session_row.discipline_journey_id, session_row.target_canonical_skill_id
    );
     if not exists (
       select 1
         from public.learning_bncc_discipline_journeys journey
         join public.learning_curriculum_skills step_skill
           on step_skill.id = new.canonical_skill_id
          and step_skill.active
          and step_skill.node_kind = 'LEAF'
          and step_skill.content_readiness = 'ADAPTIVE_READY'
          and step_skill.mastery_targetable
        where journey.id = session_row.discipline_journey_id
          and (
            step_skill.canonical_subject_id = journey.canonical_subject_id
            or new.canonical_skill_id in (
              with recursive prerequisite_walk(skill_id, depth) as (
                select edge.prerequisite_skill_id, 1
                  from public.learning_skill_prerequisites edge
                 where edge.skill_id = journey.execution_skill_id
                union
                select edge.prerequisite_skill_id, prerequisite_walk.depth + 1
                  from prerequisite_walk
                  join public.learning_skill_prerequisites edge
                    on edge.skill_id = prerequisite_walk.skill_id
                 where prerequisite_walk.depth < 8
              )
              select prerequisite_walk.skill_id from prerequisite_walk
            )
          )
     ) then
       raise exception 'LEARNING_V9_STEP_SKILL_OUT_OF_DISCIPLINE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists learning_guided_steps_discipline_journey_v9_guard
  on public.learning_guided_steps;
create trigger learning_guided_steps_discipline_journey_v9_guard
before insert or update of session_id, canonical_skill_id
on public.learning_guided_steps
for each row execute function private.enforce_bncc_discipline_journey_step_v9();

create or replace function public.list_student_guided_discipline_journeys_v9(
  p_institution_id uuid,
  p_student_id uuid
)
returns table(
  journey_id uuid,
  journey_code text,
  subject_id uuid,
  subject_code text,
  subject_name text,
  canonical_subject_code text,
  unit_code text,
  unit_title text,
  title text,
  execution_skill_id uuid,
  official_codes text[],
  official_areas text[],
  mapping_status text,
  mapping_reason text,
  learning_role text,
  availability_status text,
  question_count integer,
  missing_purposes text[],
  progress numeric,
  active_session_id uuid,
  active_session_status text,
  pedagogical_review_status text,
  reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select distinct normalized.value->>'stage' as stage,
           nullif(normalized.value->>'grade_level', '')::smallint as grade_level
      from public.enrollments enrollment
      join public.classes class on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where enrollment.student_id = p_student_id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
  ), inventory as (
    select journey.id as journey_id,
           journey.journey_code,
           subject.id as subject_id,
           subject.code as subject_code,
           subject.name as subject_name,
           canonical_subject.code as canonical_subject_code,
           journey.unit_code,
           journey.unit_title,
           journey.title,
           journey.execution_skill_id,
           coalesce((select array_agg(distinct official.metadata->>'official_code' order by official.metadata->>'official_code')
                       from public.learning_bncc_discipline_journey_skills mapping
                       join public.learning_curriculum_skills official on official.id = mapping.official_skill_id
                      where mapping.journey_id = journey.id), array[]::text[]) as official_codes,
           coalesce((select array_agg(distinct official.subject_area order by official.subject_area)
                       from public.learning_bncc_discipline_journey_skills mapping
                       join public.learning_curriculum_skills official on official.id = mapping.official_skill_id
                      where mapping.journey_id = journey.id), array[]::text[]) as official_areas,
           journey.mapping_status,
           coalesce((select string_agg(mapping.mapping_reason, ' ' order by mapping.relation_type)
                       from public.learning_bncc_discipline_journey_skills mapping
                      where mapping.journey_id = journey.id), 'Vínculo curricular pendente de validação.') as mapping_reason,
           journey.metadata->>'learning_role' as learning_role,
           (select count(distinct item.question_bank_id)::integer
              from public.learning_question_sets question_set
              join public.learning_question_set_items item on item.question_set_id = question_set.id
              join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
             where question_set.canonical_skill_id = skill.id
               and question_set.scope = 'GLOBAL'
               and question_set.version = 4
               and question_set.active) as question_count,
           (select array_agg(purpose.name order by purpose.position)
              from (values ('PROBE', 1), ('PRACTICE', 2), ('TRANSFER', 3), ('LOCK_IN', 4), ('REVIEW', 5)) purpose(name, position)
             where not exists (
               select 1 from public.learning_question_sets question_set
               join public.learning_question_set_items item on item.question_set_id = question_set.id
               join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
              where question_set.canonical_skill_id = skill.id
                and question_set.scope = 'GLOBAL'
                and question_set.version = 4
                and question_set.active
                and question_set.purpose = purpose.name)) as missing_purposes,
           coalesce(state.mastery_estimate, 0) as progress,
           active_session.id as active_session_id,
           active_session.status as active_session_status,
           journey.pedagogical_review_status
      from public.learning_bncc_discipline_journeys journey
      join private.learning_demo_subject_bindings binding
        on binding.institution_id = p_institution_id
       and binding.canonical_subject_id = journey.canonical_subject_id
      join public.subjects subject
        on subject.id = binding.subject_id
       and subject.institution_id = p_institution_id
       and subject.active
      join public.learning_canonical_subjects canonical_subject
        on canonical_subject.id = journey.canonical_subject_id
       and canonical_subject.active
      join public.learning_curriculum_skills skill
        on skill.id = journey.execution_skill_id
       and skill.active
      left join public.learning_student_skill_state state
        on state.institution_id = p_institution_id
       and state.student_id = p_student_id
       and state.canonical_skill_id = skill.id
      left join lateral (
        select session.id, session.status
          from public.learning_guided_sessions session
         where session.institution_id = p_institution_id
           and session.student_id = p_student_id
           and session.discipline_journey_id = journey.id
           and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
         order by session.updated_at desc
         limit 1
      ) active_session on true
     where journey.active
       and journey.publication_status = 'DEMO_PREVIEW'
       and journey.mapping_status = 'MAPPING_PENDING'
       and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and journey.suggested_stage = 'ENSINO_MEDIO'
       and journey.suggested_grade = 1
       and skill.content_readiness = 'ADAPTIVE_READY'
       and skill.mastery_targetable
       and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
       and exists (select 1 from public.learning_skill_lessons lesson
                    where lesson.canonical_skill_id = skill.id and lesson.active and lesson.version = 4)
       and private.learning_v2_scope_student(p_institution_id, p_student_id)
       and private.bncc_demo_preview_allowed(p_institution_id, p_student_id)
       and exists (select 1 from context where context.stage = journey.suggested_stage and context.grade_level = journey.suggested_grade)
  )
  select inventory.journey_id,
         inventory.journey_code,
         inventory.subject_id,
         inventory.subject_code,
         inventory.subject_name,
         inventory.canonical_subject_code,
         inventory.unit_code,
         inventory.unit_title,
         inventory.title,
         inventory.execution_skill_id,
         inventory.official_codes,
         inventory.official_areas,
         inventory.mapping_status,
         inventory.mapping_reason,
         inventory.learning_role,
         case
           when inventory.question_count = 0 then 'NO_QUESTIONS'
           when cardinality(coalesce(inventory.missing_purposes, array[]::text[])) > 0 then 'PARTIAL_CONTENT'
           when inventory.question_count < 12 then 'PARTIAL_CONTENT'
           when inventory.active_session_id is null then 'DEMO_PREVIEW'
           else 'DEMO_PREVIEW'
         end,
         inventory.question_count,
         coalesce(inventory.missing_purposes, array[]::text[]),
         inventory.progress,
         inventory.active_session_id,
         inventory.active_session_status,
         inventory.pedagogical_review_status,
         case
           when inventory.question_count = 0 then 'Não há exercícios publicados para esta jornada.'
           when cardinality(coalesce(inventory.missing_purposes, array[]::text[])) > 0 then 'A cobertura de etapas do percurso ainda está incompleta.'
           when inventory.question_count < 12 then 'Prévia demonstrativa com cobertura parcial de questões.'
           else 'Prévia demonstrativa; revisão pedagógica e vínculo curricular pendentes.'
         end
    from inventory
   order by inventory.canonical_subject_code, inventory.unit_code;
$$;

create or replace function public.start_guided_discipline_journey_v9(
  p_institution_id uuid,
  p_student_id uuid,
  p_journey_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  journey_row public.learning_bncc_discipline_journeys%rowtype;
  skill_row public.learning_curriculum_skills%rowtype;
  existing_session public.learning_guided_sessions%rowtype;
  created_session public.learning_guided_sessions%rowtype;
  probe_set uuid;
  step_id uuid;
  question_count integer;
  missing_purposes text[];
begin
  perform private.assert_bncc_discipline_journey_v9(p_institution_id, p_student_id, p_journey_id);

  select journey.* into journey_row
    from public.learning_bncc_discipline_journeys journey
   where journey.id = p_journey_id;
  select skill.* into skill_row
    from public.learning_curriculum_skills skill
   where skill.id = journey_row.execution_skill_id;

  select session.* into existing_session
    from public.learning_guided_sessions session
   where session.institution_id = p_institution_id
     and session.student_id = p_student_id
     and session.discipline_journey_id = journey_row.id
     and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
   order by session.updated_at desc
   limit 1;
  if found and existing_session.planner_version = 'V4' then
    return jsonb_build_object(
      'session_id', existing_session.id,
      'created', false,
      'current_step_id', existing_session.current_step_id,
      'target_canonical_skill_id', existing_session.target_canonical_skill_id,
      'engine_version', 'V4'
    );
  end if;

  if exists (
    select 1 from public.learning_guided_sessions session
     where session.institution_id = p_institution_id
       and session.student_id = p_student_id
       and session.target_canonical_skill_id = journey_row.execution_skill_id
       and session.status in ('ACTIVE', 'PAUSED')
       and session.discipline_journey_id is distinct from journey_row.id
  ) then
    raise exception 'LEARNING_V9_EXISTING_SESSION_OTHER_CONTEXT';
  end if;

   select count(distinct item.question_bank_id)::integer into question_count
    from public.learning_question_sets question_set
    join public.learning_question_set_items item on item.question_set_id = question_set.id
    join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
   where question_set.canonical_skill_id = journey_row.execution_skill_id
     and question_set.scope = 'GLOBAL'
     and question_set.version = 4
     and question_set.active;

  select array_agg(purpose.name order by purpose.position) into missing_purposes
    from (values ('PROBE', 1), ('PRACTICE', 2), ('TRANSFER', 3), ('LOCK_IN', 4), ('REVIEW', 5)) purpose(name, position)
   where not exists (
     select 1 from public.learning_question_sets question_set
     join public.learning_question_set_items item on item.question_set_id = question_set.id
     join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
    where question_set.canonical_skill_id = journey_row.execution_skill_id
      and question_set.scope = 'GLOBAL'
      and question_set.version = 4
      and question_set.active
       and question_set.purpose = purpose.name
       and (select count(distinct purpose_item.question_bank_id)
              from public.learning_question_set_items purpose_item
              join public.learning_question_bank purpose_bank
                on purpose_bank.id = purpose_item.question_bank_id and purpose_bank.active
             where purpose_item.question_set_id = question_set.id) >= 1
   );
  if question_count < 2 or cardinality(coalesce(missing_purposes, array[]::text[])) > 0 then
    raise exception 'LEARNING_V9_QUESTION_PATH_INCOMPLETE';
  end if;

  select lesson.id into step_id
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = journey_row.execution_skill_id
     and lesson.active
     and lesson.version = 4
   order by lesson.id
   limit 1;
  if step_id is null then
    raise exception 'LEARNING_V9_LESSON_MISSING';
  end if;

  select question_set.id into probe_set
    from public.learning_question_sets question_set
   where question_set.canonical_skill_id = journey_row.execution_skill_id
     and question_set.scope = 'GLOBAL'
     and question_set.version = 4
     and question_set.active
     and question_set.purpose = 'PROBE'
     and (select count(*) from public.learning_question_set_items item
           join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
          where item.question_set_id = question_set.id) >= 2
   order by question_set.id
   limit 1;
  if probe_set is null then
    raise exception 'LEARNING_V9_PROBE_SET_INCOMPLETE';
  end if;

  insert into public.learning_guided_sessions(
    institution_id, student_id, target_canonical_skill_id,
    original_target_canonical_skill_id, current_canonical_skill_id,
    class_id, discipline_journey_id, planner_version, decision_reason, metadata
  )
   select p_institution_id, p_student_id, journey_row.execution_skill_id,
         journey_row.execution_skill_id, journey_row.execution_skill_id,
         enrollment.class_id, journey_row.id, 'V4', 'V9_DEMO_PREVIEW',
         jsonb_build_object(
           'engine_version', 'V4',
           'discipline_journey_id', journey_row.id,
           'journey_code', journey_row.journey_code,
           'journey_title', journey_row.title,
           'unit_code', journey_row.unit_code,
           'unit_title', journey_row.unit_title,
           'canonical_subject_id', journey_row.canonical_subject_id,
           'canonical_subject_code', canonical_subject.code,
           'official_codes', coalesce((select jsonb_agg(official.metadata->>'official_code' order by official.metadata->>'official_code')
                                         from public.learning_bncc_discipline_journey_skills mapping
                                         join public.learning_curriculum_skills official on official.id = mapping.official_skill_id
                                        where mapping.journey_id = journey_row.id), '[]'::jsonb),
           'mapping_status', journey_row.mapping_status,
           'pedagogical_review_status', journey_row.pedagogical_review_status,
           'demonstration_only', true,
           'learning_role', journey_row.metadata->>'learning_role',
           'adaptive_policy_version', 'V8',
           'replan_count', 0
         )
    from public.enrollments enrollment
    join public.classes class on class.id = enrollment.class_id
     and class.institution_id = p_institution_id and class.active
     cross join public.learning_canonical_subjects canonical_subject
     cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
   where enrollment.student_id = p_student_id
     and enrollment.active
     and upper(enrollment.status::text) = 'ACTIVE'
     and canonical_subject.id = journey_row.canonical_subject_id
      and normalized.value->>'stage' = journey_row.suggested_stage
      and nullif(normalized.value->>'grade_level', '')::smallint = journey_row.suggested_grade
     and exists (
       select 1 from private.learning_demo_subject_bindings binding
        where binding.institution_id = p_institution_id
          and binding.canonical_subject_id = canonical_subject.id
     )
     and not exists (
       select 1 from public.learning_guided_sessions active_session
        where active_session.institution_id = p_institution_id
          and active_session.student_id = p_student_id
          and active_session.target_canonical_skill_id = journey_row.execution_skill_id
          and active_session.status in ('ACTIVE', 'PAUSED')
     )
   order by enrollment.created_at desc
   limit 1
   returning * into created_session;

  if created_session.id is null then
    raise exception 'LEARNING_V9_ENROLLMENT_CONTEXT_MISSING';
  end if;

  insert into public.learning_guided_steps(
    institution_id, session_id, canonical_skill_id, step_type, purpose,
    position, status, lesson_id, question_set_id, started_at, metadata
  ) values (
    p_institution_id, created_session.id, journey_row.execution_skill_id,
    'PROBE', 'PROBE', 0, 'ACTIVE', null, probe_set, now(),
    jsonb_build_object('journey_id', journey_row.id, 'selection_integrity_version', 'SERVER_SELECTED_V1')
  ) returning id into step_id;

  update public.learning_guided_sessions
     set current_step_id = step_id
   where id = created_session.id;

  insert into public.learning_guided_session_events(
    institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload
  ) values (
    p_institution_id, created_session.id, p_student_id, 'SESSION_STARTED', step_id,
    'v9-session-start:' || created_session.id::text,
    jsonb_build_object('engine_version', 'V4', 'journey_id', journey_row.id,
                       'mapping_status', 'MAPPING_PENDING',
                       'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING')
  );
  insert into public.learning_guided_session_events(
    institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload
  ) values (
    p_institution_id, created_session.id, p_student_id, 'STEP_STARTED', step_id,
    'v9-step-start:' || step_id::text,
    jsonb_build_object('step_type', 'PROBE', 'journey_id', journey_row.id)
  );

  return jsonb_build_object(
    'session_id', created_session.id,
    'created', true,
    'current_step_id', step_id,
    'target_canonical_skill_id', skill_row.id,
    'engine_version', 'V4'
  );
end;
$$;

-- Preserve the exact legacy V4 response for existing sessions. Only V9 sessions
-- use the server-persisted bounded selection contract below.
do $rename_legacy_step$
begin
  if to_regprocedure('public.get_guided_learning_step_v4_legacy_v9(uuid)') is null then
    if to_regprocedure('public.get_guided_learning_step_v4(uuid)') is null then
      raise exception 'LEARNING_V4_STEP_RPC_MISSING';
    end if;
    execute 'alter function public.get_guided_learning_step_v4(uuid) rename to get_guided_learning_step_v4_legacy_v9';
  end if;
end;
$rename_legacy_step$;

revoke all on function public.get_guided_learning_step_v4_legacy_v9(uuid) from public, anon, authenticated;

-- Persist the server-selected question IDs on first read. Reloads receive the
-- same selection, and legacy V4 sessions retain their prior response behavior.
create or replace function public.get_guided_learning_step_v4(p_step_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  step_row public.learning_guided_steps%rowtype;
  session_row public.learning_guided_sessions%rowtype;
  selected_ids text[];
  result jsonb;
begin
  select step.* into step_row
    from public.learning_guided_steps step
   where step.id = p_step_id
   for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = step_row.session_id
     and session.planner_version = 'V4';
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  if not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then
    raise exception 'LEARNING_STEP_SCOPE_DENIED';
  end if;
  if session_row.discipline_journey_id is null then
    return public.get_guided_learning_step_v4_legacy_v9(p_step_id);
  end if;
  perform private.assert_bncc_discipline_journey_v9(
    session_row.institution_id, session_row.student_id,
    session_row.discipline_journey_id, session_row.target_canonical_skill_id
  );

  if step_row.step_type in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW') then
    if jsonb_typeof(step_row.metadata->'selected_question_ids') = 'array'
       and step_row.metadata->>'selection_integrity_version' = 'SERVER_SELECTED_V1' then
      select array_agg(value order by ordinality)
        into selected_ids
        from jsonb_array_elements_text(step_row.metadata->'selected_question_ids') with ordinality as selected(value, ordinality);
    else
      select array_agg(candidate.id order by candidate.selection_order)
        into selected_ids
        from (
          select bank.id::text as id,
                 row_number() over (order by md5(bank.id::text || session_row.id::text)) as selection_order
          from public.learning_question_set_items item
            join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
           where item.question_set_id = step_row.question_set_id
           and not exists (
             select 1 from public.learning_question_set_items duplicate_item
              where duplicate_item.question_set_id = item.question_set_id
                and duplicate_item.question_bank_id = item.question_bank_id
                and duplicate_item.position < item.position
           )
             and not exists (
               select 1
                 from public.learning_guided_step_attempts previous_attempt
                 join public.learning_guided_steps previous_step on previous_step.id = previous_attempt.step_id
                 join public.learning_guided_sessions previous_session on previous_session.id = previous_attempt.session_id
                where previous_session.institution_id = session_row.institution_id
                  and previous_session.student_id = session_row.student_id
                  and previous_step.canonical_skill_id = step_row.canonical_skill_id
                  and previous_attempt.purpose = step_row.purpose
                  and exists (
                    select 1 from jsonb_array_elements(previous_attempt.answers) answer
                     where answer->>'question_bank_id' = bank.id::text
                  )
             )
           order by md5(bank.id::text || session_row.id::text)
           limit 2
        ) candidate;

      if coalesce(cardinality(selected_ids), 0) < 2 then
        select array_agg(candidate.id order by candidate.selection_order)
          into selected_ids
          from (
            select bank.id::text as id,
                   row_number() over (order by md5(bank.id::text || session_row.id::text)) as selection_order
                from public.learning_question_set_items item
              join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
             where item.question_set_id = step_row.question_set_id
                 and not exists (
                   select 1 from public.learning_question_set_items duplicate_item
                    where duplicate_item.question_set_id = item.question_set_id
                      and duplicate_item.question_bank_id = item.question_bank_id
                      and duplicate_item.position < item.position
                 )
             order by md5(bank.id::text || session_row.id::text)
               limit 2
          ) candidate;
      end if;
      if coalesce(cardinality(selected_ids), 0) < 1
         or coalesce(cardinality(selected_ids), 0) > 2
         or (step_row.step_type = 'PROBE' and cardinality(selected_ids) <> 2) then
        raise exception 'LEARNING_V4_QUESTION_SET_INCOMPLETE';
      end if;
      update public.learning_guided_steps step
         set metadata = coalesce(step.metadata, '{}'::jsonb) || jsonb_build_object(
           'selected_question_ids', to_jsonb(selected_ids),
           'selection_integrity_version', 'SERVER_SELECTED_V1'
         ),
             updated_at = now()
       where step.id = step_row.id
       returning * into step_row;
    end if;
  else
    selected_ids := array[]::text[];
  end if;

  select jsonb_build_object(
    'id', step_row.id,
    'session_id', step_row.session_id,
    'canonical_skill_id', step_row.canonical_skill_id,
    'step_type', step_row.step_type,
    'purpose', step_row.purpose,
    'status', step_row.status,
    'position', step_row.position,
    'lesson_id', step_row.lesson_id,
    'lesson', (select jsonb_build_object(
      'id', lesson.id, 'title', lesson.title, 'summary', lesson.summary,
      'content_markdown', lesson.content_markdown, 'worked_example', lesson.worked_example,
      'tips', lesson.tips, 'estimated_minutes', lesson.estimated_minutes
    ) from public.learning_skill_lessons lesson where lesson.id = step_row.lesson_id),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id, 'statement', question.statement,
        'options', question.options, 'difficulty', question.difficulty,
        'position', item.position
      ) order by item.position)
        from public.learning_question_set_items item
        join public.learning_question_bank question on question.id = item.question_bank_id and question.active
       where item.question_set_id = step_row.question_set_id
         and question.id::text = any(selected_ids)
         and not exists (
           select 1 from public.learning_question_set_items duplicate_item
            where duplicate_item.question_set_id = item.question_set_id
              and duplicate_item.question_bank_id = item.question_bank_id
              and duplicate_item.position < item.position
         )
    ), '[]'::jsonb)
  ) into result;

  if step_row.step_type in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW')
     and (jsonb_array_length(result->'questions') < 1
          or jsonb_array_length(result->'questions') > 2
          or jsonb_array_length(result->'questions') <> coalesce(cardinality(selected_ids), 0)
          or cardinality(selected_ids) <> (select count(distinct selected_id)::integer from unnest(selected_ids) selected(selected_id))
          or (step_row.step_type = 'PROBE' and jsonb_array_length(result->'questions') <> 2)) then
    raise exception 'LEARNING_V4_QUESTION_SET_INCOMPLETE';
  end if;
  return result;
end;
$$;

-- The V4 grader still validates and writes its normal evidence/feedback. Restrict
-- its loop to the persisted selection for V9 only, preserving legacy attempts.
do $patch_v9_grader$
declare
  function_definition text;
  old_clause constant text := $old$ where set_item.question_set_id=step_row.question_set_id and exists (select 1 from jsonb_array_elements(p_answers) submitted_answer where submitted_answer->>'question_bank_id'=bank.id::text) order by set_item.position loop$old$;
  new_clause constant text := $new$ where set_item.question_set_id=step_row.question_set_id and exists (select 1 from jsonb_array_elements(p_answers) submitted_answer where submitted_answer->>'question_bank_id'=bank.id::text) and (session_row.discipline_journey_id is null or bank.id::text = any(array(select jsonb_array_elements_text(step_row.metadata->'selected_question_ids')))) order by set_item.position loop$new$;
begin
  select pg_get_functiondef('public.submit_guided_learning_step_v4(uuid,jsonb,text)'::regprocedure)
    into function_definition;
  if function_definition is null then
    raise exception 'LEARNING_V4_SUBMIT_RPC_MISSING';
  end if;
  if position(new_clause in function_definition) > 0 then
    return;
  end if;
  if position(old_clause in function_definition) = 0 then
    raise exception 'LEARNING_V9_GRADER_PATCH_TARGET_MISMATCH';
  end if;
  execute replace(function_definition, old_clause, new_clause);
end;
$patch_v9_grader$;

create or replace function private.enforce_guided_question_selection_v9()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  step_row public.learning_guided_steps%rowtype;
  session_row public.learning_guided_sessions%rowtype;
  selected_ids text[];
  submitted_ids text[];
  submitted_unique_count integer;
begin
  select step.* into step_row
    from public.learning_guided_steps step
   where step.id = new.step_id;
  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = new.session_id;
  if session_row.planner_version = 'V4'
     and session_row.discipline_journey_id is not null then
    if not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then
      raise exception 'LEARNING_STEP_SCOPE_DENIED';
    end if;
    if session_row.discipline_journey_id is not null then
      perform private.assert_bncc_discipline_journey_v9(
        session_row.institution_id, session_row.student_id,
        session_row.discipline_journey_id, session_row.target_canonical_skill_id
      );
    end if;
    if jsonb_typeof(step_row.metadata->'selected_question_ids') <> 'array'
       or jsonb_typeof(new.answers) <> 'array' then
      raise exception 'LEARNING_GUIDED_SELECTION_NOT_PERSISTED';
    end if;
    select array_agg(value order by ordinality)
      into selected_ids
      from jsonb_array_elements_text(step_row.metadata->'selected_question_ids') with ordinality as selected(value, ordinality);
    select array_agg(answer->>'question_bank_id' order by answer->>'question_bank_id')
      into submitted_ids
      from jsonb_array_elements(new.answers) answer;
    select count(distinct answer->>'question_bank_id')::integer
      into submitted_unique_count
      from jsonb_array_elements(new.answers) answer;
    if coalesce(cardinality(selected_ids), 0) < 1
       or coalesce(cardinality(selected_ids), 0) > 2
       or (step_row.step_type = 'PROBE' and cardinality(selected_ids) <> 2)
       or coalesce(cardinality(submitted_ids), 0) <> cardinality(selected_ids)
       or submitted_unique_count <> cardinality(submitted_ids)
       or not (selected_ids <@ submitted_ids and submitted_ids <@ selected_ids)
       or new.total_questions <> cardinality(selected_ids) then
      raise exception 'LEARNING_GUIDED_SELECTION_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists learning_guided_attempts_question_selection_v9_guard
  on public.learning_guided_step_attempts;
create trigger learning_guided_attempts_question_selection_v9_guard
before insert on public.learning_guided_step_attempts
for each row execute function private.enforce_guided_question_selection_v9();

revoke all on function private.assert_bncc_discipline_journey_v9(uuid, uuid, uuid, uuid),
  private.enforce_bncc_discipline_journey_session_v9(),
  private.enforce_bncc_discipline_journey_step_v9(),
  private.enforce_guided_question_selection_v9() from public, anon, authenticated;

revoke all on function public.list_student_guided_discipline_journeys_v9(uuid, uuid),
  public.start_guided_discipline_journey_v9(uuid, uuid, uuid),
  public.get_guided_learning_step_v4(uuid) from public, anon;
grant execute on function public.list_student_guided_discipline_journeys_v9(uuid, uuid),
  public.start_guided_discipline_journey_v9(uuid, uuid, uuid),
  public.get_guided_learning_step_v4(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
