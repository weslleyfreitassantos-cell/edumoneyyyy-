import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const sourcePath = path.join(root, 'content/english/tec-english-everyday-v2.mjs');
const migrationPath = path.join(root, 'supabase/migrations/20261026000300_tec_english_adaptive_v2.sql');
const startMarker = '-- BEGIN GENERATED TEC ENGLISH V2 CONTENT';
const endMarker = '-- END GENERATED TEC ENGLISH V2 CONTENT';

function fail(message) {
  throw new Error(`Tec Inglês V2: ${message}`);
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function validate(course) {
  if (course.course?.code !== 'TEC_ENGLISH_FOUNDATIONS_V2' || course.course.version !== 2) fail('invalid course identity/version');
  if (course.course.publicationStatus !== 'STAGING' || course.course.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') fail('V2 content must remain staged and pending human review');
  if (course.units?.length !== 2 || course.units.some((unit) => unit.lessons?.length !== 4)) fail('expected 2 units with 4 lessons each');
  const lessons = course.units.flatMap((unit) => unit.lessons);
  if (lessons.length !== 8 || lessons.some((lesson) => lesson.exercises?.length !== 7)) fail('expected 8 lessons with 7 exercises each');
  const ids = [course.course.code, ...course.units.flatMap((unit) => [unit.id, ...unit.lessons.map((lesson) => lesson.id)])];
  if (new Set(ids).size !== ids.length) fail('duplicate course/unit/lesson IDs');
  const exerciseIds = new Set();
  const skillCodes = new Set();
  for (const lesson of lessons) {
    if (!lesson.title?.trim() || !lesson.description?.trim() || !lesson.introduction?.trim()) fail(`${lesson.id} has incomplete learner-facing text`);
    for (const [index, exercise] of lesson.exercises.entries()) {
      if (!/^[a-z][a-z0-9_]{2,63}$/.test(exercise.skillCode ?? '')) fail(`${lesson.id} exercise ${index + 1} has invalid skillCode`);
      skillCodes.add(exercise.skillCode);
      if (!['MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING'].includes(exercise.type)) fail(`${lesson.id} exercise ${index + 1} has unsupported type`);
      if (!exercise.prompt?.trim() || !exercise.instruction?.trim() || !exercise.explanation?.trim()) fail(`${lesson.id} exercise ${index + 1} has incomplete feedback`);
      if (!Number.isInteger(exercise.difficulty) || exercise.difficulty < 1 || exercise.difficulty > 5) fail(`${lesson.id} exercise ${index + 1} has invalid difficulty`);
      if (exercise.type === 'MATCHING') {
        if (Object.keys(exercise.answerKey?.pairs ?? {}).length < 2 || !exercise.leftItems || !exercise.rightItems) fail(`${lesson.id} exercise ${index + 1} has invalid pairs`);
      } else if (!Array.isArray(exercise.accepted) || exercise.accepted.length === 0) fail(`${lesson.id} exercise ${index + 1} has no accepted answer`);
      if (exercise.dialogueSpeaker && !exercise.dialogueContext.every((turn) => turn.speaker && turn.text)) fail(`${lesson.id} exercise ${index + 1} has invalid dialogue context`);
      const id = `${lesson.id}-e${index + 1}`;
      if (exerciseIds.has(id)) fail(`duplicate exercise ID ${id}`);
      exerciseIds.add(id);
    }
  }
  if (skillCodes.size < 8) fail(`expected at least 8 skill codes, received ${skillCodes.size}`);
  return { lessons, skillCodes };
}

function seedSql(course) {
  const { lessons } = validate(course);
  const { author, version } = course.course;
  const lines = [
    `${startMarker}`,
    `insert into public.tec_english_courses(course_code, content_version, title, description, author, publication_status, review_status, xp_per_lesson) values (${[
      sqlText(course.course.code), version, sqlText(course.course.title), sqlText(course.course.description), sqlText(author),
      sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus), course.course.xpReward,
    ].join(', ')}) on conflict (course_code) do nothing;`,
  ];

  for (const unit of course.units) {
    lines.push(`insert into public.tec_english_units(id, course_code, position, title, description, content_version, author, publication_status, review_status) values (${[
      sqlText(unit.id), sqlText(course.course.code), unit.order, sqlText(unit.title), sqlText(unit.description), version, sqlText(author),
      sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus),
    ].join(', ')}) on conflict (id) do nothing;`);
    for (const lesson of unit.lessons) {
      lines.push(`insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values (${[
        sqlText(lesson.id), sqlText(unit.id), lesson.order, sqlText(lesson.title), sqlText(`${lesson.introduction}\n\nObjetivo: ${lesson.objective}`), course.course.xpReward,
        version, sqlText(author), sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus),
      ].join(', ')}) on conflict (id) do nothing;`);
      lesson.exercises.forEach((exercise, index) => {
        const values = [
          sqlText(`${lesson.id}-e${index + 1}`), sqlText(lesson.id), index + 1, sqlText(exercise.type), sqlText(exercise.instruction), sqlText(exercise.prompt),
          sqlJson(exercise.options ?? []), sqlJson(exercise.wordBank ?? []), sqlJson(exercise.leftItems ?? []), sqlJson(exercise.rightItems ?? []),
          exercise.audioText ? sqlText(exercise.audioText) : 'null', sqlJson(exercise.accepted ?? []), sqlJson(exercise.answerKey ?? { accepted: exercise.accepted }), sqlText(exercise.explanation),
          version, sqlText(author), sqlText(course.course.publicationStatus), sqlText(course.course.reviewStatus), sqlText(exercise.skillCode), exercise.difficulty,
          exercise.dialogueSpeaker ? sqlText(exercise.dialogueSpeaker) : 'null', sqlJson(exercise.dialogueContext ?? []),
        ];
        lines.push(`insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values (${values.join(', ')}) on conflict (id) do nothing;`);
      });
    }
  }
  lines.push(endMarker);
  return lines.join('\n\n');
}

const { course } = await import(pathToFileURL(sourcePath).href);
const generated = seedSql(course);
const migration = await readFile(migrationPath, 'utf8');
const start = migration.indexOf(startMarker);
const end = migration.indexOf(endMarker);
if (start < 0 || end < start) fail('migration is missing generated content markers');
const endAfter = end + endMarker.length;
const output = `${migration.slice(0, start)}${generated}${migration.slice(endAfter)}`;
if (process.argv.includes('--check')) {
  if (migration !== output) fail('generated migration is out of date; run npm run tec-english:v2:generate');
  const { lessons, skillCodes } = validate(course);
  console.log(`Valid: 2 units, ${lessons.length} lessons, ${lessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0)} exercises, ${skillCodes.size} skills; content remains STAGING.`);
} else {
  await writeFile(migrationPath, output, 'utf8');
  console.log(`Generated ${path.relative(root, migrationPath)} from ${course.units.length} units, ${lessonsCount(course)} lessons and ${exerciseCount(course)} exercises.`);
}

function lessonsCount(value) { return value.units.reduce((sum, unit) => sum + unit.lessons.length, 0); }
function exerciseCount(value) { return value.units.flatMap((unit) => unit.lessons).reduce((sum, lesson) => sum + lesson.exercises.length, 0); }
