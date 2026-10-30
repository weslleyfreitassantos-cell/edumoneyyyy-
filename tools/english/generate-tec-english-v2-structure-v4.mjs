import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { course } from '../../content/english/tec-english-everyday-v2-v4.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const sourceV3Path = path.join(root, 'content/english/tec-english-everyday-v2.mjs');
const migrationPath = path.join(root, 'supabase/migrations/20261030000100_tec_idiomas_v63_ui_reset_activity.sql');
const startMarker = '-- BEGIN GENERATED TEC ENGLISH V2 V4 SNAPSHOT UPDATE';
const endMarker = '-- END GENERATED TEC ENGLISH V2 V4 SNAPSHOT UPDATE';

function fail(message) { throw new Error(`Tec Inglês V2 V4: ${message}`); }
function sqlText(value) { return value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`; }
function sqlJson(value) { return `${sqlText(JSON.stringify(value))}::jsonb`; }

function validateContent(value) {
  if (value.course?.code !== 'TEC_ENGLISH_FOUNDATIONS_V2' || value.course.version !== 4) fail('invalid course identity/version');
  if (value.course.publicationStatus !== 'STAGING' || value.course.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') fail('course must remain STAGING and pending human review');
  if (value.units?.length !== 2 || value.units.some((unit) => unit.lessons?.length !== 4)) fail('expected 2 units with 4 lessons each');
  const lessons = value.units.flatMap((unit) => unit.lessons);
  if (lessons.length !== 8 || lessons.some((lesson) => lesson.exercises?.length !== 7)) fail('expected 8 lessons with 7 exercises each');
  const allowedTypes = new Set(['MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING']);
  const replacedLessons = [];
  for (const lesson of lessons) {
    const types = lesson.exercises.map((item) => item.type);
    if (types.some((type) => !allowedTypes.has(type))) fail(`${lesson.id} has an unsupported exercise type`);
    if (new Set(types).size !== 7) fail(`${lesson.id} must represent all seven exercise types exactly once`);
    const original = lesson.exercises[1];
    if (!original?.skillCode || !original.prompt?.trim() || !original.explanation?.trim()) fail(`${lesson.id} replacement is incomplete`);
    replacedLessons.push(lesson.id);
  }
  if (new Set(replacedLessons).size !== 8) fail('expected eight distinct lesson replacements');
  return lessons;
}

function snapshotV3(source) {
  return {
    course: {
      course_code: source.course.code,
      content_version: source.course.version,
      title: source.course.title,
      description: source.course.description,
      author: source.course.author,
      xp_per_lesson: source.course.xpReward,
    },
    units: source.units.map((unit) => ({
      id: unit.id,
      position: unit.order,
      title: unit.title,
      description: unit.description,
      content_version: source.course.version,
      author: source.course.author,
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        position: lesson.order,
        title: lesson.title,
        introduction: `${lesson.introduction}\n\nObjetivo: ${lesson.objective}`,
        xp_reward: source.course.xpReward,
        content_version: source.course.version,
        author: source.course.author,
        exercises: lesson.exercises.map((item, index) => ({
          id: `${lesson.id}-e${index + 1}`,
          position: index + 1,
          type: item.type,
          instruction: item.instruction,
          prompt: item.prompt,
          options: item.options ?? [],
          word_bank: item.wordBank ?? [],
          left_items: item.leftItems ?? [],
          right_items: item.rightItems ?? [],
          audio_text: item.audioText ?? null,
          accepted_answers: item.accepted ?? [],
          answer_key: item.answerKey ?? { accepted: item.accepted ?? [] },
          explanation: item.explanation,
          content_version: source.course.version,
          author: source.course.author,
          skill_code: item.skillCode,
          difficulty_level: item.difficulty,
          dialogue_speaker: item.dialogueSpeaker ?? null,
          dialogue_context: item.dialogueContext ?? [],
        })),
      })),
    })),
  };
}

function updateExerciseSql(lesson, index) {
  const item = lesson.exercises[index];
  const columns = [
    ['exercise_type', sqlText(item.type)], ['instruction', sqlText(item.instruction)], ['prompt', sqlText(item.prompt)],
    ['options', sqlJson(item.options ?? [])], ['word_bank', sqlJson(item.wordBank ?? [])],
    ['left_items', sqlJson(item.leftItems ?? [])], ['right_items', sqlJson(item.rightItems ?? [])],
    ['audio_text', sqlText(item.audioText ?? null)], ['accepted_answers', sqlJson(item.accepted ?? [])],
    ['answer_key', sqlJson(item.answerKey ?? { accepted: item.accepted ?? [] })], ['explanation', sqlText(item.explanation)],
    ['skill_code', sqlText(item.skillCode)], ['difficulty_level', item.difficulty],
    ['dialogue_speaker', sqlText(item.dialogueSpeaker ?? null)], ['dialogue_context', sqlJson(item.dialogueContext ?? [])],
  ];
  return `  update public.tec_english_exercises
     set ${columns.map(([column, value]) => `${column} = ${value}`).join(',\n         ')},
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = ${sqlText(`${lesson.id}-e${index + 1}`)}
     and lesson_id = ${sqlText(lesson.id)}
     and position = ${index + 1}
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:${lesson.id}'; end if;`;
}

const lessonsV4 = validateContent(course);
const sourceV3 = await import(pathToFileURL(sourceV3Path).href).then((module) => module.course);
const lines = [
  startMarker,
  'do $tec_english_v2_v4_content$',
  'declare',
  '  v_changed integer;',
  'begin',
  `  if private.tec_english_course_snapshot('TEC_ENGLISH_FOUNDATIONS_V2', 3) is distinct from ${sqlJson(snapshotV3(sourceV3))} then`,
  "    raise exception 'TEC_IDIOMAS_V63_V2_SOURCE_DRIFT';",
  '  end if;',
  ...lessonsV4.map((lesson) => updateExerciseSql(lesson, 1)),
  '  update public.tec_english_courses set content_version = 4, publication_status = \'STAGING\', review_status = \'PEDAGOGICAL_REVIEW_PENDING\', updated_at = now() where course_code = \'TEC_ENGLISH_FOUNDATIONS_V2\' and content_version = 3;',
  "  get diagnostics v_changed = row_count; if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_V2_COURSE_UPDATE_COUNT'; end if;",
  '  update public.tec_english_units set content_version = 4, publication_status = \'STAGING\', review_status = \'PEDAGOGICAL_REVIEW_PENDING\' where course_code = \'TEC_ENGLISH_FOUNDATIONS_V2\' and content_version = 3;',
  "  get diagnostics v_changed = row_count; if v_changed <> 2 then raise exception 'TEC_IDIOMAS_V63_V2_UNIT_UPDATE_COUNT'; end if;",
  "  update public.tec_english_lessons lesson set content_version = 4, publication_status = 'STAGING', review_status = 'PEDAGOGICAL_REVIEW_PENDING' from public.tec_english_units unit where unit.id = lesson.unit_id and unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and lesson.content_version = 3;",
  "  get diagnostics v_changed = row_count; if v_changed <> 8 then raise exception 'TEC_IDIOMAS_V63_V2_LESSON_UPDATE_COUNT'; end if;",
  "  update public.tec_english_exercises exercise set content_version = 4, publication_status = 'STAGING', review_status = 'PEDAGOGICAL_REVIEW_PENDING' from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where lesson.id = exercise.lesson_id and unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and exercise.content_version = 3;",
  "  get diagnostics v_changed = row_count; if v_changed <> 48 then raise exception 'TEC_IDIOMAS_V63_V2_REMAINING_EXERCISE_UPDATE_COUNT'; end if;",
  "  if exists (select 1 from public.tec_english_courses where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) or exists (select 1 from public.tec_english_units where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) or exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (lesson.publication_status <> 'STAGING' or lesson.review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) or exists (select 1 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (exercise.publication_status <> 'STAGING' or exercise.review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) then raise exception 'TEC_IDIOMAS_V63_V2_REVIEW_STATE_INVALID'; end if;",
  "  if not private.tec_english_course_structure_valid_v2('TEC_ENGLISH_FOUNDATIONS_V2', 4) then raise exception 'TEC_IDIOMAS_V63_V2_STRUCTURE_INVALID'; end if;",
  "  if (select publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING' from public.tec_english_courses where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2') then raise exception 'TEC_IDIOMAS_V63_V2_REVIEW_STATE_INVALID'; end if;",
  'end $tec_english_v2_v4_content$;',
  endMarker,
];
const generated = lines.join('\n');
const migration = await readFile(migrationPath, 'utf8');
const start = migration.indexOf(startMarker);
const end = migration.indexOf(endMarker);
if (start < 0 || end < start) fail('migration is missing generated content markers');
const output = `${migration.slice(0, start)}${generated}${migration.slice(end + endMarker.length)}`;

if (process.argv.includes('--check')) {
  if (migration !== output) fail('generated migration is out of date; run npm run tec-english:v2:v4:generate');
  const changed = lessonsV4.filter((lesson, index) => lesson.exercises[1].type !== sourceV3.units.flatMap((unit) => unit.lessons)[index].exercises[1].type);
  console.log(`Valid: ${lessonsV4.length} lessons, ${lessonsV4.length * 7} exercises, ${changed.length} typed replacements; content remains STAGING.`);
} else {
  await writeFile(migrationPath, output, 'utf8');
  console.log(`Generated ${path.relative(root, migrationPath)} with ${lessonsV4.length} versioned lesson replacements.`);
}
