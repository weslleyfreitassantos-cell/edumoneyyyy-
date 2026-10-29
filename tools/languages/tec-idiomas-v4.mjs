import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { courses as sourceCourses } from '../../content/languages/tec-idiomas-v4.mjs';
import { courses as legacySourceCourses } from '../../content/languages/tec-idiomas-v3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(root, 'supabase/migrations/20261029000100_tec_idiomas_v4_absolute_beginners.sql');
const manifestPath = path.join(root, 'content/languages/tec-idiomas-v4-manifest.json');
const author = 'Equipe de conteúdo Tec Escola';
const expected = new Map([
  ['TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', { units: 4, lessons: 16, exercises: 76, legacy: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', language: 'en' }],
  ['TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', { units: 4, lessons: 16, exercises: 76, legacy: 'TEC_SPANISH_FOUNDATIONS_V1', language: 'es' }],
  ['TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', { units: 4, lessons: 16, exercises: 72, legacy: 'TEC_KOREAN_FOUNDATIONS_V1', language: 'ko' }],
]);
const oldCourseCodes = [
  'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1',
];
const exerciseTypes = new Set(['MULTIPLE_CHOICE', 'MATCHING', 'FILL_BLANK', 'WORD_ORDER']);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function sqlString(value) { return value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`; }
function sqlJson(value) { return `${sqlString(JSON.stringify(value))}::jsonb`; }

function seededShuffle(values, seed) {
  const result = [...values];
  let state = 2166136261;
  for (const char of seed) { state ^= char.codePointAt(0); state = Math.imul(state, 16777619); }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const shuffled = [...result];
    let current = (state + attempt * 0x6d2b79f5) | 0;
    const random = () => {
      current = (current + 0x6d2b79f5) | 0;
      let value = current;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    if (shuffled.some((item, index) => item !== result[index])) return shuffled;
  }
  return result;
}

function compileActivity(activity, lessonId, locale, unitPosition, lessonPosition, activityPosition) {
  const id = `${lessonId}-e${activityPosition}`;
  const prefix = locale === 'en-US' ? 'en_v4' : locale === 'es-ES' ? 'es_v2b' : 'ko_v2b';
  const typeSlug = activity.type.toLowerCase().replaceAll('-', '_');
  const lessonSkillSlug = slug(lessonId).replace(new RegExp(`^${prefix}_`, 'u'), '');
  const common = {
    id, position: activityPosition, exercise_type: activity.type, instruction: activity.instruction,
    prompt: activity.prompt, options: [], word_bank: [], left_items: [], right_items: [], audio_text: null,
    accepted_answers: [], answer_key: {}, explanation: activity.explanation, content_version: 1,
    author, publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    skill_code: `${prefix}_${lessonSkillSlug}_${typeSlug}`, difficulty_level: Math.min(5, unitPosition + Math.floor((lessonPosition - 1) / 3)),
    dialogue_speaker: null, dialogue_context: [],
  };
  if (activity.type === 'MULTIPLE_CHOICE' || activity.type === 'FILL_BLANK') {
    return { ...common, options: activity.options, accepted_answers: activity.accepted, answer_key: { accepted: activity.accepted }, audio_text: activity.audioText ?? null };
  }
  if (activity.type === 'MATCHING') {
    const entries = Object.entries(activity.pairs);
    return { ...common, left_items: entries.map(([item]) => item), right_items: seededShuffle(entries.map(([, meaning]) => meaning), `${id}:matching`).filter((value) => typeof value === 'string'), answer_key: { pairs: activity.pairs } };
  }
  if (activity.type === 'WORD_ORDER') {
    const tokens = activity.answer.trim().split(/\s+/u);
    return { ...common, word_bank: seededShuffle(tokens, `${id}:word-bank`), accepted_answers: [activity.answer], answer_key: { accepted: [activity.answer] } };
  }
  throw new Error(`${id}: exercise type not supported: ${activity.type}`);
}

export function compileCourses() {
  return sourceCourses.map((source) => {
    const course = {
      code: source.code, content_version: 1, language_code: source.locale, title: source.title,
      description: source.description, author, publication_status: 'STAGING',
      review_status: 'PEDAGOGICAL_REVIEW_PENDING', xp_per_lesson: 30, is_test_fixture: false,
    };
    const units = source.units.map((sourceUnit, unitIndex) => ({
      id: sourceUnit.id, course_code: course.code, position: unitIndex + 1, title: sourceUnit.title,
      description: sourceUnit.description, content_version: 1, author,
      publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      lessons: sourceUnit.lessons.map((sourceLesson, lessonIndex) => {
        const lessonPosition = lessonIndex + 1;
      const vocabulary = sourceLesson.vocabulary.map((entry) => (
        source.locale === 'ko-KR' && unitIndex >= 2
          ? `${entry[0]} — ${entry.at(-1)}`
          : entry.join(' — ')
      )).join('\n');
        const lesson = {
          id: sourceLesson.id, unit_id: sourceUnit.id, position: lessonPosition, title: sourceLesson.title,
          introduction: `Objetivo: ${sourceLesson.objective}\n\n${sourceLesson.introduction}\n\nVocabulário:\n${vocabulary}`,
          xp_reward: 30, content_version: 1, author, publication_status: 'STAGING',
          review_status: 'PEDAGOGICAL_REVIEW_PENDING',
        };
        return { ...lesson, exercises: sourceLesson.activities.map((activity, activityIndex) => compileActivity(
          activity, lesson.id, source.locale, unitIndex + 1, lessonPosition, activityIndex + 1,
        )) };
      }),
    }));
    const content = { course, units };
    const exerciseCount = units.flatMap((unit) => unit.lessons).reduce((sum, lesson) => sum + lesson.exercises.length, 0);
    return { ...content, manifest: { lesson_count: units.reduce((sum, unit) => sum + unit.lessons.length, 0), exercise_count: exerciseCount, content_fingerprint: sha256(stable(content)) } };
  });
}

function collectLegacyIds() {
  return new Set(legacySourceCourses.flatMap((course) => course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id))));
}

export function validateCourses(compiled = compileCourses()) {
  const errors = [];
  if (compiled.length !== expected.size) errors.push(`Expected 3 beginner courses; found ${compiled.length}.`);
  const allIds = collectLegacyIds();
  for (const item of compiled) {
    const spec = expected.get(item.course.code);
    if (!spec) { errors.push(`Unexpected beginner course ${item.course.code}.`); continue; }
    const lessons = item.units.flatMap((unit) => unit.lessons);
    const exercises = lessons.flatMap((lesson) => lesson.exercises);
    if (item.units.length !== spec.units || lessons.length !== spec.lessons || exercises.length !== spec.exercises) errors.push(`${item.course.code}: expected ${spec.units}/${spec.lessons}/${spec.exercises}, got ${item.units.length}/${lessons.length}/${exercises.length}.`);
    if (item.course.publication_status !== 'STAGING' || item.course.review_status !== 'PEDAGOGICAL_REVIEW_PENDING' || item.course.is_test_fixture) errors.push(`${item.course.code}: staged human review state is required.`);
    for (const unit of item.units) {
      if (!unit.title.trim() || !unit.description.trim() || unit.lessons.length !== 4) errors.push(`${item.course.code}/${unit.id}: expected four complete lessons.`);
      for (const lesson of unit.lessons) {
        if (allIds.has(lesson.id)) errors.push(`Lesson id collides with legacy content: ${lesson.id}.`);
        allIds.add(lesson.id);
        if (!lesson.title.trim() || !lesson.introduction.trim() || lesson.exercises.length < 4 || lesson.exercises.length > 5) errors.push(`${lesson.id}: incomplete lesson or exercise count outside 4–5.`);
        const isFirstFour = unit.position === 1;
        const isEarlyKorean = item.course.language_code === 'ko-KR' && item.units.indexOf(unit) < 2;
        if (isFirstFour && lesson.exercises.some((exercise) => ['TRANSLATION', 'SPEAKING'].includes(exercise.exercise_type))) errors.push(`${lesson.id}: first-contact lessons cannot require free text or speech.`);
        if (isEarlyKorean && lesson.exercises.some((exercise) => ['TRANSLATION', 'SPEAKING'].includes(exercise.exercise_type))) errors.push(`${lesson.id}: early Korean cannot require Korean text entry or speech.`);
        for (const exercise of lesson.exercises) {
          if (!exerciseTypes.has(exercise.exercise_type) || !exercise.instruction.trim() || !exercise.prompt.trim() || !exercise.explanation.trim()) errors.push(`${exercise.id}: unsupported or incomplete activity.`);
          if (!/^[a-z][a-z0-9_]{2,63}$/u.test(exercise.skill_code) || exercise.difficulty_level < 1 || exercise.difficulty_level > 5) errors.push(`${exercise.id}: invalid skill or difficulty.`);
          if (['MULTIPLE_CHOICE', 'FILL_BLANK'].includes(exercise.exercise_type)) {
            if (exercise.options.length < 3 || new Set(exercise.options).size !== exercise.options.length || !exercise.answer_key.accepted.length || exercise.answer_key.accepted.some((answer) => !exercise.options.includes(answer))) errors.push(`${exercise.id}: answer/options mismatch.`);
          }
          if (exercise.exercise_type === 'MATCHING') {
            const pairs = exercise.answer_key.pairs;
            if (Object.keys(pairs).length < 2 || new Set(Object.values(pairs)).size !== Object.keys(pairs).length || exercise.left_items.length !== exercise.right_items.length) errors.push(`${exercise.id}: matching pairs must be complete and unambiguous.`);
          }
          if (exercise.exercise_type === 'WORD_ORDER') {
            const answerTokens = [...exercise.answer_key.accepted[0].trim().split(/\s+/u)].sort();
            if (exercise.word_bank.length < 2 || [...exercise.word_bank].sort().join('\u0000') !== answerTokens.join('\u0000')) errors.push(`${exercise.id}: word bank does not match the answer tokens.`);
          }
          if (exercise.dialogue_context.length || Object.hasOwn(exercise, 'accepted_answers') && exercise.dialogue_context.some((turn) => JSON.stringify(turn).includes(exercise.answer_key.accepted?.[0] ?? '\u0000'))) errors.push(`${exercise.id}: pre-answer dialogue must not reveal the answer.`);
        }
      }
    }
    if (item.course.language_code === 'ko-KR') {
      for (const lesson of lessons) {
        const visibleText = `${lesson.title} ${lesson.introduction} ${lesson.exercises.map((exercise) => exercise.prompt).join(' ')}`;
        if (!/[가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(visibleText) || !/[a-z]{2,}/iu.test(lesson.introduction)) errors.push(`${lesson.id}: Korean lessons need primary Hangul and romanization support.`);
      }
    }
  }
  return errors;
}

function sqlValues(rows) {
  return rows.map((row) => `(${row.map((value) => Array.isArray(value) || (value && typeof value === 'object') ? sqlJson(value) : sqlString(value)).join(', ')})`).join(',\n');
}

function rowsFor(compiled) {
  const courses = []; const units = []; const lessons = []; const exercises = [];
  for (const item of compiled) {
    courses.push([item.course.code, item.course.content_version, item.course.title, item.course.description, author, 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 30, false]);
    for (const unit of item.units) {
      units.push([unit.id, item.course.code, unit.position, unit.title, unit.description, 1, author, 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING']);
      for (const lesson of unit.lessons) {
        lessons.push([lesson.id, unit.id, lesson.position, lesson.title, lesson.introduction, 30, 1, author, 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING']);
        for (const exercise of lesson.exercises) exercises.push([
          exercise.id, lesson.id, exercise.position, exercise.exercise_type, exercise.instruction, exercise.prompt,
          exercise.options, exercise.word_bank, exercise.left_items, exercise.right_items, exercise.audio_text,
          exercise.accepted_answers, exercise.answer_key, exercise.explanation, 1, author, 'STAGING',
          'PEDAGOGICAL_REVIEW_PENDING', exercise.skill_code, exercise.difficulty_level, exercise.dialogue_speaker, exercise.dialogue_context,
        ]);
      }
    }
  }
  return { courses, units, lessons, exercises };
}

function extractFunction(source, name, signature) {
  const marker = `create or replace function ${name.toLowerCase()}`;
  const start = source.toLowerCase().indexOf(marker);
  if (start < 0) throw new Error(`Cannot find runtime function ${name}.`);
  const revokeStart = source.toLowerCase().indexOf(`revoke all on function ${name.toLowerCase()}${signature}`, start);
  const end = source.indexOf(';', revokeStart) + 1;
  if (revokeStart < 0 || end <= 0) throw new Error(`Cannot find function grant boundary for ${name}.`);
  return source.slice(start, end);
}

function extendMetadataAllowlist(block) {
  const list = /'TEC_ENGLISH_FOUNDATIONS_V2',\s*'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',\s*'TEC_SPANISH_FOUNDATIONS_V1',\s*'TEC_KOREAN_FOUNDATIONS_V1'/u;
  const extended = "'TEC_ENGLISH_FOUNDATIONS_V2',\n                   'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',\n                   'TEC_SPANISH_FOUNDATIONS_V1',\n                   'TEC_KOREAN_FOUNDATIONS_V1',\n                   'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',\n                   'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',\n                   'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER'";
  if (!list.test(block)) throw new Error('Could not extend the metadata fingerprint allowlist.');
  return block.replace(list, extended);
}

function createRuntimeSql(baseRuntime) {
  baseRuntime = baseRuntime.replace(/\r\n/gu, '\n');
  const allowedCodes = [...oldCourseCodes, ...expected.keys()];
  const allowedRows = allowedCodes.map((code) => `    '${code}'`).join(',\n');
  const versionRows = allowedCodes.map((code) => `    ('${code}', 1)`).join(',\n');
  const eligibleCases = [
    "         when 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION' then (select count(*) = 4 from public.tec_english_units unit where unit.course_code = course.course_code) and (select count(*) = 16 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and (select count(*) = 112 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)",
    "         when 'TEC_SPANISH_FOUNDATIONS_V1' then (select count(*) = 2 from public.tec_english_units unit where unit.course_code = course.course_code) and (select count(*) = 8 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and (select count(*) = 56 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)",
    "         when 'TEC_KOREAN_FOUNDATIONS_V1' then (select count(*) = 2 from public.tec_english_units unit where unit.course_code = course.course_code) and (select count(*) = 8 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and (select count(*) = 56 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)",
    "         when 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER' then (select count(*) = 4 from public.tec_english_units unit where unit.course_code = course.course_code) and (select count(*) = 16 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and (select count(*) = 76 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and private.tec_idiomas_v4_manifest_matches(course.course_code, course.content_version)",
    "         when 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER' then (select count(*) = 4 from public.tec_english_units unit where unit.course_code = course.course_code) and (select count(*) = 16 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and (select count(*) = 76 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and private.tec_idiomas_v4_manifest_matches(course.course_code, course.content_version)",
    "         when 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER' then (select count(*) = 4 from public.tec_english_units unit where unit.course_code = course.course_code) and (select count(*) = 16 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and (select count(*) = 72 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code) and private.tec_idiomas_v4_manifest_matches(course.course_code, course.content_version)",
    '         else false',
  ].join('\n');
  const oldCourseAvailable = extractFunction(baseRuntime, 'private.tec_english_course_available', '(uuid, text, boolean)');
  const oldSnapshot = extendMetadataAllowlist(extractFunction(baseRuntime, 'private.tec_english_course_snapshot', '(text, integer)'));
  const oldPublicExercise = extendMetadataAllowlist(extractFunction(baseRuntime, 'private.tec_english_public_exercise', '(text)'));
  const oldStart = extractFunction(baseRuntime, 'public.start_tec_language_lesson_v1', '(uuid, text, text)');
  const startMarker = '  if exists (\n    select 1 from public.tec_english_lessons target';
  const beginnerGate = `  if not private.tec_idiomas_v4_legacy_access_allowed(p_institution_id, v_student_id, p_course_code) then\n    raise exception 'TEC_ENGLISH_BEGINNER_PATH_REQUIRED' using errcode = '42501';\n  end if;\n\n`;
  if (!oldStart.includes(startMarker)) throw new Error('Cannot insert the server-side beginner path gate.');
  const startWithGate = oldStart.replace(startMarker, `${beginnerGate}${startMarker}`);
  return `create or replace function private.tec_idiomas_v3_course_allowed(p_course_code text)\nreturns boolean language sql immutable security definer set search_path = '' as $$\n  select p_course_code in (\n${allowedRows}\n  );\n$$;\nrevoke all on function private.tec_idiomas_v3_course_allowed(text) from public, anon, authenticated;\n\ncreate or replace function private.tec_idiomas_v3_course_version_allowed(p_course_code text, p_content_version integer)\nreturns boolean language sql immutable security definer set search_path = '' as $$\n  select (p_course_code, p_content_version) in (\n${versionRows}\n  );\n$$;\nrevoke all on function private.tec_idiomas_v3_course_version_allowed(text, integer) from public, anon, authenticated;\n\ncreate or replace function private.tec_idiomas_v4_manifest_matches(p_course_code text, p_content_version integer)\nreturns boolean language sql stable security definer set search_path = '' as $$\n  select exists (select 1 from private.tec_idiomas_v4_content_manifest manifest\n    where manifest.course_code = p_course_code and manifest.content_version = p_content_version\n      and manifest.content_fingerprint = private.tec_english_course_fingerprint(p_course_code, p_content_version));\n$$;\nrevoke all on function private.tec_idiomas_v4_manifest_matches(text, integer) from public, anon, authenticated;\n\ncreate or replace function private.tec_idiomas_v3_course_content_eligible(p_course_code text, p_content_version integer)\nreturns boolean language sql stable security definer set search_path = '' as $$\n  select exists (select 1 from public.tec_english_courses course\n    where course.course_code = p_course_code and course.content_version = p_content_version\n      and private.tec_idiomas_v3_course_version_allowed(course.course_code, course.content_version)\n      and not course.is_test_fixture and course.publication_status in ('STAGING', 'PUBLISHED')\n      and case course.course_code\n${eligibleCases}\n      end\n      and not exists (select 1 from public.tec_english_units unit where unit.course_code = course.course_code\n        and (unit.content_version <> course.content_version or unit.publication_status not in ('STAGING', 'PUBLISHED')))\n      and not exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id\n        where unit.course_code = course.course_code and (lesson.content_version <> course.content_version or lesson.publication_status not in ('STAGING', 'PUBLISHED')))\n      and not exists (select 1 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id\n        where unit.course_code = course.course_code and (exercise.content_version <> course.content_version or exercise.publication_status not in ('STAGING', 'PUBLISHED')\n          or exercise.skill_code is null or exercise.difficulty_level not between 1 and 5))\n      and not exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id left join public.tec_english_exercises exercise on exercise.lesson_id = lesson.id\n        where unit.course_code = course.course_code group by lesson.id having\n          case when course.course_code in ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION','TEC_SPANISH_FOUNDATIONS_V1','TEC_KOREAN_FOUNDATIONS_V1') then count(exercise.id) <> 7\n               else count(exercise.id) not between 4 and 5 end));\n$$;\nrevoke all on function private.tec_idiomas_v3_course_content_eligible(text, integer) from public, anon, authenticated;\n\n${oldCourseAvailable}\n\n${oldSnapshot}\n\n${oldPublicExercise}\n\ninsert into private.tec_idiomas_v4_content_manifest(course_code, content_version, content_fingerprint)\nselect course.course_code, course.content_version, private.tec_english_course_fingerprint(course.course_code, course.content_version)\n  from public.tec_english_courses course where course.course_code in (${[...expected.keys()].map(sqlString).join(', ')})\non conflict (course_code) do nothing;\n\ncreate or replace function private.tec_idiomas_v4_legacy_access_allowed(p_institution_id uuid, p_student_id uuid, p_course_code text)\nreturns boolean language plpgsql stable security definer set search_path = '' as $$\ndeclare\n  v_beginner_code text := case p_course_code\n    when 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION' then 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER'\n    when 'TEC_SPANISH_FOUNDATIONS_V1' then 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER'\n    when 'TEC_KOREAN_FOUNDATIONS_V1' then 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER'\n    else null end;\n  v_legacy_activity boolean;\n  v_completed_intro integer;\nbegin\n  if v_beginner_code is null then return true; end if;\n  select exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id\n    where unit.course_code = p_course_code and (\n      exists (select 1 from public.tec_english_lesson_progress progress where progress.lesson_id = lesson.id and progress.institution_id = p_institution_id and progress.student_id = p_student_id)\n      or exists (select 1 from public.tec_english_lesson_sessions session where session.lesson_id = lesson.id and session.institution_id = p_institution_id and session.student_id = p_student_id)\n    )) into v_legacy_activity;\n  if v_legacy_activity then return true; end if;\n  select count(*)::integer into v_completed_intro from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id\n   where unit.course_code = v_beginner_code and exists (select 1 from public.tec_english_lesson_progress progress\n     where progress.lesson_id = lesson.id and progress.institution_id = p_institution_id and progress.student_id = p_student_id);\n  return v_completed_intro = 16;\nend;\n$$;\nrevoke all on function private.tec_idiomas_v4_legacy_access_allowed(uuid, uuid, text) from public, anon, authenticated;\n\n${startWithGate}\n`;
}

function buildSql(compiled, runtime) {
  const rows = rowsFor(compiled);
  const rowTables = [
    ['_v4_courses', 'course_code text, content_version integer, title text, description text, author text, publication_status text, review_status text, xp_per_lesson integer, is_test_fixture boolean', rows.courses],
    ['_v4_units', 'id text, course_code text, position integer, title text, description text, content_version integer, author text, publication_status text, review_status text', rows.units],
    ['_v4_lessons', 'id text, unit_id text, position integer, title text, introduction text, xp_reward integer, content_version integer, author text, publication_status text, review_status text', rows.lessons],
    ['_v4_exercises', 'id text, lesson_id text, position integer, exercise_type text, instruction text, prompt text, options jsonb, word_bank jsonb, left_items jsonb, right_items jsonb, audio_text text, accepted_answers jsonb, answer_key jsonb, explanation text, content_version integer, author text, publication_status text, review_status text, skill_code text, difficulty_level smallint, dialogue_speaker text, dialogue_context jsonb', rows.exercises],
  ];
  const stage = rowTables.map(([name, columns, values]) => `create temporary table ${name} (${columns}) on commit drop;\ninsert into ${name} values\n${sqlValues(values)};`).join('\n\n');
  const conflictChecks = [
    `if exists (select 1 from _v4_courses e join public.tec_english_courses a using (course_code) where row(a.content_version,a.title,a.description,a.author,a.publication_status,a.review_status,a.xp_per_lesson,a.is_test_fixture) is distinct from row(e.content_version,e.title,e.description,e.author,e.publication_status,e.review_status,e.xp_per_lesson,e.is_test_fixture)) then raise exception 'TEC_IDIOMAS_V4_COURSE_CONFLICT'; end if;`,
    `if exists (select 1 from _v4_units e join public.tec_english_units a using (id) where row(a.course_code,a.position,a.title,a.description,a.content_version,a.author,a.publication_status,a.review_status) is distinct from row(e.course_code,e.position,e.title,e.description,e.content_version,e.author,e.publication_status,e.review_status)) then raise exception 'TEC_IDIOMAS_V4_UNIT_CONFLICT'; end if;`,
    `if exists (select 1 from _v4_lessons e join public.tec_english_lessons a using (id) where row(a.unit_id,a.position,a.title,a.introduction,a.xp_reward,a.content_version,a.author,a.publication_status,a.review_status) is distinct from row(e.unit_id,e.position,e.title,e.introduction,e.xp_reward,e.content_version,e.author,e.publication_status,e.review_status)) then raise exception 'TEC_IDIOMAS_V4_LESSON_CONFLICT'; end if;`,
    `if exists (select 1 from _v4_exercises e join public.tec_english_exercises a using (id) where row(a.lesson_id,a.position,a.exercise_type,a.instruction,a.prompt,a.options,a.word_bank,a.left_items,a.right_items,a.audio_text,a.accepted_answers,a.answer_key,a.explanation,a.content_version,a.author,a.publication_status,a.review_status,a.skill_code,a.difficulty_level,a.dialogue_speaker,a.dialogue_context) is distinct from row(e.lesson_id,e.position,e.exercise_type,e.instruction,e.prompt,e.options,e.word_bank,e.left_items,e.right_items,e.audio_text,e.accepted_answers,e.answer_key,e.explanation,e.content_version,e.author,e.publication_status,e.review_status,e.skill_code,e.difficulty_level,e.dialogue_speaker,e.dialogue_context)) then raise exception 'TEC_IDIOMAS_V4_EXERCISE_CONFLICT'; end if;`,
  ].join('\n  ');
  const inserts = [
    'insert into public.tec_english_courses(course_code,content_version,title,description,author,publication_status,review_status,xp_per_lesson,is_test_fixture) select course_code,content_version,title,description,author,publication_status,review_status,xp_per_lesson,is_test_fixture from _v4_courses on conflict (course_code) do nothing;',
    'insert into public.tec_english_units(id,course_code,position,title,description,content_version,author,publication_status,review_status) select id,course_code,position,title,description,content_version,author,publication_status,review_status from _v4_units on conflict (id) do nothing;',
    'insert into public.tec_english_lessons(id,unit_id,position,title,introduction,xp_reward,content_version,author,publication_status,review_status) select id,unit_id,position,title,introduction,xp_reward,content_version,author,publication_status,review_status from _v4_lessons on conflict (id) do nothing;',
    'insert into public.tec_english_exercises(id,lesson_id,position,exercise_type,instruction,prompt,options,word_bank,left_items,right_items,audio_text,accepted_answers,answer_key,explanation,content_version,author,publication_status,review_status,skill_code,difficulty_level,dialogue_speaker,dialogue_context) select id,lesson_id,position,exercise_type,instruction,prompt,options,word_bank,left_items,right_items,audio_text,accepted_answers,answer_key,explanation,content_version,author,publication_status,review_status,skill_code,difficulty_level,dialogue_speaker,dialogue_context from _v4_exercises on conflict (id) do nothing;',
  ].join('\n');
  const counts = [...expected.entries()].map(([code, spec]) => `if (select count(*) from public.tec_english_units where course_code=${sqlString(code)}) <> ${spec.units} or (select count(*) from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id=lesson.unit_id where unit.course_code=${sqlString(code)}) <> ${spec.lessons} or (select count(*) from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id=exercise.lesson_id join public.tec_english_units unit on unit.id=lesson.unit_id where unit.course_code=${sqlString(code)}) <> ${spec.exercises} then raise exception 'TEC_IDIOMAS_V4_CONTENT_COUNT_MISMATCH'; end if;`).join('\n  ');
  return `-- Generated by tools/languages/tec-idiomas-v4.mjs from the canonical V4 beginner catalog.\n-- Additive only: all V4 content remains STAGING and PEDAGOGICAL_REVIEW_PENDING.\nbegin;\nset local lock_timeout = '3s';\nset local statement_timeout = '90s';\n\ncreate table if not exists private.tec_idiomas_v4_content_manifest (\n  course_code text primary key references public.tec_english_courses(course_code) on delete cascade,\n  content_version integer not null check (content_version > 0),\n  content_fingerprint text not null check (content_fingerprint ~ '^[a-f0-9]{64}$'),\n  created_at timestamptz not null default now()\n);\nalter table private.tec_idiomas_v4_content_manifest enable row level security;\nrevoke all on table private.tec_idiomas_v4_content_manifest from public, anon, authenticated;\n\n${stage}\n\ndo $$ begin\n  if current_setting('transaction_read_only')::boolean then raise exception 'TEC_IDIOMAS_V4_READ_ONLY'; end if;\n  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tec_english_exercises' and column_name='skill_code') then raise exception 'TEC_IDIOMAS_V4_ADAPTIVE_SCHEMA_REQUIRED'; end if;\n  ${conflictChecks}\nend $$;\n\n${inserts}\n\ndo $$ begin\n  ${counts}\n  if exists (select 1 from public.tec_english_courses where course_code in (${[...expected.keys()].map(sqlString).join(', ')}) and (publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING' or is_test_fixture)) then raise exception 'TEC_IDIOMAS_V4_REVIEW_STATE_CONFLICT'; end if;\nend $$;\n\n${runtime}\n\ncommit;\n`;
}

export function buildManifest(compiled = compileCourses()) {
  return {
    campaign: 'TEC_IDIOMAS_V4_ABSOLUTE_BEGINNERS',
    status: 'STAGING',
    pedagogical_review: 'PENDING',
    preserved_legacy_courses: oldCourseCodes,
    courses: compiled.map((item) => {
      const difficultyLevels = item.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.difficulty_level)));
      return ({
      code: item.course.code, language: item.course.language_code, title: item.course.title,
      units: item.units.map((unit) => ({ id: unit.id, title: unit.title, lessons: unit.lessons.map((lesson) => lesson.id) })),
      lesson_count: item.manifest.lesson_count, exercise_count: item.manifest.exercise_count,
      exercise_types: [...new Set(item.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.exercise_type))))].sort(),
      difficulty_range: [Math.min(...difficultyLevels), Math.max(...difficultyLevels)],
      content_fingerprint: item.manifest.content_fingerprint,
      });
    }),
  };
}

export async function generate() {
  const compiled = compileCourses();
  const errors = validateCourses(compiled);
  if (errors.length) throw new Error(errors.join('\n'));
  const runtimeBase = await readFile(path.join(root, 'supabase/migrations/20261027000100_tec_idiomas_v3_runtime.sql'), 'utf8');
  const migration = buildSql(compiled, createRuntimeSql(runtimeBase));
  await writeFile(migrationPath, migration);
  await writeFile(manifestPath, `${JSON.stringify(buildManifest(compiled), null, 2)}\n`);
  return { migrationPath, manifestPath, courses: compiled.length, lessons: compiled.reduce((sum, item) => sum + item.manifest.lesson_count, 0), exercises: compiled.reduce((sum, item) => sum + item.manifest.exercise_count, 0), migrationSha256: sha256(migration) };
}

export async function checkGeneratedFiles() {
  const compiled = compileCourses();
  const errors = validateCourses(compiled);
  if (errors.length) throw new Error(errors.join('\n'));
  const runtimeBase = await readFile(path.join(root, 'supabase/migrations/20261027000100_tec_idiomas_v3_runtime.sql'), 'utf8');
  const expectedSql = buildSql(compiled, createRuntimeSql(runtimeBase));
  const expectedManifest = `${JSON.stringify(buildManifest(compiled), null, 2)}\n`;
  const actualSql = await readFile(migrationPath, 'utf8').catch(() => '');
  const actualManifest = await readFile(manifestPath, 'utf8').catch(() => '');
  if (actualSql !== expectedSql || actualManifest !== expectedManifest) throw new Error('V4 generated migration or manifest is stale; run the generate command.');
  return { courses: compiled.length, lessons: compiled.reduce((sum, item) => sum + item.manifest.lesson_count, 0), exercises: compiled.reduce((sum, item) => sum + item.manifest.exercise_count, 0), migrationSha256: sha256(actualSql) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] ?? 'validate';
  if (command === 'generate') {
    const result = await generate();
    await mkdir(path.dirname(result.migrationPath), { recursive: true });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'validate') {
    const errors = validateCourses();
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('Tec Idiomas V4 catalog valid: 3 courses, 48 lessons, 224 exercises; review pending.');
  } else if (command === 'check') {
    console.log(JSON.stringify(await checkGeneratedFiles(), null, 2));
  } else throw new Error(`Unknown command: ${command}`);
}
