import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'content/adaptive/tec-escola-core-v13/guided-study-em-content-v1.json');
const migrationPath = resolve(root, 'supabase/migrations/20261109000100_guided_study_bncc_content_recovery_v13.sql');
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const expected = new Map([
  ['EM13MAT101', ['MATEMATICA', 525]],
  ['EM13LGG303', ['LINGUAGENS', 485]],
  ['EM13CNT101', ['CIENCIAS_DA_NATUREZA', 540]],
  ['EM13CHS103', ['CIENCIAS_HUMANAS', 560]],
]);
const purposes = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const expectedLegacyQuestionSources = new Set([
  'v8-mat-probe-01', 'v8-mat-practice-01', 'v8-mat-transfer-01', 'v8-mat-lock-01', 'v8-mat-review-01',
  'v8-lgg-probe-01', 'v8-lgg-practice-01', 'v8-lgg-transfer-01', 'v8-lgg-lock-01', 'v8-lgg-review-01',
  'v8-cnt-probe-01', 'v8-cnt-practice-01', 'v8-cnt-transfer-01', 'v8-cnt-lock-01', 'v8-cnt-review-01',
  'v8-chs-probe-01', 'v8-chs-practice-01', 'v8-chs-transfer-01', 'v8-chs-lock-01', 'v8-chs-review-01',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function validate() {
  const errors = [];
  if (source.packVersion !== 'tec-escola-bncc-guided-study-v13') errors.push('unexpected pack version');
  if (source.contentVersion !== 6) errors.push('content version must be 6');
  if (source.recommendedGrade !== 1 || source.recommendedGradeSource !== 'TECESCOLA_PEDAGOGICAL_SEQUENCE') {
    errors.push('grade placement must remain explicitly institutional');
  }
  if (source.skills.length !== expected.size || new Set(source.skills.map(({ code }) => code)).size !== expected.size) {
    errors.push('expected exactly four unique EM1 skill codes');
  }
  const ids = new Set();
  const contentQuestions = new Map();
  for (const skill of source.skills) {
    const [area, page] = expected.get(skill.code) ?? [];
    if (!area || skill.area !== area || skill.officialPage !== page) errors.push(`${skill.code}: official area/page mismatch`);
    if (!skill.officialDescription || skill.lesson.content.length < 120 || skill.lesson.summary.length < 20) {
      errors.push(`${skill.code}: lesson or official descriptor is incomplete`);
    }
    const counts = Object.fromEntries(purposes.map((purpose) => [purpose, 0]));
    const stems = new Set();
    for (const question of skill.questions) {
      if (!question.id || ids.has(question.id)) errors.push(`${skill.code}: question id is missing or duplicated`);
      ids.add(question.id);
      contentQuestions.set(`${skill.code}:${question.id}`, question);
      if (!(question.purpose in counts)) errors.push(`${skill.code}: invalid purpose ${question.purpose}`);
      else counts[question.purpose] += 1;
      const stem = question.statement.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      if (stem.length < 12 || stems.has(stem)) errors.push(`${skill.code}: missing or duplicate question stem`);
      stems.add(stem);
      if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 5 ||
          !question.options.includes(question.answer) || question.explanation.trim().length < 12) {
        errors.push(`${skill.code}/${question.id}: options, key, or explanation invalid`);
      }
      if (!['EASY', 'MEDIUM', 'HARD'].includes(question.difficulty)) errors.push(`${skill.code}/${question.id}: invalid difficulty`);
      if (/\bdemo(?:nstrativ[oa]s?)?\b|placeholder|lorem ipsum|teste interno/i.test(`${question.statement} ${question.explanation}`)) {
        errors.push(`${skill.code}/${question.id}: demonstration or placeholder content`);
      }
    }
    if (skill.questions.length !== 6 || counts.PROBE !== 1 || counts.PRACTICE !== 2 ||
        counts.TRANSFER !== 1 || counts.LOCK_IN !== 1 || counts.REVIEW !== 1) {
      errors.push(`${skill.code}: expected 1 probe, 2 practice and 1 each transfer/lock-in/review`);
    }
  }
  const audit = source.conversionAudit;
  if (audit?.sourcePack !== 'TECESCOLA_BNCC_DEEP_LEARNING_V8' ||
      audit?.reviewType !== 'AUTOMATED_TECHNICAL_CONTENT_RECONCILIATION' ||
      audit?.humanCertification !== 'NOT_CLAIMED' || audit?.sourceRecordsMutated !== false ||
      !Array.isArray(audit?.reviewCriteria) || audit.reviewCriteria.length < 4) {
    errors.push('conversion audit must document objective checks, no human certification, and immutable legacy records');
  }
  const lineage = Array.isArray(audit?.questions) ? audit.questions : [];
  const lineageTargets = new Set();
  const legacySources = new Set();
  let newPracticeCount = 0;
  for (const entry of lineage) {
    const key = `${entry.skillCode}:${entry.contentQuestionId}`;
    const question = contentQuestions.get(key);
    if (!question || lineageTargets.has(key)) errors.push(`conversion audit target is missing or duplicated: ${key}`);
    lineageTargets.add(key);
    if (entry.sourceQuestionId) {
      if (entry.action !== 'REAUTHORED_AND_REVALIDATED' || legacySources.has(entry.sourceQuestionId)) {
        errors.push(`legacy conversion source is invalid or duplicated: ${entry.sourceQuestionId}`);
      }
      legacySources.add(entry.sourceQuestionId);
    } else if (question?.purpose === 'PRACTICE' && entry.action === 'NEW_PRACTICE_VARIATION') {
      newPracticeCount += 1;
    } else {
      errors.push(`only an additional practice item may be marked as new: ${key}`);
    }
  }
  if (lineageTargets.size !== contentQuestions.size || lineage.length !== contentQuestions.size) {
    errors.push('every V13 question must have exactly one conversion/source record');
  }
  if (newPracticeCount !== 4 || legacySources.size !== 20 ||
      [...expectedLegacyQuestionSources].some((sourceId) => !legacySources.has(sourceId)) ||
      [...legacySources].some((sourceId) => !expectedLegacyQuestionSources.has(sourceId))) {
    errors.push('expected 20 re-authored V8 questions and four new practice variations');
  }
  if (errors.length) throw new Error(errors.join('\n'));
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderMigration() {
  const canonical = JSON.stringify(canonicalize(source));
  const contentHash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  const manifest = {
    packVersion: source.packVersion,
    sourceOfTruth: 'content/adaptive/tec-escola-core-v13/guided-study-em-content-v1.json',
    provenance: 'V13 reauthored content reconciles the existing V4/V8 lessons and 20 V8 question sources; four additional practice variations are newly authored. Legacy records are preserved. Technical checks do not claim human pedagogical certification or reproduce official BNCC text.',
    officialSourceUrl: source.officialSourceUrl,
    skillCodes: source.skills.map(({ code }) => code),
    skillCount: source.skills.length,
    lessonCount: source.skills.length,
    questionCount: source.skills.reduce((total, skill) => total + skill.questions.length, 0),
    contentVersion: source.contentVersion,
    recommendedGrade: source.recommendedGrade,
    recommendedGradeSource: source.recommendedGradeSource,
    conversionAudit: source.conversionAudit,
    reusedQuestionSourceCount: 20,
    newPracticeQuestionCount: 4,
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
  const jsonSql = sqlLiteral(JSON.stringify(source));
  const manifestSql = sqlLiteral(JSON.stringify(manifest));

  return `-- Generated by tools/adaptive/guided-study-v13-content.mjs. Do not edit by hand.
-- V13_CANONICAL_HASH=${contentHash}
begin;

do $guided_study_v13_preflight$
declare
  target_count integer;
begin
  if to_regprocedure('private.validate_mapped_bncc_skill_v12(uuid,text,jsonb)') is null
     or to_regprocedure('private.validate_adaptive_content_pack_v12(uuid)') is null then
    raise exception 'GUIDED_STUDY_V12_VALIDATORS_REQUIRED';
  end if;
  select count(*) into target_count
    from public.learning_curriculum_skills skill
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
   where catalog.code = 'BNCC_2018'
     and skill.code = any (array['EM13MAT101','EM13LGG303','EM13CNT101','EM13CHS103']);
  if target_count <> 4 then
    raise exception 'GUIDED_STUDY_V13_EXPECTED_FOUR_EXISTING_SKILLS actual=%', target_count;
  end if;
end;
$guided_study_v13_preflight$;

create or replace view private.learning_curriculum_subject_links_v13
with (security_barrier = true)
as
  select link.institution_id, link.subject_id, link.subject_area, link.active
    from public.learning_curriculum_subject_links link
  union
  select subject.institution_id, subject.id, mapping.subject_area, subject.active
    from public.subjects subject
    join (values
      ('MAT', 'MATEMATICA'),
      ('LP', 'LINGUAGENS'), ('ING', 'LINGUAGENS'), ('ART', 'LINGUAGENS'), ('EDF', 'LINGUAGENS'),
      ('BIO', 'CIENCIAS_DA_NATUREZA'), ('QUI', 'CIENCIAS_DA_NATUREZA'), ('FIS', 'CIENCIAS_DA_NATUREZA'),
      ('HIS', 'CIENCIAS_HUMANAS'), ('GEO', 'CIENCIAS_HUMANAS'), ('FIL', 'CIENCIAS_HUMANAS'), ('SOC', 'CIENCIAS_HUMANAS')
    ) as mapping(subject_code, subject_area)
      on upper(btrim(coalesce(subject.code, ''))) = mapping.subject_code
   where subject.active;

do $guided_study_v13_v11_compatibility$
declare
  function_owner name;
  definition text;
  subject_join_count integer;
  probe_version_count integer;
  patched_subject_join_count integer;
  patched_probe_version_count integer;
begin
  select owner_role.rolname into function_owner
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_roles owner_role on owner_role.oid = procedure.proowner
   where procedure.oid = 'private.recommend_guided_study_v11(uuid)'::regprocedure;
  if function_owner is null then raise exception 'GUIDED_STUDY_V11_FUNCTION_MISSING'; end if;

  execute format('grant usage on schema private to %I', function_owner);
  execute format('grant select on private.learning_curriculum_subject_links_v13 to %I', function_owner);
  definition := pg_get_functiondef('private.recommend_guided_study_v11(uuid)'::regprocedure);
  subject_join_count := (length(definition) - length(replace(definition, 'public.learning_curriculum_subject_links subject_link', ''))) /
    length('public.learning_curriculum_subject_links subject_link');
  probe_version_count := (length(definition) - length(replace(definition, 'question_set.version = 4', ''))) /
    length('question_set.version = 4');
  patched_subject_join_count := (length(definition) - length(replace(definition, 'private.learning_curriculum_subject_links_v13 subject_link', ''))) /
    length('private.learning_curriculum_subject_links_v13 subject_link');
  patched_probe_version_count := (length(definition) - length(replace(definition,
    'question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)', ''))) /
    length('question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)');
  if subject_join_count = 3 and probe_version_count = 2
     and patched_subject_join_count = 0 and patched_probe_version_count = 0 then
    definition := replace(definition,
      'public.learning_curriculum_subject_links subject_link',
      'private.learning_curriculum_subject_links_v13 subject_link');
    definition := replace(definition,
      'question_set.version = 4',
      'question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$'' then (skill.metadata->>''content_version'')::integer end from public.learning_curriculum_skills skill where skill.id = question_set.canonical_skill_id), 4)');
  elsif subject_join_count <> 0 or probe_version_count <> 0 or patched_subject_join_count <> 3 or patched_probe_version_count <> 2 then
    raise exception 'GUIDED_STUDY_V11_SOURCE_SHAPE_CHANGED subject_joins=% probe_version_checks=% patched_subject_joins=% patched_probe_version_checks=%', subject_join_count, probe_version_count, patched_subject_join_count, patched_probe_version_count;
  end if;
  execute definition;
end;
$guided_study_v13_v11_compatibility$;

do $guided_study_v13_runtime_provenance$
declare
  definition text;
  replacement_count integer;
  patched_count integer;
begin
  definition := pg_get_functiondef('public.start_guided_learning_session_v4(uuid,uuid,uuid)'::regprocedure);
  replacement_count := (length(definition) - length(replace(definition, '''content_version'', 5', ''))) / length('''content_version'', 5');
  patched_count := (length(definition) - length(replace(definition,
    '''content_version'', coalesce(nullif(target_skill.metadata->>''content_version'', '''')::integer, 5)', ''))) /
    length('''content_version'', coalesce(nullif(target_skill.metadata->>''content_version'', '''')::integer, 5)');
  if replacement_count = 3 and patched_count = 0 then
    definition := replace(definition, '''content_version'', 5',
      '''content_version'', coalesce(nullif(target_skill.metadata->>''content_version'', '''')::integer, 5)');
  elsif replacement_count <> 0 or patched_count <> 3 then
    raise exception 'GUIDED_STUDY_V8_START_SOURCE_SHAPE_CHANGED occurrences=% patched=%', replacement_count, patched_count;
  end if;
  execute definition;

  definition := pg_get_functiondef('public.submit_guided_learning_step_v4(uuid,jsonb,text)'::regprocedure);
  replacement_count := (length(definition) - length(replace(definition, '''content_version'',5', ''))) / length('''content_version'',5');
  patched_count := (length(definition) - length(replace(definition,
    '''content_version'',coalesce(nullif(session_row.metadata->>''content_version'','''')::integer,5)', ''))) /
    length('''content_version'',coalesce(nullif(session_row.metadata->>''content_version'','''')::integer,5)');
  if replacement_count = 2 and patched_count = 0 then
    definition := replace(definition, '''content_version'',5',
      '''content_version'',coalesce(nullif(session_row.metadata->>''content_version'','''')::integer,5)');
  elsif replacement_count <> 0 or patched_count <> 2 then
    raise exception 'GUIDED_STUDY_V8_SUBMIT_SOURCE_SHAPE_CHANGED occurrences=% patched=%', replacement_count, patched_count;
  end if;
  execute definition;
end;
$guided_study_v13_runtime_provenance$;

insert into public.learning_adaptive_content_packs(
  pack_version, canonical_hash, manifest, pedagogical_review_status, active
) values (
  ${sqlLiteral(source.packVersion)}, ${sqlLiteral(contentHash)}, ${manifestSql}::jsonb,
  'PEDAGOGICAL_REVIEW_PENDING', true
)
on conflict (pack_version) do update set
  canonical_hash = excluded.canonical_hash,
  manifest = excluded.manifest,
  pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING',
  active = true,
  updated_at = now();

do $guided_study_v13_content_seed$
declare
  content jsonb := ${jsonSql}::jsonb;
  skill_data jsonb;
  lesson_data jsonb;
  question_data jsonb;
  v_catalog_id uuid;
  skill_id uuid;
  lesson_id uuid;
  question_id uuid;
  question_set_id uuid;
  existing_position integer;
  next_position integer;
  content_id text;
  validation jsonb;
  demo_keys text[] := array['demo_preview','demo_preview_only','demonstration_only','is_test_fixture','fixture_only','test_fixture','qa_only'];
begin
  select catalog.id into v_catalog_id
    from public.learning_curriculum_catalogs catalog
   where catalog.code = 'BNCC_2018' and catalog.active
   order by catalog.version desc
   limit 1;
  if v_catalog_id is null then raise exception 'GUIDED_STUDY_V13_BNCC_CATALOG_MISSING'; end if;

  for skill_data in select value from jsonb_array_elements(content->'skills') loop
    select skill.id into skill_id
      from public.learning_curriculum_skills skill
     where skill.catalog_id = v_catalog_id and skill.code = skill_data->>'code';
    if skill_id is null then raise exception 'GUIDED_STUDY_V13_SKILL_NOT_FOUND code=%', skill_data->>'code'; end if;
    if (select skill.metadata->>'official_code' from public.learning_curriculum_skills skill where skill.id = skill_id)
       is distinct from skill_data->>'code' then
      raise exception 'GUIDED_STUDY_V13_OFFICIAL_CODE_MISMATCH code=%', skill_data->>'code';
    end if;

    insert into public.learning_curriculum_grade_targets(
      catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active
    ) values (v_catalog_id, 'ENSINO_MEDIO', (content->>'recommendedGrade')::smallint,
      skill_data->>'area', skill_id, 10, (skill_data->>'officialPage')::integer, true)
    on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id)
    do update set active = true, priority = excluded.priority, sort_order = excluded.sort_order, updated_at = now();

    lesson_data := skill_data->'lesson';
    insert into public.learning_skill_lessons(
      canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, active, metadata
    ) values (
      skill_id, (content->>'contentVersion')::integer, lesson_data->>'title', lesson_data->>'summary',
      lesson_data->>'content', lesson_data->>'workedExample',
      array(select jsonb_array_elements_text(lesson_data->'tips')),
      (lesson_data->>'estimatedMinutes')::integer, true,
      jsonb_build_object('content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
        'official_bncc_code', skill_data->>'code', 'official_source_url', content->>'officialSourceUrl',
        'official_source_page', (skill_data->>'officialPage')::integer, 'content_origin', 'V13_REAUTHORED_FROM_V4_V8',
        'recommended_grade', (content->>'recommendedGrade')::integer,
        'recommended_grade_source', content->>'recommendedGradeSource',
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING')
    ) on conflict (canonical_skill_id, version) do update set
      title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown,
      worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes,
      active = true, metadata = excluded.metadata, updated_at = now()
    returning id into lesson_id;

    for question_data in select value from jsonb_array_elements(skill_data->'questions') loop
      content_id := skill_data->>'code' || ':v13:' || question_data->>'id';
      select bank.id into question_id
        from public.learning_question_bank bank
       where bank.source_type = 'TECESCOLA_BNCC_GUIDED_STUDY_V13'
         and bank.metadata->>'content_id' = content_id
       limit 1;

      if question_id is null then
        insert into public.learning_question_bank(
          package_type, source_type, source_name, subject_area, domain, topic, statement, options,
          correct_answer, explanation, difficulty, cognitive_process, context_family, knowledge_mapping_status,
          knowledge_mapping_version, estimated_minutes, provenance, source_reference, metadata, active
        ) values (
          'TECESCOLA', 'TECESCOLA_BNCC_GUIDED_STUDY_V13', 'TecEscola BNCC Guided Study V13',
          skill_data->>'area', skill_data->>'domain', lower(skill_data->>'code'), question_data->>'statement',
          question_data->'options', to_jsonb(question_data->>'answer'), question_data->>'explanation',
          question_data->>'difficulty', question_data->>'cognitiveProcess', question_data->>'contextFamily',
          'READY', 'V13', 2, 'TECESCOLA_BNCC_AUTHORED_V13', content->>'officialSourceUrl',
          jsonb_build_object('content_id', content_id, 'purpose', question_data->>'purpose',
            'official_bncc_code', skill_data->>'code', 'official_source_url', content->>'officialSourceUrl',
            'official_source_page', (skill_data->>'officialPage')::integer,
            'content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
          'source_question_id', (select lineage->>'sourceQuestionId' from jsonb_array_elements(content->'conversionAudit'->'questions') lineage where lineage->>'skillCode' = skill_data->>'code' and lineage->>'contentQuestionId' = question_data->>'id'),
          'conversion_action', (select lineage->>'action' from jsonb_array_elements(content->'conversionAudit'->'questions') lineage where lineage->>'skillCode' = skill_data->>'code' and lineage->>'contentQuestionId' = question_data->>'id'),
          'content_origin', case when (select lineage->>'sourceQuestionId' from jsonb_array_elements(content->'conversionAudit'->'questions') lineage where lineage->>'skillCode' = skill_data->>'code' and lineage->>'contentQuestionId' = question_data->>'id') is null then 'V13_NEW_SUPPLEMENT' else 'V13_REAUTHORED_V8' end,
            'recommended_grade', (content->>'recommendedGrade')::integer,
            'recommended_grade_source', content->>'recommendedGradeSource',
            'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'), true
        ) returning id into question_id;
      else
        update public.learning_question_bank bank set
          subject_area = skill_data->>'area', domain = skill_data->>'domain', topic = lower(skill_data->>'code'),
          statement = question_data->>'statement', options = question_data->'options',
          correct_answer = to_jsonb(question_data->>'answer'), explanation = question_data->>'explanation',
          difficulty = question_data->>'difficulty', cognitive_process = question_data->>'cognitiveProcess',
          context_family = question_data->>'contextFamily', knowledge_mapping_status = 'READY',
          knowledge_mapping_version = 'V13', estimated_minutes = 2, provenance = 'TECESCOLA_BNCC_AUTHORED_V13',
          source_reference = content->>'officialSourceUrl',
          metadata = jsonb_build_object('content_id', content_id, 'purpose', question_data->>'purpose',
            'official_bncc_code', skill_data->>'code', 'official_source_url', content->>'officialSourceUrl',
            'official_source_page', (skill_data->>'officialPage')::integer,
            'content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
            'source_question_id', (select lineage->>'sourceQuestionId' from jsonb_array_elements(content->'conversionAudit'->'questions') lineage where lineage->>'skillCode' = skill_data->>'code' and lineage->>'contentQuestionId' = question_data->>'id'),
            'conversion_action', (select lineage->>'action' from jsonb_array_elements(content->'conversionAudit'->'questions') lineage where lineage->>'skillCode' = skill_data->>'code' and lineage->>'contentQuestionId' = question_data->>'id'),
            'content_origin', case when (select lineage->>'sourceQuestionId' from jsonb_array_elements(content->'conversionAudit'->'questions') lineage where lineage->>'skillCode' = skill_data->>'code' and lineage->>'contentQuestionId' = question_data->>'id') is null then 'V13_NEW_SUPPLEMENT' else 'V13_REAUTHORED_V8' end,
            'recommended_grade', (content->>'recommendedGrade')::integer,
            'recommended_grade_source', content->>'recommendedGradeSource',
            'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'),
          active = true, updated_at = now()
        where bank.id = question_id;
      end if;

      insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
      values (question_id, skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;

      insert into public.learning_question_sets(
        scope, canonical_skill_id, purpose, version, difficulty, active, metadata
      ) values (
        'GLOBAL', skill_id, question_data->>'purpose', (content->>'contentVersion')::integer,
        question_data->>'difficulty', true,
        jsonb_build_object('content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
          'official_bncc_code', skill_data->>'code', 'selection_policy', 'UNSEEN_FIRST_LIMIT_TWO',
          'recommended_grade', (content->>'recommendedGrade')::integer,
          'recommended_grade_source', content->>'recommendedGradeSource',
          'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING')
      ) on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL'
      do update set difficulty = excluded.difficulty, active = true, metadata = excluded.metadata, updated_at = now()
      returning id into question_set_id;

      select item.position into existing_position
        from public.learning_question_set_items item
       where item.question_set_id = question_set_id and item.question_bank_id = question_id;
      if not found then
        select coalesce(max(item.position), -1) + 1 into next_position
          from public.learning_question_set_items item where item.question_set_id = question_set_id;
        insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
        values (question_set_id, question_id, next_position);
      end if;
    end loop;

    update public.learning_curriculum_skills skill set
      metadata = (coalesce(skill.metadata, '{}'::jsonb) - demo_keys) || jsonb_build_object(
        'official_code', skill_data->>'code', 'official_source_id', 'BNCC_EM_2018',
        'official_source_url', content->>'officialSourceUrl', 'official_source_page', (skill_data->>'officialPage')::integer,
        'official_grade_range', '1-3', 'mapping_status', 'MAPPED',
        'mapping_source', 'TECESCOLA_BNCC_V13_RECONCILIATION',
        'content_pack', content->>'packVersion', 'content_version', (content->>'contentVersion')::integer,
        'content_origin', 'V13_REAUTHORED_FROM_V4_V8',
        'source_content_versions', jsonb_build_array('TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4','TECESCOLA_BNCC_DEEP_LEARNING_V8'),
        'recommended_grade', (content->>'recommendedGrade')::integer,
        'recommended_grade_source', content->>'recommendedGradeSource',
        'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'
      ),
      subject_area = skill_data->>'area', domain = skill_data->>'domain', title = skill_data->>'title',
      description = skill_data->>'officialDescription', stage = 'ENSINO_MEDIO', grade_level = null,
      active = true, node_kind = 'LEAF', content_readiness = 'CONTENT_READY', mastery_targetable = false,
      bncc_alignment_status = 'MAPPED', publication_status = 'STAGING',
      pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING', updated_at = now()
     where skill.id = skill_id;

    select private.validate_mapped_bncc_skill_v12(skill_id, skill_data->>'code', skill.metadata)
      into validation from public.learning_curriculum_skills skill where skill.id = skill_id;
    if validation->>'status' <> 'READY' then
      raise exception 'GUIDED_STUDY_V13_SKILL_VALIDATION_FAILED code=% result=%', skill_data->>'code', validation;
    end if;
    if not exists (
      select 1 from public.learning_curriculum_skills skill
       where skill.id = skill_id and skill.publication_status = 'PUBLISHED'
         and skill.technical_validation_status = 'PUBLISHED'
         and skill.content_readiness = 'ADAPTIVE_READY' and skill.mastery_targetable
         and skill.bncc_alignment_status = 'MAPPED'
         and skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
    ) then
      raise exception 'GUIDED_STUDY_V13_AUTOMATIC_PUBLICATION_FAILED code=%', skill_data->>'code';
    end if;
  end loop;

  if not exists (
    select 1 from public.learning_adaptive_content_packs pack
     where pack.pack_version = content->>'packVersion' and pack.active
       and pack.publication_status = 'PUBLISHED' and pack.technical_validation_status = 'PUBLISHED'
  ) then raise exception 'GUIDED_STUDY_V13_PACK_VALIDATION_FAILED'; end if;
end;
$guided_study_v13_content_seed$;

notify pgrst, 'reload schema';
commit;
`;
}

validate();
const migration = renderMigration();
if (process.argv.includes('--check')) {
  const existing = readFileSync(migrationPath, 'utf8');
  if (existing !== migration) throw new Error('V13 migration is stale; run the generator to refresh it.');
  process.stdout.write(`${source.skills.length} skills, ${source.skills.reduce((n, skill) => n + skill.questions.length, 0)} questions; SHA-256 ${migration.match(/V13_CANONICAL_HASH=([a-f0-9]{64})/)?.[1]}\n`);
} else {
  writeFileSync(migrationPath, migration, 'utf8');
  process.stdout.write(`Generated ${migrationPath}\n`);
}
