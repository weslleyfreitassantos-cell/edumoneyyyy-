import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packDir = path.join(root, 'content', 'adaptive', 'tec-escola-core-v2');
const migrationPath = path.join(root, 'supabase', 'migrations', '20260930001000_adaptive_learning_guided_journey_v2.sql');
const packs = ['mathematics.json', 'portuguese.json'].map((file) => JSON.parse(fs.readFileSync(path.join(packDir, file), 'utf8')));
const questions = packs.flatMap((pack) => pack.skills.flatMap((skill) => skill.questions.map((question) => ({ ...question, skillCode: skill.code, subjectArea: pack.subjectArea }))));
const lessons = packs.flatMap((pack) => pack.skills.map((skill) => ({ ...skill.lesson, skillCode: skill.code })));
const prerequisites = packs.flatMap((pack) => pack.skills.flatMap((skill) => (skill.prerequisites || []).map((prerequisiteCode) => ({ skillCode: skill.code, prerequisiteCode }))));
const sql = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value) => sql(JSON.stringify(value)) + '::jsonb';
const textArray = (values) => 'array[' + values.map(sql).join(', ') + ']::text[]';
const uniqueCodes = [...new Set(questions.map((question) => question.skillCode))];

const lines = [
  '-- GENERATED FROM content/adaptive/tec-escola-core-v2/*.json.',
  'do $seed$',
  'declare',
  '  item record;',
  '  skill_row record;',
  '  purpose_row record;',
  '  question_row record;',
  '  skill_id uuid;',
  '  question_id uuid;',
  '  prerequisite_id uuid;',
  '  set_id uuid;',
  '  position_index integer;',
  'begin',
  '  for item in select * from (values',
  ...lessons.map((lesson, index) => '    (' + [sql(lesson.skillCode), sql(lesson.title), sql(lesson.summary), sql(lesson.contentMarkdown), sql(lesson.workedExample || ''), textArray(lesson.tips || []), lesson.estimatedMinutes || 8].join(', ') + ')' + (index < lessons.length - 1 ? ',' : '')),
  '  ) as lesson_row(skill_code, title, summary, content_markdown, worked_example, tips, estimated_minutes)',
  '  loop',
  '    select canonical.id into skill_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id',
  "     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.skill_code and canonical.active limit 1;",
  "    if skill_id is null then raise exception 'TECESCOLA_V2_SKILL_MISSING:%', item.skill_code; end if;",
  '    insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata)',
  "    values (skill_id, 2, item.title, item.summary, item.content_markdown, item.worked_example, item.tips, item.estimated_minutes, jsonb_build_object('content_pack', 'tec-escola-core-v2', 'engine_version', 'V2'))",
  '    on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes, metadata = excluded.metadata, active = true, updated_at = now();',
  '  end loop;',
  '',
  '  for item in select * from (values',
  ...questions.map((question, index) => '    (' + [sql(question.skillCode), sql(question.subjectArea), sql(question.purpose), sql(question.statement), json(question.options), json(question.correctAnswer), sql(question.explanation), sql(question.provenance), json({ adaptive_v2_purpose: question.purpose, content_pack: 'tec-escola-core-v2', content_question_id: question.id || null, misconception_code: question.misconceptionCode || null })].join(', ') + ')' + (index < questions.length - 1 ? ',' : '')),
  '  ) as question_row(skill_code, subject_area, purpose, statement, options, correct_answer, explanation, provenance, metadata)',
  '  loop',
  '    select canonical.id into skill_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id',
  "     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.skill_code and canonical.active limit 1;",
  "    select question.id into question_id from public.learning_question_bank question where question.source_type = 'TECESCOLA_CORE_V2' and question.statement = item.statement limit 1;",
  '    if question_id is null then',
  "      insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, metadata, active)",
  "      values ('TECESCOLA', 'TECESCOLA_CORE_V2', 'TecEscola Core V2', item.subject_area, item.subject_area, item.skill_code, item.statement, item.options, item.correct_answer, item.explanation, 'MEDIUM', 3, item.provenance, item.metadata, true) returning id into question_id;",
  '    else',
  '      update public.learning_question_bank set options = item.options, correct_answer = item.correct_answer, explanation = item.explanation, provenance = item.provenance, metadata = item.metadata, active = true, updated_at = now() where id = question_id;',
  '    end if;',
  "    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) values (question_id, skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;",
  '  end loop;',
  '',
  '  for item in select * from (values',
  ...prerequisites.map((item, index) => '    (' + [sql(item.skillCode), sql(item.prerequisiteCode)].join(', ') + ')' + (index < prerequisites.length - 1 ? ',' : '')),
  '  ) as prerequisite_row(skill_code, prerequisite_code)',
  '  loop',
  '    select canonical.id into skill_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id',
  "     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.skill_code and canonical.active limit 1;",
  '    select canonical.id into prerequisite_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id',
  "     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.prerequisite_code and canonical.active limit 1;",
  "    if skill_id is null or prerequisite_id is null then raise exception 'TECESCOLA_V2_PREREQUISITE_MISSING:%:%', item.skill_code, item.prerequisite_code; end if;",
  '    insert into public.learning_skill_prerequisites(skill_id, prerequisite_skill_id) values (skill_id, prerequisite_id) on conflict do nothing;',
  '  end loop;',
  '',
  '  for skill_row in select distinct canonical.id, canonical.code from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id where catalog.code = \'TECESCOLA_CORE\' and catalog.version = \'1.0\' and canonical.code in (' + uniqueCodes.map(sql).join(', ') + ')',
  '  loop',
  "    for purpose_row in select purpose from (values ('PROBE'), ('PRACTICE'), ('TRANSFER'), ('LOCK_IN'), ('REVIEW')) as purposes(purpose)",
  '    loop',
  "      select question_set.id into set_id from public.learning_question_sets question_set where question_set.scope = 'GLOBAL' and question_set.canonical_skill_id = skill_row.id and question_set.purpose = purpose_row.purpose and question_set.version = 2 limit 1;",
  '      if set_id is null then',
  "        insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, metadata) values ('GLOBAL', skill_row.id, purpose_row.purpose, 2, jsonb_build_object('content_pack', 'tec-escola-core-v2')) returning id into set_id;",
  '      end if;',
  '      delete from public.learning_question_set_items where question_set_id = set_id;',
  '      position_index := 0;',
  "      for question_row in select question.id from public.learning_question_bank question join public.learning_question_bank_skill_links link on link.question_bank_id = question.id where link.canonical_skill_id = skill_row.id and question.source_type = 'TECESCOLA_CORE_V2' and question.metadata->>'adaptive_v2_purpose' = purpose_row.purpose and question.active order by question.metadata->>'content_question_id', question.id",
  '      loop',
  '        insert into public.learning_question_set_items(question_set_id, question_bank_id, position) values (set_id, question_row.id, position_index);',
  '        position_index := position_index + 1;',
  '      end loop;',
  "      if position_index = 0 then raise exception 'TECESCOLA_V2_PURPOSE_SET_EMPTY:%:%', skill_row.code, purpose_row.purpose; end if;",
  '    end loop;',
  '  end loop;',
  'end;',
  '$seed$;',
];
const block = lines.join('\n') + '\n';

if (process.argv.includes('--write-migration')) {
  let migration = fs.readFileSync(migrationPath, 'utf8');
  let generatedStart = migration.indexOf('-- GENERATED FROM content/adaptive/tec-escola-core-v2/*.json.');
  while (generatedStart >= 0) {
    const generatedEnd = migration.indexOf('$seed$;', generatedStart);
    if (generatedEnd < 0) break;
    migration = migration.slice(0, generatedStart) + migration.slice(generatedEnd + '$seed$;'.length);
    generatedStart = migration.indexOf('-- GENERATED FROM content/adaptive/tec-escola-core-v2/*.json.');
  }
  const marker = migration.indexOf('-- Purpose-qualified V2 sets are generated');
  const policyMarker = migration.indexOf('alter table public.learning_question_sets enable row level security;');
  const insertAt = marker >= 0 ? marker : policyMarker;
  const next = insertAt >= 0
    ? migration.slice(0, insertAt) + block + migration.slice(insertAt)
    : migration + '\n' + block;
  fs.writeFileSync(migrationPath, next);
} else {
  process.stdout.write(block);
}
