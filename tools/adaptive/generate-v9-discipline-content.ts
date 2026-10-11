import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadV4Pack, validateV4Pack } from './compile-v4.ts';

const TARGET_SKILLS = new Set([
  'ART_COMPARE_COMPOSITIONS',
  'BIOLOGY_CELL_FUNCTION',
  'CHEMISTRY_STOICHIOMETRY',
  'PE_ANALYZE_MOVEMENT',
]);
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'] as const;

function sql(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value: unknown): string {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function sqlArray(values: readonly string[]): string {
  return `array[${values.map(sql).join(', ')}]::text[]`;
}

export function buildV9DisciplineContentMigration(): string {
  const pack = loadV4Pack();
  const validation = validateV4Pack(pack);
  if (!validation.valid) throw new Error(`V4_CONTENT_INVALID\n${validation.errors.join('\n')}`);

  const leaves = pack.leaves.filter((leaf) => TARGET_SKILLS.has(leaf.code));
  if (leaves.length !== TARGET_SKILLS.size) {
    throw new Error(`V9_DISCIPLINE_SKILL_COUNT:${leaves.length}`);
  }

  const lines = [
    'begin;',
    '-- Generated from the validated V4 source package; only four missing discipline skills are imported.',
    `-- V4_CONTENT_HASH=${validation.canonicalHash}`,
    'do $v9_content$ declare v_catalog_id uuid; v_skill_id uuid; v_parent_id uuid; v_question_id uuid; v_set_id uuid; begin',
    "  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' and active limit 1;",
    "  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;",
  ];

  for (const leaf of leaves) {
    const subject = pack.registry.subjects.find((item) => item.code === leaf.subject);
    const canonicalCode = ({
      ART: 'ART',
      BIOLOGY: 'BIOLOGY',
      CHEMISTRY: 'CHEMISTRY',
      PHYSICAL_EDUCATION: 'PHYSICAL_EDUCATION',
    } as Record<string, string>)[leaf.subject];
    const parent = pack.anchors.find((anchor) => anchor.code === leaf.parent);
    const lesson = pack.lessons.find((item) => item.skill === leaf.code);
    const questions = pack.questions.filter((question) => question.primarySkill === leaf.code);
    if (!subject || !parent || !lesson || questions.length < 8) {
      throw new Error(`V9_DISCIPLINE_CONTENT_INCOMPLETE:${leaf.code}`);
    }

    lines.push(`  insert into public.learning_curriculum_skills(catalog_id,code,stage,grade_level,subject_area,domain,title,description,active,node_kind,content_readiness,mastery_targetable,pedagogical_review_status,bncc_alignment_status,canonical_subject_id,metadata)
    select v_catalog_id,${sql(parent.code)},${sql(leaf.recommendedStage)},${leaf.recommendedGradeFrom},${sql(leaf.subject)},'V4_ANCHOR',${sql(parent.title)},${sql(`Anchor pedagogico de ${parent.title}.`)},true,'ANCHOR','GRAPH_ONLY',false,'TECH_VALIDATED','CANDIDATE',canonical_subject.id,${jsonSql({ content_pack: 'tec-escola-core-v4', stage_references: pack.stageReferences[subject.code] })}
      from public.learning_canonical_subjects canonical_subject where canonical_subject.code=${sql(canonicalCode)} and canonical_subject.active
    on conflict (catalog_id,code) do nothing;`);
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id,code,stage,grade_level,subject_area,domain,title,description,active,node_kind,content_readiness,mastery_targetable,pedagogical_review_status,bncc_alignment_status,canonical_subject_id,metadata)
    select v_catalog_id,${sql(leaf.code)},${sql(leaf.recommendedStage)},${leaf.recommendedGradeFrom},${sql(leaf.subject)},${sql(leaf.domain)},${sql(leaf.title)},${sql(leaf.description)},true,'LEAF','ADAPTIVE_READY',true,'PEDAGOGICAL_REVIEW_PENDING','CANDIDATE',canonical_subject.id,${jsonSql({ content_pack: 'tec-escola-core-v4', objective: leaf.objective, mastery_capability: leaf.masteryCapability, content_authoring_status: leaf.content_authoring_status, recommended_stage: leaf.recommendedStage, recommended_grade_from: leaf.recommendedGradeFrom, recommended_grade_to: leaf.recommendedGradeTo, stage_references: pack.stageReferences[subject.code] })}
      from public.learning_canonical_subjects canonical_subject where canonical_subject.code=${sql(canonicalCode)} and canonical_subject.active
    on conflict (catalog_id,code) do update set stage=excluded.stage,grade_level=excluded.grade_level,subject_area=excluded.subject_area,domain=excluded.domain,title=excluded.title,description=excluded.description,active=true,node_kind='LEAF',content_readiness='ADAPTIVE_READY',mastery_targetable=true,pedagogical_review_status='PEDAGOGICAL_REVIEW_PENDING',bncc_alignment_status='CANDIDATE',canonical_subject_id=excluded.canonical_subject_id,metadata=excluded.metadata,updated_at=now()
    returning id into v_skill_id;`);
    lines.push(`  if v_skill_id is null then select id into v_skill_id from public.learning_curriculum_skills where catalog_id=v_catalog_id and code=${sql(leaf.code)}; end if;`);
    lines.push(`  select id into v_parent_id from public.learning_curriculum_skills where catalog_id=v_catalog_id and code=${sql(parent.code)};`);
    lines.push('  if v_parent_id is null then raise exception ' + sql(`V9_DISCIPLINE_PARENT_MISSING:${leaf.code}`) + '; end if;');
    lines.push('  insert into public.learning_skill_hierarchy(parent_skill_id,child_skill_id) values (v_parent_id,v_skill_id) on conflict do nothing;');

    lines.push(`  insert into public.learning_skill_lessons(canonical_skill_id,version,title,summary,content_markdown,worked_example,tips,estimated_minutes,metadata)
    values (v_skill_id,4,${sql(lesson.title)},${sql(lesson.summary)},${sql(`${lesson.explanation}\n\nErro comum: ${lesson.commonMistake}`)},${sql(lesson.workedExample)},${sqlArray(lesson.tips)},${lesson.estimatedMinutes},${jsonSql({ content_pack: 'tec-escola-core-v4', objective: lesson.objective, content_authoring_status: lesson.content_authoring_status, pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING' })})
    on conflict (canonical_skill_id,version) do update set title=excluded.title,summary=excluded.summary,content_markdown=excluded.content_markdown,worked_example=excluded.worked_example,tips=excluded.tips,estimated_minutes=excluded.estimated_minutes,metadata=excluded.metadata,active=true,updated_at=now();`);

    for (const purpose of PURPOSES) {
      const count = questions.filter((question) => question.purpose === purpose).length;
      if (count < 1 || (purpose === 'PROBE' && count < 2)) {
        throw new Error(`V9_DISCIPLINE_PURPOSE_COVERAGE:${leaf.code}:${purpose}:${count}`);
      }
      lines.push(`  insert into public.learning_question_sets(scope,canonical_skill_id,purpose,version,metadata) values ('GLOBAL',v_skill_id,${sql(purpose)},4,jsonb_build_object('content_pack','tec-escola-core-v4','selection_policy','SERVER_SELECTED_V1')) on conflict (canonical_skill_id,purpose,version) where scope='GLOBAL' do update set active=true,metadata=excluded.metadata returning id into v_set_id;`);
      lines.push(`  if v_set_id is null then select id into v_set_id from public.learning_question_sets where scope='GLOBAL' and canonical_skill_id=v_skill_id and purpose=${sql(purpose)} and version=4; end if;`);
    }

    for (const question of questions) {
      const misconceptionEntries = Object.entries(question.misconceptions);
      const topicOwner = pack.topicOwnership.ownership.find((item) => item.subject === question.subject && item.topic === question.topic);
      lines.push(`  insert into public.learning_question_bank(package_type,source_type,source_name,subject_area,domain,topic,statement,options,correct_answer,explanation,difficulty,estimated_minutes,provenance,metadata,active)
    select 'TECESCOLA','TECESCOLA_CORE_V4','TecEscola Core V4',${sql(question.subject)},${sql(question.domain)},${sql(question.topic)},${sql(question.statement)},${jsonSql(question.options)},${jsonSql(question.correctAnswer)},${sql(question.explanation)},${sql(question.difficulty)},4,${sql(question.provenance)},${jsonSql({ content_id: question.id, purpose: question.purpose, context_family: question.contextFamily, cognitive_process: question.cognitiveProcess, misconceptions: question.misconceptions, primary_skill: question.primarySkill, supporting_skills: question.supportingSkills, prerequisite_skills: question.prerequisiteSkills, transfer_skills: question.transferSkills, semantic_topic_owner: topicOwner?.primarySkill ?? null, content_authoring_status: question.content_authoring_status, pack_version: 'tec-escola-core-v4', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING' })},true
    where not exists (select 1 from public.learning_question_bank existing where existing.source_type='TECESCOLA_CORE_V4' and existing.metadata->>'content_id'=${sql(question.id)}) returning id into v_question_id;`);
      lines.push(`  if v_question_id is null then select id into v_question_id from public.learning_question_bank where source_type='TECESCOLA_CORE_V4' and metadata->>'content_id'=${sql(question.id)}; end if;`);
      lines.push(`  update public.learning_question_bank set metadata=coalesce(metadata,'{}'::jsonb)||${jsonSql({ primary_skill: question.primarySkill, supporting_skills: question.supportingSkills, prerequisite_skills: question.prerequisiteSkills, transfer_skills: question.transferSkills, semantic_topic_owner: topicOwner?.primarySkill ?? null })} where id=v_question_id;`);
      lines.push("  insert into public.learning_question_bank_skill_links(question_bank_id,canonical_skill_id,skill_role) values (v_question_id,v_skill_id,'PRIMARY') on conflict (question_bank_id,canonical_skill_id) do nothing;");
      for (const supportingCode of question.supportingSkills) {
        lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id,canonical_skill_id,skill_role) select v_question_id,skill.id,'SUPPORTING' from public.learning_curriculum_skills skill where skill.catalog_id=v_catalog_id and skill.code=${sql(supportingCode)} on conflict (question_bank_id,canonical_skill_id) do nothing;`);
      }
      for (const prerequisiteCode of question.prerequisiteSkills) {
        lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id,canonical_skill_id,skill_role) select v_question_id,skill.id,'PREREQUISITE' from public.learning_curriculum_skills skill where skill.catalog_id=v_catalog_id and skill.code=${sql(prerequisiteCode)} on conflict (question_bank_id,canonical_skill_id) do nothing;`);
      }
      for (const transferCode of question.transferSkills) {
        lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id,canonical_skill_id,skill_role) select v_question_id,skill.id,'TRANSFER' from public.learning_curriculum_skills skill where skill.catalog_id=v_catalog_id and skill.code=${sql(transferCode)} on conflict (question_bank_id,canonical_skill_id) do nothing;`);
      }
      for (const [option, tags] of misconceptionEntries) {
        for (const tag of tags) {
          const detail = pack.misconceptionDetails[tag];
          lines.push(`  insert into public.learning_misconception_tags(code,title,description) values (${sql(tag)},${sql(detail.title)},${sql(detail.description)}) on conflict (code) do update set title=excluded.title,description=excluded.description,active=true;`);
          lines.push(`  insert into public.learning_question_option_misconceptions(question_bank_id,option_value,misconception_tag_id,canonical_skill_id,confidence_weight,metadata) select v_question_id,${sql(option)},tag.id,v_skill_id,0.8,jsonb_build_object('content_pack','tec-escola-core-v4') from public.learning_misconception_tags tag where tag.code=${sql(tag)} on conflict do nothing;`);
        }
      }
      lines.push(`  select id into v_set_id from public.learning_question_sets where scope='GLOBAL' and canonical_skill_id=v_skill_id and purpose=${sql(question.purpose)} and version=4;`);
      lines.push('  insert into public.learning_question_set_items(question_set_id,question_bank_id,position) values (v_set_id,v_question_id,(select coalesce(max(position),-1)+1 from public.learning_question_set_items where question_set_id=v_set_id)) on conflict do nothing;');
    }
  }

  lines.push('end $v9_content$;', 'commit;');
  return `${lines.join('\n')}\n`;
}

const isMainModule = process.argv[1] && resolve(process.argv[1]).endsWith('generate-v9-discipline-content.ts');
if (isMainModule) {
  const outputPath = resolve(process.argv[2] ?? 'supabase/migrations/20261011000050_bncc_v4_missing_discipline_content_v9.sql');
  writeFileSync(outputPath, buildV9DisciplineContentMigration());
  console.log(JSON.stringify({ outputPath, skillCount: TARGET_SKILLS.size, sourcePack: 'tec-escola-core-v4' }));
}
