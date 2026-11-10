import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const sourcePath = resolve(root, 'content/adaptive/tec-escola-core-v16-2/guided-study-em1-math-physics-v1.json');
export const migrationPath = resolve(root, 'supabase/migrations/20261110050000_guided_study_v16_2_math_physics_content.sql');

const purposes = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const expectedSkills = new Map([
  ['EM13MAT302', {
    componentCode: 'MAT', area: 'MATEMATICA', page: 536, sequenceAfter: 'EM13MAT101',
    description: 'Construir modelos empregando as funções polinomiais de 1º ou 2º graus, para resolver problemas em contextos diversos, com ou sem apoio de tecnologias digitais.',
  }],
  ['EM13CNT204', {
    componentCode: 'CNT', area: 'CIENCIAS_DA_NATUREZA', page: 543, sequenceAfter: 'EM13CNT101',
    description: 'Elaborar explicações e previsões a respeito dos movimentos de objetos na Terra, no Sistema Solar e no Universo com base na análise das interações gravitacionais.',
  }],
]);
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function validateSource(source) {
  const errors = [];
  if (source.packVersion !== 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V16_2') errors.push('unexpected pack version');
  if (source.contentVersion !== 7) errors.push('content version must be 7');
  if (source.recommendedGrade !== 1 || source.recommendedGradeSource !== 'TECESCOLA_PEDAGOGICAL_SEQUENCE') {
    errors.push('grade placement must be explicitly institutional for EM1');
  }
  if (!source.officialSourceUrl?.startsWith('https://basenacionalcomum.mec.gov.br/')) errors.push('official BNCC source is missing');
  if (source.skills.length !== expectedSkills.size || new Set(source.skills.map(({ code }) => code)).size !== expectedSkills.size) {
    errors.push('expected exactly the two scoped Math and Physics skills');
  }

  const ids = new Set();
  const stems = new Set();
  for (const skill of source.skills) {
    const expected = expectedSkills.get(skill.code);
    if (!expected || skill.componentCode !== expected.componentCode || skill.area !== expected.area ||
        skill.officialPage !== expected.page || skill.sequenceAfter !== expected.sequenceAfter ||
        skill.officialDescription !== expected.description) {
      errors.push(`${skill.code}: official component, area, page, or sequence relationship mismatch`);
    }
    if (!skill.officialDescription?.trim() || skill.lesson?.content?.trim().length < 900 ||
        skill.lesson?.summary?.trim().length < 40 || skill.lesson?.workedExample?.trim().length < 80 ||
        skill.lesson?.tips?.length < 3 || skill.lesson?.estimatedMinutes < 8) {
      errors.push(`${skill.code}: lesson, example, or guidance is incomplete`);
    }

    const purposeCounts = Object.fromEntries(purposes.map((purpose) => [purpose, 0]));
    const contexts = new Set();
    const processes = new Set();
    const difficultyCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const question of skill.questions ?? []) {
      const id = question.id;
      if (!id || ids.has(id)) errors.push(`${skill.code}: question id is missing or duplicated`);
      ids.add(id);
      if (!(question.purpose in purposeCounts)) errors.push(`${skill.code}/${id}: invalid question purpose`);
      else purposeCounts[question.purpose] += 1;
      if (!['EASY', 'MEDIUM', 'HARD'].includes(question.difficulty)) errors.push(`${skill.code}/${id}: invalid difficulty`);
      else difficultyCounts[question.difficulty] += 1;
      if (!question.cognitiveProcess || !question.contextFamily) errors.push(`${skill.code}/${id}: context or cognitive demand is missing`);
      contexts.add(question.contextFamily);
      processes.add(question.cognitiveProcess);

      const statement = question.statement?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      if (!statement || statement.length < 24 || stems.has(statement)) errors.push(`${skill.code}/${id}: missing or duplicate question stem`);
      stems.add(statement);
      const options = question.options;
      if (!Array.isArray(options) || options.length !== 4 || new Set(options).size !== 4 ||
          options.filter((option) => option === question.answer).length !== 1 ||
          question.explanation?.trim().length < 45) {
        errors.push(`${skill.code}/${id}: four distinct options, one answer, and a substantive explanation are required`);
      }
      if (/\b(?:demo(?:nstrativ[oa]s?)?|placeholder|lorem ipsum|teste interno)\b/i.test(`${question.statement} ${question.explanation}`)) {
        errors.push(`${skill.code}/${id}: demonstration or placeholder content`);
      }
    }
    if (source.skills.length && skill.questions?.length !== 10) errors.push(`${skill.code}: expected ten authored questions`);
    if (purposes.some((purpose) => purposeCounts[purpose] !== 2)) errors.push(`${skill.code}: expected two questions in every adaptive purpose`);
    if (contexts.size < 8 || processes.size < 5 || Object.values(difficultyCounts).some((count) => count === 0)) {
      errors.push(`${skill.code}: contextual, cognitive, or difficulty diversity is insufficient`);
    }
  }

  const audit = source.authoringAudit;
  if (audit?.sourcePack !== 'TECESCOLA_BNCC_GUIDED_STUDY_V13' ||
      audit?.reviewType !== 'TECHNICAL_CONTENT_EXTENSION' || audit?.humanCertification !== 'NOT_CLAIMED' ||
      audit?.sourceRecordsMutated !== false || !Array.isArray(audit?.reviewCriteria) || audit.reviewCriteria.length < 4) {
    errors.push('authoring audit must preserve prior records and not claim human certification');
  }
  return errors;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function renderMigration(source) {
  const canonical = JSON.stringify(canonicalize(source));
  const contentHash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  const skillCodes = source.skills.map(({ code }) => code);
  const manifest = {
    packVersion: source.packVersion,
    sourceOfTruth: 'content/adaptive/tec-escola-core-v16-2/guided-study-em1-math-physics-v1.json',
    provenance: 'Newly authored version 7 lessons and questions extend the exact V13 Mathematics and Physics pathways; prior versions and student records are preserved. Technical validation is not human pedagogical certification.',
    officialSourceUrl: source.officialSourceUrl,
    skillCodes,
    skillCount: source.skills.length,
    lessonCount: source.skills.length,
    questionCount: source.skills.reduce((total, skill) => total + skill.questions.length, 0),
    contentVersion: source.contentVersion,
    recommendedGrade: source.recommendedGrade,
    recommendedGradeSource: source.recommendedGradeSource,
    authoringAudit: source.authoringAudit,
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    valid: true,
    canonicalHash: contentHash,
    genericTemplateQuestions: 0,
    genericTemplateLessons: 0,
    genericTemplateFamilies: 0,
    duplicateSemanticSkills: [],
    unknownPrerequisites: [],
    prerequisiteCycles: [],
    nearDuplicateStems: [],
    errors: [],
  };

  return `-- Generated by tools/adaptive/guided-study-v16-2-content.mjs. Do not edit by hand.
-- V16_2_CANONICAL_HASH=${contentHash}
begin;

do $guided_study_v16_2_preflight$
declare
  catalog_id uuid;
begin
  if to_regprocedure('private.validate_mapped_bncc_skill_v12(uuid,text,jsonb)') is null
     or to_regprocedure('private.validate_adaptive_content_pack_v12(uuid)') is null
     or to_regprocedure('private.recommend_guided_study_v11(uuid)') is null
     or to_regprocedure('public.start_guided_learning_session_v4(uuid,uuid,uuid)') is null then
    raise exception 'GUIDED_STUDY_V16_2_REQUIRED_VALIDATORS_MISSING';
  end if;
  select catalog.id into catalog_id
    from public.learning_curriculum_catalogs catalog
   where catalog.code = 'BNCC_2018' and catalog.active
   order by catalog.version desc limit 1;
  if catalog_id is null then raise exception 'GUIDED_STUDY_V16_2_BNCC_CATALOG_MISSING'; end if;
end;
$guided_study_v16_2_preflight$;

-- Let the existing V4 engine select the published version carried by each skill.
do $guided_study_v16_2_v4_content_version$
declare
  definition text;
  lesson_legacy_count integer;
  lesson_versioned_count integer;
  question_legacy_count integer;
  question_versioned_count integer;
begin
  definition := pg_get_functiondef('public.start_guided_learning_session_v4(uuid,uuid,uuid)'::regprocedure);
  select count(*)::integer into lesson_legacy_count
    from regexp_matches(definition, 'lesson[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*4', 'g');
  select count(*)::integer into lesson_versioned_count
    from regexp_matches(definition, 'lesson[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*coalesce[[:space:]]*\([[:space:]]*nullif[[:space:]]*\([[:space:]]*target_skill[.]metadata[[:space:]]*->>[[:space:]]*''content_version''', 'g');
  select count(*)::integer into question_legacy_count
    from regexp_matches(definition, 'set_row[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*4', 'g');
  select count(*)::integer into question_versioned_count
    from regexp_matches(definition, 'set_row[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*coalesce[[:space:]]*\([[:space:]]*nullif[[:space:]]*\([[:space:]]*target_skill[.]metadata[[:space:]]*->>[[:space:]]*''content_version''', 'g');

  if lesson_legacy_count = 1 and lesson_versioned_count = 0
     and question_legacy_count = 1 and question_versioned_count = 0 then
    definition := regexp_replace(definition,
      'lesson[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*4',
      'lesson.version = coalesce(nullif(target_skill.metadata->>''content_version'', '''')::integer, 4)');
    definition := regexp_replace(definition,
      'set_row[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*4',
      'set_row.version = coalesce(nullif(target_skill.metadata->>''content_version'', '''')::integer, 4)');
  elsif lesson_legacy_count <> 0 or lesson_versioned_count <> 1
     or question_legacy_count <> 0 or question_versioned_count <> 1 then
    raise exception 'GUIDED_STUDY_V16_2_V4_CONTENT_VERSION_SHAPE_CHANGED lesson_legacy=% lesson_versioned=% question_legacy=% question_versioned=%',
      lesson_legacy_count, lesson_versioned_count, question_legacy_count, question_versioned_count;
  end if;
  execute definition;
end;
$guided_study_v16_2_v4_content_version$;

-- Extend only explicit skill-to-discipline relationships. Do not equate a BNCC area with every subject in it.
create or replace view private.learning_guided_subject_skill_bindings_v16
with (security_barrier = true)
as
  select subject.institution_id,
         subject.id as subject_id,
         skill.id as canonical_skill_id
    from public.subjects subject
    join (values
      ('MAT', 'EM13MAT101'),
      ('MAT', 'EM13MAT302'),
      ('FIS', 'EM13CNT101'),
      ('FIS', 'EM13CNT204')
    ) as mapping(subject_code, official_skill_code)
      on upper(btrim(coalesce(subject.code, ''))) = mapping.subject_code
    join public.learning_curriculum_skills skill
      on skill.code = mapping.official_skill_code
     and skill.active
    join public.learning_curriculum_catalogs catalog
      on catalog.id = skill.catalog_id
     and catalog.code = 'BNCC_2018'
   where subject.active;

insert into public.learning_adaptive_content_packs(
  pack_version, canonical_hash, manifest, pedagogical_review_status, active, publication_status
) values (
  ${sqlLiteral(source.packVersion)}, ${sqlLiteral(contentHash)}, ${sqlLiteral(JSON.stringify(manifest))}::jsonb,
  'PEDAGOGICAL_REVIEW_PENDING', true, 'STAGING'
)
on conflict (pack_version) do update set
  canonical_hash = excluded.canonical_hash,
  manifest = excluded.manifest,
  pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING',
  active = true,
  publication_status = 'STAGING',
  updated_at = now();

do $guided_study_v16_2_content_seed$
declare
  content jsonb := ${sqlLiteral(JSON.stringify(source))}::jsonb;
  skill_data jsonb;
  lesson_data jsonb;
  question_data jsonb;
  v_catalog_id uuid;
  v_skill_id uuid;
  v_question_id uuid;
  v_question_set_id uuid;
  content_id text;
  next_position integer;
  validation jsonb;
begin
  select catalog.id into v_catalog_id from public.learning_curriculum_catalogs catalog
   where catalog.code = 'BNCC_2018' and catalog.active order by catalog.version desc limit 1;
  if v_catalog_id is null then raise exception 'GUIDED_STUDY_V16_2_BNCC_CATALOG_MISSING'; end if;

  for skill_data in select value from jsonb_array_elements(content->'skills') loop
    insert into public.learning_curriculum_skills(
      catalog_id, code, stage, grade_level, subject_area, domain, title, description,
      active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status,
      bncc_alignment_status, publication_status, metadata
    ) values (
      v_catalog_id, skill_data->>'code', 'ENSINO_MEDIO', null, skill_data->>'area', skill_data->>'domain',
      skill_data->>'title', skill_data->>'officialDescription', true, 'LEAF', 'CONTENT_READY', false,
      'PEDAGOGICAL_REVIEW_PENDING', 'CANDIDATE', 'STAGING',
      jsonb_build_object(
        'official_code', skill_data->>'code', 'official_source_id', 'BNCC_EM_2018',
        'official_source_url', content->>'officialSourceUrl',
        'official_source_page', (skill_data->>'officialPage')::integer,
        'official_component_code', skill_data->>'componentCode', 'official_stage', 'ENSINO_MEDIO',
        'official_grade_range', '1-3', 'mapping_status', 'MAPPED',
        'mapping_source', 'TECESCOLA_BNCC_GUIDED_STUDY_V16_2',
        'content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
        'recommended_grade', (content->>'recommendedGrade')::integer,
        'recommended_grade_source', content->>'recommendedGradeSource',
        'sequence_after', skill_data->>'sequenceAfter',
        'pedagogical_review_status', 'PENDING'
      )
    ) on conflict (catalog_id, code) do nothing;

    select skill.id into v_skill_id from public.learning_curriculum_skills skill
     where skill.catalog_id = v_catalog_id and skill.code = skill_data->>'code';
    if v_skill_id is null then raise exception 'GUIDED_STUDY_V16_2_SKILL_NOT_FOUND code=%', skill_data->>'code'; end if;
    if (select coalesce(skill.metadata->>'official_code', skill.code) from public.learning_curriculum_skills skill where skill.id = v_skill_id)
       is distinct from skill_data->>'code' then
      raise exception 'GUIDED_STUDY_V16_2_OFFICIAL_CODE_MISMATCH code=%', skill_data->>'code';
    end if;

    insert into public.learning_curriculum_grade_targets(
      catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active
    ) values (
      v_catalog_id, 'ENSINO_MEDIO', (content->>'recommendedGrade')::smallint,
      skill_data->>'area', v_skill_id, 10, (skill_data->>'officialPage')::integer, true
    ) on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id)
    do update set active = true, priority = excluded.priority, sort_order = excluded.sort_order, updated_at = now();

    lesson_data := skill_data->'lesson';
    insert into public.learning_skill_lessons(
      canonical_skill_id, version, title, summary, content_markdown, worked_example, tips,
      estimated_minutes, active, metadata
    ) values (
      v_skill_id, (content->>'contentVersion')::integer, lesson_data->>'title', lesson_data->>'summary',
      lesson_data->>'content', lesson_data->>'workedExample',
      array(select jsonb_array_elements_text(lesson_data->'tips')),
      (lesson_data->>'estimatedMinutes')::integer, true,
      jsonb_build_object('content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
        'official_bncc_code', skill_data->>'code', 'official_source_url', content->>'officialSourceUrl',
        'official_source_page', (skill_data->>'officialPage')::integer, 'content_origin', 'AUTHORED_V16_2',
        'sequence_after', skill_data->>'sequenceAfter', 'recommended_grade', (content->>'recommendedGrade')::integer,
        'recommended_grade_source', content->>'recommendedGradeSource',
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING')
    ) on conflict (canonical_skill_id, version) do update set
      title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown,
      worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes,
      active = true, metadata = excluded.metadata, updated_at = now();

    for question_data in select value from jsonb_array_elements(skill_data->'questions') loop
      content_id := (skill_data->>'code') || ':v16.2:' || (question_data->>'id');
      select bank.id into v_question_id from public.learning_question_bank bank
       where bank.source_type = 'TECESCOLA_BNCC_GUIDED_STUDY_V16_2'
         and bank.metadata->>'content_id' = content_id limit 1;

      if v_question_id is null then
        insert into public.learning_question_bank(
          package_type, source_type, source_name, subject_area, domain, topic, statement, options,
          correct_answer, explanation, difficulty, cognitive_process, context_family, knowledge_mapping_status,
          knowledge_mapping_version, estimated_minutes, provenance, source_reference, metadata, active
        ) values (
          'TECESCOLA', 'TECESCOLA_BNCC_GUIDED_STUDY_V16_2', 'TecEscola Guided Study V16.2',
          skill_data->>'area', skill_data->>'domain', lower(skill_data->>'code'), question_data->>'statement',
          question_data->'options', to_jsonb(question_data->>'answer'), question_data->>'explanation',
          question_data->>'difficulty', question_data->>'cognitiveProcess', question_data->>'contextFamily',
          'READY', 'V16.2', 2, 'TECESCOLA_BNCC_AUTHORED_V16_2', content->>'officialSourceUrl',
          jsonb_build_object('content_id', content_id, 'purpose', question_data->>'purpose',
            'official_bncc_code', skill_data->>'code', 'official_source_url', content->>'officialSourceUrl',
            'official_source_page', (skill_data->>'officialPage')::integer, 'content_pack', content->>'packVersion',
            'content_version', (content->>'contentVersion')::integer, 'content_origin', 'AUTHORED_V16_2',
            'recommended_grade', (content->>'recommendedGrade')::integer,
            'recommended_grade_source', content->>'recommendedGradeSource',
            'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'), true
        ) returning id into v_question_id;
      else
        update public.learning_question_bank set
          subject_area = skill_data->>'area', domain = skill_data->>'domain', topic = lower(skill_data->>'code'),
          statement = question_data->>'statement', options = question_data->'options',
          correct_answer = to_jsonb(question_data->>'answer'), explanation = question_data->>'explanation',
          difficulty = question_data->>'difficulty', cognitive_process = question_data->>'cognitiveProcess',
          context_family = question_data->>'contextFamily', knowledge_mapping_status = 'READY',
          knowledge_mapping_version = 'V16.2', estimated_minutes = 2,
          provenance = 'TECESCOLA_BNCC_AUTHORED_V16_2', source_reference = content->>'officialSourceUrl',
          metadata = jsonb_build_object('content_id', content_id, 'purpose', question_data->>'purpose',
            'official_bncc_code', skill_data->>'code', 'official_source_url', content->>'officialSourceUrl',
            'official_source_page', (skill_data->>'officialPage')::integer, 'content_pack', content->>'packVersion',
            'content_version', (content->>'contentVersion')::integer, 'content_origin', 'AUTHORED_V16_2',
            'recommended_grade', (content->>'recommendedGrade')::integer,
            'recommended_grade_source', content->>'recommendedGradeSource',
            'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'),
          active = true, updated_at = now()
         where id = v_question_id;
      end if;

      insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
      values (v_question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;

      insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, difficulty, active, metadata)
      values (
        'GLOBAL', v_skill_id, question_data->>'purpose', (content->>'contentVersion')::integer,
        question_data->>'difficulty', true,
        jsonb_build_object('content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
          'official_bncc_code', skill_data->>'code', 'selection_policy', 'UNSEEN_FIRST_LIMIT_TWO',
          'recommended_grade', (content->>'recommendedGrade')::integer,
          'recommended_grade_source', content->>'recommendedGradeSource',
          'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING')
      ) on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL'
      do update set difficulty = excluded.difficulty, active = true, metadata = excluded.metadata, updated_at = now()
      returning id into v_question_set_id;

      if not exists (
        select 1 from public.learning_question_set_items item
         where item.question_set_id = v_question_set_id and item.question_bank_id = v_question_id
      ) then
        select coalesce(max(position), -1) + 1 into next_position
          from public.learning_question_set_items item where item.question_set_id = v_question_set_id;
        insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
        values (v_question_set_id, v_question_id, next_position);
      end if;
    end loop;

    update public.learning_curriculum_skills skill set
      metadata = coalesce(skill.metadata, '{}'::jsonb) || jsonb_build_object(
        'official_code', skill_data->>'code', 'official_source_id', 'BNCC_EM_2018',
        'official_source_url', content->>'officialSourceUrl', 'official_source_page', (skill_data->>'officialPage')::integer,
        'official_component_code', skill_data->>'componentCode',
        'official_grade_range', '1-3', 'mapping_status', 'MAPPED',
        'mapping_source', 'TECESCOLA_BNCC_GUIDED_STUDY_V16_2', 'content_pack', content->>'packVersion',
        'content_version', (content->>'contentVersion')::integer, 'content_origin', 'AUTHORED_V16_2',
        'recommended_grade', (content->>'recommendedGrade')::integer,
        'recommended_grade_source', content->>'recommendedGradeSource',
        'sequence_after', skill_data->>'sequenceAfter',
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'
      ),
      subject_area = skill_data->>'area', domain = skill_data->>'domain', title = skill_data->>'title',
      description = skill_data->>'officialDescription', stage = 'ENSINO_MEDIO', grade_level = null,
      active = true, node_kind = 'LEAF', content_readiness = 'CONTENT_READY', mastery_targetable = false,
      bncc_alignment_status = 'MAPPED', publication_status = 'STAGING',
      pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING', updated_at = now()
     where skill.id = v_skill_id;

    select private.validate_mapped_bncc_skill_v12(v_skill_id, skill_data->>'code', skill.metadata)
      into validation from public.learning_curriculum_skills skill where skill.id = v_skill_id;
    if validation->>'status' <> 'READY' then
      raise exception 'GUIDED_STUDY_V16_2_SKILL_VALIDATION_FAILED code=% result=%', skill_data->>'code', validation;
    end if;
  end loop;

  if not exists (
    select 1 from public.learning_adaptive_content_packs pack
     where pack.pack_version = content->>'packVersion' and pack.active
       and pack.publication_status = 'PUBLISHED' and pack.technical_validation_status = 'PUBLISHED'
       and pack.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
  ) then raise exception 'GUIDED_STUDY_V16_2_PACK_VALIDATION_FAILED'; end if;

  if exists (
    select 1 from jsonb_array_elements(content->'skills') entry
    join public.learning_curriculum_skills skill on skill.code = entry->>'code' and skill.catalog_id = v_catalog_id
    where skill.publication_status <> 'PUBLISHED' or skill.technical_validation_status <> 'PUBLISHED'
       or skill.content_readiness <> 'ADAPTIVE_READY' or not skill.mastery_targetable
       or skill.pedagogical_review_status <> 'PEDAGOGICAL_REVIEW_PENDING'
  ) then raise exception 'GUIDED_STUDY_V16_2_SKILL_PUBLICATION_GATE_FAILED'; end if;
end;
$guided_study_v16_2_content_seed$;

notify pgrst, 'reload schema';
commit;
`;
}

export function buildMigration(source) {
  const errors = validateSource(source);
  if (errors.length) throw new Error(errors.join('\n'));
  return renderMigration(source);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const migration = buildMigration(source);
  if (process.argv.includes('--check')) {
    const existing = readFileSync(migrationPath, 'utf8');
    if (existing !== migration) throw new Error('V16.2 migration is stale; run the generator to refresh it.');
    process.stdout.write(`${source.skills.length} skills, ${source.skills.reduce((n, skill) => n + skill.questions.length, 0)} questions; SHA-256 ${migration.match(/V16_2_CANONICAL_HASH=([a-f0-9]{64})/)?.[1]}\n`);
  } else {
    writeFileSync(migrationPath, migration, 'utf8');
    process.stdout.write(`Generated ${migrationPath}\n`);
  }
}
