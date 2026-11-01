import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { courses as sourceCourses, exerciseCorrections } from '../../content/languages/tec-idiomas-v3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const privateRoot = process.env.TEC_IDIOMAS_V3_PRIVATE_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? tmpdir(), 'TecEscola', 'private', 'tec-idiomas-v3');
const TYPES = ['MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING'];
const PRESERVED_LESSON_INTRODUCTION_IDS = new Set(['ko-v1-u1-l1']);
const AUTHOR = 'Equipe de conteúdo Tec Escola';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sqlString(value) {
  return value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function rotate(values, amount) {
  if (values.length < 2) return [...values];
  const offset = amount % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.codePointAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYates(values, seed) {
  const distinctValues = new Set(values);
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const result = values.map((value, index) => ({ value, index }));
    const random = seededRandom(`${seed}:${attempt}`);
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    const shuffled = result.map(({ value }) => value);
    if (distinctValues.size < 2 || shuffled.some((value, index) => value !== values[index])) return shuffled;
  }
  return [...values];
}

function containsNormalizedAnswerSequence(context, answer) {
  const tokenize = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const contextTokens = tokenize(context);
  const answerTokens = tokenize(answer);
  if (!answerTokens.length || answerTokens.length > contextTokens.length) return false;
  return contextTokens.some((_, start) => answerTokens.every((token, offset) => contextTokens[start + offset] === token));
}

function makeExercise(lesson, unit, course, index) {
  const position = index + 1;
  const id = `${lesson.id}-e${position}`;
  const languagePrefix = course.languageCode === 'en-US' ? 'en_v2x' : course.languageCode === 'es-ES' ? 'es_v1' : 'ko_v1';
  const lessonSlug = slug(lesson.id.replace(/^(en-v2x|es-v1|ko-v1)-/, ''));
  const typeSkill = ['dialogue', 'word_order', 'translation', 'listening', 'matching', 'grammar', 'speaking'][index];
  const skillCode = `${languagePrefix}_${lessonSlug}_${typeSkill}`;
  const difficulty = Math.min(5, unit.order + Math.floor((lesson.orderInUnit - 1) / 2));
  const common = {
    id, position, skill_code: skillCode, difficulty_level: difficulty,
    options: [], word_bank: [], left_items: [], right_items: [], audio_text: null,
    dialogue_speaker: null, dialogue_context: [], accepted_answers: [], answer_key: {},
    author: AUTHOR, content_version: course.version, publication_status: 'STAGING',
    review_status: 'PEDAGOGICAL_REVIEW_PENDING',
  };
  const dialogue = [{ speaker: lesson.dialogueSpeaker, text: lesson.dialogueQuestion }];
  const exercise = (() => {
  switch (index) {
    case 0:
      return { ...common, exercise_type: 'MULTIPLE_CHOICE', instruction: 'Leia a conversa e escolha a resposta adequada à situação.', prompt: lesson.dialoguePrompt, options: lesson.dialogueOptions, accepted_answers: [lesson.dialogueAnswer], answer_key: { accepted: [lesson.dialogueAnswer] }, explanation: `A resposta escolhida deve atender à situação descrita. ${lesson.objective}`, dialogue_speaker: null, dialogue_context: dialogue };
    case 1:
      return { ...common, exercise_type: 'WORD_ORDER', instruction: 'Organize as palavras para formar a frase no idioma estudado.', prompt: `Monte: “${lesson.orderPt}”`, word_bank: lesson.orderAnswer.trim().split(/\s+/), accepted_answers: [lesson.orderAnswer], answer_key: { accepted: [lesson.orderAnswer] }, explanation: `Uma forma correta é “${lesson.orderAnswer}”. ${lesson.objective}` };
    case 2:
      return { ...common, exercise_type: 'TRANSLATION', instruction: 'Escreva a tradução no idioma estudado.', prompt: lesson.translationPt, accepted_answers: lesson.translationAnswers, answer_key: { accepted: lesson.translationAnswers }, explanation: `Resposta esperada: “${lesson.translationAnswers[0]}”. ${lesson.objective}` };
    case 3:
      return { ...common, exercise_type: 'LISTENING', instruction: 'Ouça e responda em português.', prompt: lesson.listeningQuestion, audio_text: lesson.listeningText, accepted_answers: lesson.listeningAnswers, answer_key: { accepted: lesson.listeningAnswers }, explanation: `O áudio diz: “${lesson.listeningText}”.` };
    case 4: {
      const entries = Object.entries(lesson.pairs);
      const left = entries.map(([term]) => term);
      const right = rotate(entries.map(([, meaning]) => meaning), 1);
      return { ...common, exercise_type: 'MATCHING', instruction: 'Associe cada expressão ao significado correto em português.', prompt: `Associe: ${left.join(', ')}.`, left_items: left, right_items: right, answer_key: { pairs: lesson.pairs }, explanation: `Pares corretos: ${entries.map(([term, meaning]) => `${term} = ${meaning}`).join('; ')}.` };
    }
    case 5: {
      const accepted = Array.isArray(lesson.fillAnswer) ? lesson.fillAnswer : [lesson.fillAnswer];
      return { ...common, exercise_type: 'FILL_BLANK', instruction: 'Escolha a palavra que completa a frase.', prompt: lesson.fillPrompt, options: lesson.fillOptions, accepted_answers: accepted, answer_key: { accepted }, explanation: lesson.fillExplanation };
    }
    default:
      return { ...common, exercise_type: 'SPEAKING', instruction: 'Leia a frase em voz alta. Se o navegador não oferecer voz, digite-a para continuar.', prompt: `Pratique a frase: “${lesson.orderAnswer}”`, audio_text: lesson.orderAnswer, accepted_answers: [lesson.orderAnswer], answer_key: { accepted: [lesson.orderAnswer] }, explanation: `Fale a frase com calma e confira sua estrutura: “${lesson.orderAnswer}”.` };
  }
  })();
  const corrected = { ...exercise, ...(exerciseCorrections[id] ?? {}) };
  if (corrected.exercise_type === 'WORD_ORDER') {
    corrected.word_bank = fisherYates(corrected.word_bank, `${id}:canonical-word-bank`);
  }
  return corrected;
}

export function compileCourses() {
  return sourceCourses.map((source) => {
    const course = { ...source.course, author: AUTHOR, is_test_fixture: false, xp_per_lesson: source.course.xpReward };
    let lessonCount = 0;
    const units = source.units.map((unit) => ({
      id: unit.id, course_code: course.code, position: unit.order, title: unit.title,
      description: unit.description, content_version: course.version, author: AUTHOR,
      publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      lessons: unit.lessons.map((lesson) => {
        lessonCount += 1;
        const compiledLesson = {
          id: lesson.id, unit_id: unit.id, position: unit.lessons.indexOf(lesson) + 1,
          title: lesson.title,
          introduction: `Objetivo: ${lesson.objective}\n\n${lesson.introduction}`,
          xp_reward: course.xp_per_lesson, content_version: course.version, author: AUTHOR,
          publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING',
          orderInUnit: unit.lessons.indexOf(lesson) + 1,
        };
        return { ...compiledLesson, exercises: TYPES.map((_, index) => makeExercise({ ...lesson, orderInUnit: compiledLesson.orderInUnit }, unit, course, index)) };
      }),
    }));
    const result = { course, units };
    result.manifest = {
      lesson_count: lessonCount,
      exercise_count: units.reduce((sum, unit) => sum + unit.lessons.reduce((n, lesson) => n + lesson.exercises.length, 0), 0),
      content_fingerprint: sha256(stable({ course, units })),
    };
    return result;
  });
}

export function validateCourses(compiled = compileCourses()) {
  const errors = [];
  const expected = new Map([
    ['TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', [4, 16, 112]],
    ['TEC_SPANISH_FOUNDATIONS_V1', [2, 8, 56]],
    ['TEC_KOREAN_FOUNDATIONS_V1', [2, 8, 56]],
  ]);
  if (compiled.length !== expected.size) errors.push(`Esperados ${expected.size} cursos; encontrados ${compiled.length}.`);
  for (const item of compiled) {
    const spec = expected.get(item.course.code);
    if (!spec) { errors.push(`Curso não autorizado no lote: ${item.course.code}`); continue; }
    const lessons = item.units.flatMap((unit) => unit.lessons);
    const exercises = lessons.flatMap((lesson) => lesson.exercises);
    if (item.units.length !== spec[0] || lessons.length !== spec[1] || exercises.length !== spec[2]) errors.push(`${item.course.code}: contagens divergentes de unidade/lição/exercício.`);
    if (item.course.publicationStatus !== 'STAGING' || item.course.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push(`${item.course.code}: status deve permanecer STAGING e revisão pendente.`);
    const ids = new Set();
    for (const unit of item.units) {
      if (!unit.title.trim() || !unit.description.trim()) errors.push(`${item.course.code}/${unit.id}: unidade sem título ou descrição.`);
      for (const lesson of unit.lessons) {
        if (ids.has(lesson.id)) errors.push(`${item.course.code}: ID de lição duplicado ${lesson.id}.`);
        ids.add(lesson.id);
        if (!lesson.title.trim() || !lesson.introduction.trim() || lesson.exercises.length !== TYPES.length) errors.push(`${lesson.id}: lição incompleta.`);
        const local = new Set();
        for (const exercise of lesson.exercises) {
          if (local.has(exercise.exercise_type)) errors.push(`${lesson.id}: tipo repetido ${exercise.exercise_type}.`);
          local.add(exercise.exercise_type);
          if (!exercise.prompt.trim() || !exercise.instruction.trim() || !exercise.explanation.trim()) errors.push(`${exercise.id}: exercício sem instrução, enunciado ou explicação.`);
          if (!/^[a-z][a-z0-9_]{2,63}$/.test(exercise.skill_code)) errors.push(`${exercise.id}: skill_code inválido ${exercise.skill_code}.`);
          if (exercise.difficulty_level < 1 || exercise.difficulty_level > 5) errors.push(`${exercise.id}: dificuldade fora de 1–5.`);
          if (exercise.exercise_type === 'MULTIPLE_CHOICE' && (!exercise.options.includes(exercise.answer_key.accepted?.[0]) || exercise.options.length < 3)) errors.push(`${exercise.id}: gabarito da conversa não está nas alternativas.`);
          if (['MULTIPLE_CHOICE', 'FILL_BLANK'].includes(exercise.exercise_type) && new Set(exercise.options).size !== exercise.options.length) errors.push(`${exercise.id}: alternativas repetidas.`);
          if (exercise.exercise_type !== 'MATCHING' && stable(exercise.accepted_answers) !== stable(exercise.answer_key.accepted ?? [])) errors.push(`${exercise.id}: respostas aceitas divergem do gabarito de correção.`);
          if (exercise.exercise_type === 'MULTIPLE_CHOICE') {
            const context = exercise.dialogue_context ?? [];
            const priorDialogue = context.map((turn) => turn.text).join(' ');
            const leaksAnswer = (exercise.answer_key.accepted ?? []).some((answer) => containsNormalizedAnswerSequence(priorDialogue, answer));
            if (context.length > 1 || (context.length === 1 && !context[0]?.text) || (!context.length && /conversa/i.test(exercise.instruction)) || leaksAnswer) errors.push(`${exercise.id}: diálogo pré-resposta inconsistente ou revela o gabarito.`);
          }
          if (exercise.exercise_type === 'FILL_BLANK' && (!exercise.answer_key.accepted?.length || exercise.answer_key.accepted.some((answer) => !exercise.options.includes(answer)) || exercise.options.length < 3)) errors.push(`${exercise.id}: respostas aceitas de completar precisam estar nas alternativas.`);
          if (exercise.exercise_type === 'WORD_ORDER' && (exercise.word_bank.length < 2 || exercise.word_bank.join(' ') === exercise.answer_key.accepted?.[0])) errors.push(`${exercise.id}: banco de palavras ausente ou já ordenado.`);
          if (exercise.exercise_type === 'MATCHING' && (exercise.left_items.length < 2 || exercise.left_items.length !== exercise.right_items.length || Object.keys(exercise.answer_key.pairs ?? {}).length !== exercise.left_items.length)) errors.push(`${exercise.id}: associação incompleta.`);
          if (exercise.exercise_type === 'LISTENING' && (!exercise.audio_text || !exercise.answer_key.accepted?.length || exercise.instruction !== 'Ouça e responda em português.' || exercise.accepted_answers.some((answer) => /[가-힣]/u.test(answer)))) errors.push(`${exercise.id}: escuta sem áudio/resposta, instrução alinhada ou resposta em português.`);
          if (exercise.exercise_type === 'SPEAKING' && (!exercise.audio_text || !exercise.answer_key.accepted?.length)) errors.push(`${exercise.id}: prática de pronúncia sem frase-alvo.`);
        }
        if (local.size !== TYPES.length) errors.push(`${lesson.id}: modalidades não cobrem o conjunto esperado.`);
      }
    }
    if (item.course.languageCode === 'ko-KR') {
      for (const lesson of lessons) {
        if (!/[가-힣]/u.test(lesson.introduction) || !/\([^)]*[a-z]{2,}[^)]*\)/iu.test(lesson.introduction)) errors.push(`${lesson.id}: introdução precisa de Hangul e romanização complementar.`);
      }
    }
    const exerciseKeys = new Set();
    for (const exercise of exercises) {
      const key = `${exercise.exercise_type}:${exercise.prompt.normalize('NFKC').trim().toLocaleLowerCase()}`;
      if (exerciseKeys.has(key)) errors.push(`${item.course.code}: enunciado repetido (${exercise.exercise_type}) — ${exercise.prompt}`);
      exerciseKeys.add(key);
    }
    if (!item.manifest.content_fingerprint || !/^[a-f0-9]{64}$/.test(item.manifest.content_fingerprint)) errors.push(`${item.course.code}: fingerprint inválido.`);
  }
  return errors;
}

function rowsForSql(compiled) {
  const courseRows = [];
  const unitRows = [];
  const lessonRows = [];
  const exerciseRows = [];
  for (const item of compiled) {
    const c = item.course;
    courseRows.push([c.code, c.version, c.title, c.description, c.author, 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', c.xp_per_lesson, false]);
    for (const unit of item.units) {
      unitRows.push([unit.id, c.code, unit.position, unit.title, unit.description, c.version, AUTHOR, 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING']);
      for (const lesson of unit.lessons) {
        lessonRows.push([lesson.id, unit.id, lesson.position, lesson.title, lesson.introduction, lesson.xp_reward, c.version, AUTHOR, 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING']);
        for (const exercise of lesson.exercises) {
          exerciseRows.push([exercise.id, lesson.id, exercise.position, exercise.exercise_type, exercise.instruction, exercise.prompt, exercise.options, exercise.word_bank, exercise.left_items, exercise.right_items, exercise.audio_text, exercise.accepted_answers, exercise.answer_key, exercise.explanation, c.version, AUTHOR, 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', exercise.skill_code, exercise.difficulty_level, exercise.dialogue_speaker, exercise.dialogue_context]);
        }
      }
    }
  }
  return { courseRows, unitRows, lessonRows, exerciseRows };
}

function values(rows, types) {
  return rows.map((row) => `(${row.map((value, index) => types[index] === 'jsonb' ? sqlJson(value) : sqlString(value)).join(', ')})`).join(',\n');
}

export function generateInsertSql(compiled = compileCourses()) {
  const { courseRows, unitRows, lessonRows, exerciseRows } = rowsForSql(compiled);
  const lines = [
    '-- Generated from content/languages/tec-idiomas-v3.mjs. Additive and idempotent; never changes review/publication state.',
    '-- This file is private authoring material. It contains answer keys and must not be copied to public/ or the frontend bundle.',
    'begin;',
    'set local lock_timeout = \'3s\';',
    'set local statement_timeout = \'60s\';',
    'do $$ begin',
    "  if current_setting('transaction_read_only')::boolean then raise exception 'CONTENT_LOAD_READ_ONLY_TRANSACTION'; end if;",
    "  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tec_english_exercises' and column_name='skill_code') then raise exception 'TEC_LANGUAGE_V2_SCHEMA_REQUIRED'; end if;",
    'end $$;',
    'create temporary table _tec_lang_courses (course_code text, content_version int, title text, description text, author text, publication_status text, review_status text, xp_per_lesson int, is_test_fixture boolean) on commit drop;',
    `insert into _tec_lang_courses values\n${values(courseRows, ['text','int','text','text','text','text','text','int','bool'])};`,
    'create temporary table _tec_lang_units (id text, course_code text, position int, title text, description text, content_version int, author text, publication_status text, review_status text) on commit drop;',
    `insert into _tec_lang_units values\n${values(unitRows, ['text','text','int','text','text','int','text','text','text'])};`,
    'create temporary table _tec_lang_lessons (id text, unit_id text, position int, title text, introduction text, xp_reward int, content_version int, author text, publication_status text, review_status text) on commit drop;',
    `insert into _tec_lang_lessons values\n${values(lessonRows, ['text','text','int','text','text','int','int','text','text','text'])};`,
    'create temporary table _tec_lang_exercises (id text, lesson_id text, position int, exercise_type text, instruction text, prompt text, options jsonb, word_bank jsonb, left_items jsonb, right_items jsonb, audio_text text, accepted_answers jsonb, answer_key jsonb, explanation text, content_version int, author text, publication_status text, review_status text, skill_code text, difficulty_level smallint, dialogue_speaker text, dialogue_context jsonb) on commit drop;',
    `insert into _tec_lang_exercises values\n${values(exerciseRows, ['text','text','int','text','text','text','jsonb','jsonb','jsonb','jsonb','text','jsonb','jsonb','text','int','text','text','text','text','int','text','jsonb'])};`,
    'do $$ begin',
    "  if exists (select 1 from _tec_lang_courses e join public.tec_english_courses a using (course_code) where row(a.content_version,a.title,a.description,a.author,a.publication_status,a.review_status,a.xp_per_lesson,a.is_test_fixture) is distinct from row(e.content_version,e.title,e.description,e.author,e.publication_status,e.review_status,e.xp_per_lesson,e.is_test_fixture)) then raise exception 'TEC_LANGUAGE_COURSE_CONFLICT'; end if;",
    "  if exists (select 1 from _tec_lang_units e join public.tec_english_units a using (id) where row(a.course_code,a.position,a.title,a.description,a.content_version,a.author,a.publication_status,a.review_status) is distinct from row(e.course_code,e.position,e.title,e.description,e.content_version,e.author,e.publication_status,e.review_status)) then raise exception 'TEC_LANGUAGE_UNIT_CONFLICT'; end if;",
    "  if exists (select 1 from _tec_lang_lessons e join public.tec_english_lessons a using (id) where row(a.unit_id,a.position,a.title,a.introduction,a.xp_reward,a.content_version,a.author,a.publication_status,a.review_status) is distinct from row(e.unit_id,e.position,e.title,e.introduction,e.xp_reward,e.content_version,e.author,e.publication_status,e.review_status)) then raise exception 'TEC_LANGUAGE_LESSON_CONFLICT'; end if;",
    "  if exists (select 1 from _tec_lang_exercises e join public.tec_english_exercises a using (id) where row(a.lesson_id,a.position,a.exercise_type,a.instruction,a.prompt,a.options,a.word_bank,a.left_items,a.right_items,a.audio_text,a.accepted_answers,a.answer_key,a.explanation,a.content_version,a.author,a.publication_status,a.review_status,a.skill_code,a.difficulty_level,a.dialogue_speaker,a.dialogue_context) is distinct from row(e.lesson_id,e.position,e.exercise_type,e.instruction,e.prompt,e.options,e.word_bank,e.left_items,e.right_items,e.audio_text,e.accepted_answers,e.answer_key,e.explanation,e.content_version,e.author,e.publication_status,e.review_status,e.skill_code,e.difficulty_level,e.dialogue_speaker,e.dialogue_context)) then raise exception 'TEC_LANGUAGE_EXERCISE_CONFLICT'; end if;",
    'end $$;',
    'insert into public.tec_english_courses(course_code,content_version,title,description,author,publication_status,review_status,xp_per_lesson,is_test_fixture) select * from _tec_lang_courses on conflict (course_code) do nothing;',
    'insert into public.tec_english_units(id,course_code,position,title,description,content_version,author,publication_status,review_status) select * from _tec_lang_units on conflict (id) do nothing;',
    'insert into public.tec_english_lessons(id,unit_id,position,title,introduction,xp_reward,content_version,author,publication_status,review_status) select * from _tec_lang_lessons on conflict (id) do nothing;',
    'insert into public.tec_english_exercises(id,lesson_id,position,exercise_type,instruction,prompt,options,word_bank,left_items,right_items,audio_text,accepted_answers,answer_key,explanation,content_version,author,publication_status,review_status,skill_code,difficulty_level,dialogue_speaker,dialogue_context) select * from _tec_lang_exercises on conflict (id) do nothing;',
    'do $$ begin',
    "  if exists (select 1 from _tec_lang_courses e where not exists (select 1 from public.tec_english_courses a where a.course_code=e.course_code and row(a.content_version,a.title,a.description,a.author,a.publication_status,a.review_status,a.xp_per_lesson,a.is_test_fixture) is not distinct from row(e.content_version,e.title,e.description,e.author,e.publication_status,e.review_status,e.xp_per_lesson,e.is_test_fixture))) then raise exception 'TEC_LANGUAGE_COURSE_VERIFY_FAILED'; end if;",
    "  if exists (select 1 from _tec_lang_units e where not exists (select 1 from public.tec_english_units a where a.id=e.id and row(a.course_code,a.position,a.title,a.description,a.content_version,a.author,a.publication_status,a.review_status) is not distinct from row(e.course_code,e.position,e.title,e.description,e.content_version,e.author,e.publication_status,e.review_status))) then raise exception 'TEC_LANGUAGE_UNIT_VERIFY_FAILED'; end if;",
    "  if exists (select 1 from _tec_lang_lessons e where not exists (select 1 from public.tec_english_lessons a where a.id=e.id and row(a.unit_id,a.position,a.title,a.introduction,a.xp_reward,a.content_version,a.author,a.publication_status,a.review_status) is not distinct from row(e.unit_id,e.position,e.title,e.introduction,e.xp_reward,e.content_version,e.author,e.publication_status,e.review_status))) then raise exception 'TEC_LANGUAGE_LESSON_VERIFY_FAILED'; end if;",
    "  if exists (select 1 from _tec_lang_exercises e where not exists (select 1 from public.tec_english_exercises a where a.id=e.id and row(a.lesson_id,a.position,a.exercise_type,a.instruction,a.prompt,a.options,a.word_bank,a.left_items,a.right_items,a.audio_text,a.accepted_answers,a.answer_key,a.explanation,a.content_version,a.author,a.publication_status,a.review_status,a.skill_code,a.difficulty_level,a.dialogue_speaker,a.dialogue_context) is not distinct from row(e.lesson_id,e.position,e.exercise_type,e.instruction,e.prompt,e.options,e.word_bank,e.left_items,e.right_items,e.audio_text,e.accepted_answers,e.answer_key,e.explanation,e.content_version,e.author,e.publication_status,e.review_status,e.skill_code,e.difficulty_level,e.dialogue_speaker,e.dialogue_context))) then raise exception 'TEC_LANGUAGE_EXERCISE_VERIFY_FAILED'; end if;",
    "  if exists (select 1 from _tec_lang_courses c where (select count(*) from public.tec_english_units a where a.course_code=c.course_code) <> (select count(*) from _tec_lang_units e where e.course_code=c.course_code) or (select count(*) from public.tec_english_lessons a join public.tec_english_units u on u.id=a.unit_id where u.course_code=c.course_code) <> (select count(*) from _tec_lang_lessons e join _tec_lang_units u on u.id=e.unit_id where u.course_code=c.course_code) or (select count(*) from public.tec_english_exercises a join public.tec_english_lessons l on l.id=a.lesson_id join public.tec_english_units u on u.id=l.unit_id where u.course_code=c.course_code) <> (select count(*) from _tec_lang_exercises e join _tec_lang_lessons l on l.id=e.lesson_id join _tec_lang_units u on u.id=l.unit_id where u.course_code=c.course_code)) then raise exception 'TEC_LANGUAGE_CONTENT_COUNT_MISMATCH'; end if;",
    "  if exists (select 1 from public.tec_english_courses c join _tec_lang_courses e using (course_code) where c.publication_status <> 'STAGING' or c.review_status <> 'PEDAGOGICAL_REVIEW_PENDING') then raise exception 'TEC_LANGUAGE_CONTENT_NOT_STAGING'; end if;",
    'end $$;',
    "select course_code, content_version, publication_status, review_status, (select count(*) from public.tec_english_units u where u.course_code=c.course_code) as units, (select count(*) from public.tec_english_lessons l join public.tec_english_units u on u.id=l.unit_id where u.course_code=c.course_code) as lessons, (select count(*) from public.tec_english_exercises e join public.tec_english_lessons l on l.id=e.lesson_id join public.tec_english_units u on u.id=l.unit_id where u.course_code=c.course_code) as exercises from _tec_lang_courses c order by course_code;",
    'commit;',
    '',
  ];
  return lines.join('\n');
}

function flattenForCorrection(compiled) {
  const lessons = [];
  const exercises = [];
  for (const course of compiled) for (const unit of course.units) for (const lesson of unit.lessons) {
    lessons.push({ course_code: course.course.code, ...lesson });
    for (const exercise of lesson.exercises) exercises.push({ course_code: course.course.code, lesson_id: lesson.id, ...exercise });
  }
  return { lessons, exercises };
}

function correctionSqlValue(column, value) {
  return ['options', 'word_bank', 'left_items', 'right_items', 'accepted_answers', 'answer_key', 'dialogue_context'].includes(column)
    ? sqlJson(value)
    : sqlString(value);
}

function correctionRowMatches(table, idColumn, id, columns, row) {
  const values = columns.map((column) => correctionSqlValue(column, row[column])).join(', ');
  return `exists (select 1 from ${table} where ${idColumn} = ${sqlString(id)} and row(${columns.join(', ')}) is not distinct from row(${values}))`;
}

function correctionUpdate(table, idColumn, id, columns, before, after) {
  const changedColumns = columns.filter((column) => stable(before[column]) !== stable(after[column]));
  if (!changedColumns.length) return '';
  const compareColumns = columns;
  const beforeRow = compareColumns.map((column) => correctionSqlValue(column, before[column])).join(', ');
  const afterRow = compareColumns.map((column) => correctionSqlValue(column, after[column])).join(', ');
  const assignments = changedColumns.map((column) => `${column} = ${correctionSqlValue(column, after[column])}`).join(', ');
  return [
    `    if ${correctionRowMatches(table, idColumn, id, compareColumns, after)} then`,
    '      null; -- already corrected; safe re-run',
    `    elsif exists (select 1 from ${table} where ${idColumn} = ${sqlString(id)} and row(${compareColumns.join(', ')}) is not distinct from row(${beforeRow})) then`,
    `      update ${table} set ${assignments} where ${idColumn} = ${sqlString(id)};`,
    '      get diagnostics v_updated = row_count;',
    "      if v_updated <> 1 then raise exception 'TEC_IDIOMAS_V3_CORRECTION_ROW_COUNT'; end if;",
    `    else raise exception 'TEC_IDIOMAS_V3_CORRECTION_DRIFT:${id}'; end if;`,
  ].join('\n');
}

export function generateCorrectionSql(previousCourses, currentCourses = compileCourses(), { expectedProductionFingerprints = {} } = {}) {
  const oldRows = flattenForCorrection(previousCourses);
  const unfilteredNewRows = flattenForCorrection(currentCourses);
  const oldLessonById = new Map(oldRows.lessons.map((row) => [row.id, row]));
  const newRows = {
    ...unfilteredNewRows,
    lessons: unfilteredNewRows.lessons.map((row) => {
      if (!PRESERVED_LESSON_INTRODUCTION_IDS.has(row.id)) return row;
      const previous = oldLessonById.get(row.id);
      return previous ? { ...row, introduction: previous.introduction } : row;
    }),
  };
  const oldExercises = new Map(oldRows.exercises.map((row) => [row.id, row]));
  const oldLessons = new Map(oldRows.lessons.map((row) => [row.id, row]));
  const currentLessons = new Map(newRows.lessons.map((row) => [row.id, row]));
  const currentExercises = new Map(newRows.exercises.map((row) => [row.id, row]));
  const exerciseColumns = ['lesson_id','position','exercise_type','instruction','prompt','options','word_bank','left_items','right_items','audio_text','accepted_answers','answer_key','explanation','content_version','author','publication_status','review_status','skill_code','difficulty_level','dialogue_speaker','dialogue_context'];
  const lessonColumns = ['unit_id','position','title','introduction','xp_reward','content_version','author','publication_status','review_status'];
  const changedExerciseRows = [...currentExercises.values()].filter((row) => stable(oldExercises.get(row.id)) !== stable(row));
  const changedLessonRows = [...currentLessons.values()].filter((row) => stable(oldLessons.get(row.id)) !== stable(row));
  const expectedCodes = currentCourses.map((course) => course.course.code).sort();
  const suppliedCodes = Object.keys(expectedProductionFingerprints).sort();
  if (JSON.stringify(expectedCodes) !== JSON.stringify(suppliedCodes)) {
    throw new Error(`Os fingerprints esperados devem corresponder exatamente aos cursos desta correção: ${expectedCodes.join(', ')}`);
  }
  for (const course of currentCourses) {
    if (!/^[a-f0-9]{32}$/.test(expectedProductionFingerprints[course.course.code] ?? '')) {
      throw new Error(`Falta o fingerprint de produção lido para ${course.course.code}; o SQL de correção não pode ser preparado sem esse precheck.`);
    }
  }
  const changedLessonIds = [...new Set([...changedExerciseRows.map((row) => row.lesson_id), ...changedLessonRows.map((row) => row.id)])];
  const courseRows = currentCourses.map((course) => {
    const code = course.course.code;
    const expectedLessons = newRows.lessons.filter((row) => row.course_code === code);
    const expectedExercises = newRows.exercises.filter((row) => row.course_code === code);
    const expectedUnits = course.units.map((unit) => ({ course_code: code, ...unit }));
    const courseColumns = ['content_version','title','description','author','xp_per_lesson'];
    const unitColumns = ['course_code','position','title','description','content_version','author','publication_status','review_status'];
    const expectedCourse = { ...course.course, content_version: course.course.version };
    const afterStates = [
      correctionRowMatches('public.tec_english_courses', 'course_code', code, courseColumns, expectedCourse),
      ...expectedUnits.map((row) => correctionRowMatches('public.tec_english_units', 'id', row.id, unitColumns, row)),
      ...expectedLessons.map((row) => correctionRowMatches('public.tec_english_lessons', 'id', row.id, lessonColumns, row)),
      ...expectedExercises.map((row) => correctionRowMatches('public.tec_english_exercises', 'id', row.id, exerciseColumns, row)),
      `(select count(*) from public.tec_english_units where course_code = ${sqlString(code)}) = ${expectedUnits.length}`,
      `(select count(*) from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = ${sqlString(code)}) = ${expectedLessons.length}`,
      `(select count(*) from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = ${sqlString(code)}) = ${expectedExercises.length}`,
    ];
    const allAfter = afterStates.join(' and ');
    const expectedFingerprint = expectedProductionFingerprints[code];
    return `    perform 1 from public.tec_english_courses where course_code = ${sqlString(code)} and content_version = ${course.course.version} and publication_status = 'STAGING' and review_status = 'PEDAGOGICAL_REVIEW_PENDING' and is_test_fixture = false for update;\n    if not found then raise exception 'TEC_IDIOMAS_V3_COURSE_STATE:${code}'; end if;\n    v_fingerprint := private.tec_english_course_fingerprint(${sqlString(code)}, ${course.course.version});\n    if v_fingerprint <> ${sqlString(expectedFingerprint)} and not (${allAfter}) then raise exception 'TEC_IDIOMAS_V3_COURSE_FINGERPRINT_DRIFT:${code}'; end if;`;
  });
  const reviewGuards = currentCourses.map((course) => `    if exists (select 1 from public.tec_english_pedagogical_reviews where course_code = ${sqlString(course.course.code)} and content_version = ${course.course.version}) then raise exception 'TEC_IDIOMAS_V3_REVIEW_EXISTS:${course.course.code}'; end if;\n    if exists (select 1 from public.tec_english_course_releases where course_code = ${sqlString(course.course.code)} and content_version = ${course.course.version}) then raise exception 'TEC_IDIOMAS_V3_RELEASE_EXISTS:${course.course.code}'; end if;\n    if exists (select 1 from public.tec_english_course_release_events where course_code = ${sqlString(course.course.code)} and content_version = ${course.course.version}) then raise exception 'TEC_IDIOMAS_V3_RELEASE_EVENT_EXISTS:${course.course.code}'; end if;`).join('\n');
  const progressGuard = changedLessonIds.length ? `    if exists (select 1 from public.tec_english_lesson_sessions where lesson_id = any(array[${changedLessonIds.map(sqlString).join(', ')}]::text[])) or exists (select 1 from public.tec_english_lesson_progress where lesson_id = any(array[${changedLessonIds.map(sqlString).join(', ')}]::text[])) or exists (select 1 from public.tec_english_answer_attempts where exercise_id = any(array[${changedExerciseRows.map((row) => sqlString(row.id)).join(', ')}]::text[])) then raise exception 'TEC_IDIOMAS_V3_STUDENT_PROGRESS_EXISTS'; end if;` : '';
  const updates = [
    ...changedLessonRows.map((row) => correctionUpdate('public.tec_english_lessons', 'id', row.id, lessonColumns, oldLessons.get(row.id), row)),
    ...changedExerciseRows.map((row) => correctionUpdate('public.tec_english_exercises', 'id', row.id, exerciseColumns, oldExercises.get(row.id), row)),
  ].filter(Boolean).join('\n');
  return [
    '-- PRIVATE CONTENT CORRECTION. Review the exact course/version/fingerprint and student activity before any use.',
    '-- Transaction is fail-closed and re-runnable only when rows are exactly at the before or after snapshot.',
    'begin;',
    'set local lock_timeout = \'5s\';',
    'set local statement_timeout = \'30s\';',
    'lock table public.tec_english_courses, public.tec_english_lessons, public.tec_english_exercises, public.tec_english_pedagogical_reviews, public.tec_english_course_releases, public.tec_english_course_release_events, public.tec_english_lesson_sessions, public.tec_english_lesson_progress, public.tec_english_answer_attempts in share row exclusive mode;',
    'do $tec_idiomas_v3_correction$',
    'declare v_updated integer; v_fingerprint text;',
    'begin',
    ...courseRows,
    reviewGuards,
    progressGuard,
    updates || '    null;',
    'end $tec_idiomas_v3_correction$;',
    'commit;',
    '',
  ].join('\n');
}

export function productionSnapshotToCourses(snapshot) {
  const requiredCollections = ['courses', 'units', 'lessons', 'exercises'];
  for (const name of requiredCollections) {
    if (!Array.isArray(snapshot?.[name])) throw new Error(`Snapshot de produção inválido: ${name} deve ser uma lista.`);
  }

  const languageByCode = new Map([
    ['TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'en-US'],
    ['TEC_SPANISH_FOUNDATIONS_V1', 'es-ES'],
    ['TEC_KOREAN_FOUNDATIONS_V1', 'ko-KR'],
  ]);
  const expectedCounts = new Map([
    ['TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', [4, 16, 112]],
    ['TEC_SPANISH_FOUNDATIONS_V1', [2, 8, 56]],
    ['TEC_KOREAN_FOUNDATIONS_V1', [2, 8, 56]],
  ]);
  const courseByCode = new Map(snapshot.courses.map((row) => [row.course_code, row]));
  if (courseByCode.size !== snapshot.courses.length || courseByCode.size !== languageByCode.size
      || [...languageByCode.keys()].some((code) => !courseByCode.has(code))) {
    throw new Error('Snapshot de produção inválido: cursos ausentes, extras ou duplicados.');
  }
  const assertUnique = (rows, key, label) => {
    const ids = new Set(rows.map((row) => row[key]));
    if (ids.size !== rows.length || rows.some((row) => typeof row[key] !== 'string' || !row[key])) {
      throw new Error(`Snapshot de produção inválido: ${label} com identificador ausente ou duplicado.`);
    }
  };
  assertUnique(snapshot.units, 'id', 'unidades');
  assertUnique(snapshot.lessons, 'id', 'aulas');
  assertUnique(snapshot.exercises, 'id', 'exercícios');

  for (const row of snapshot.courses) {
    if (row.content_version !== 1 || row.publication_status !== 'STAGING'
        || row.review_status !== 'PEDAGOGICAL_REVIEW_PENDING' || row.is_test_fixture !== false) {
      throw new Error(`Snapshot de produção inválido: estado inesperado para ${row.course_code}.`);
    }
  }
  const assertStaging = (rows, label) => {
    if (rows.some((row) => row.content_version !== 1 || row.publication_status !== 'STAGING'
        || row.review_status !== 'PEDAGOGICAL_REVIEW_PENDING')) {
      throw new Error(`Snapshot de produção inválido: estado inesperado em ${label}.`);
    }
  };
  assertStaging(snapshot.units, 'unidades');
  assertStaging(snapshot.lessons, 'aulas');
  assertStaging(snapshot.exercises, 'exercícios');

  const unitById = new Map(snapshot.units.map((row) => [row.id, row]));
  const lessonById = new Map(snapshot.lessons.map((row) => [row.id, row]));
  if (snapshot.units.some((row) => !courseByCode.has(row.course_code))
      || snapshot.lessons.some((row) => !unitById.has(row.unit_id))
      || snapshot.exercises.some((row) => !lessonById.has(row.lesson_id))) {
    throw new Error('Snapshot de produção inválido: relação órfã entre curso, unidade, aula ou exercício.');
  }

  const courses = [...languageByCode].map(([code, languageCode]) => {
    const row = courseByCode.get(code);
    const units = snapshot.units.filter((unit) => unit.course_code === code)
      .sort((a, b) => a.position - b.position)
      .map((unit) => ({
        id: unit.id,
        position: unit.position,
        title: unit.title,
        description: unit.description,
        content_version: unit.content_version,
        author: unit.author,
        publication_status: unit.publication_status,
        review_status: unit.review_status,
        lessons: snapshot.lessons.filter((lesson) => lesson.unit_id === unit.id)
          .sort((a, b) => a.position - b.position)
          .map((lesson) => ({
            id: lesson.id,
            unit_id: lesson.unit_id,
            position: lesson.position,
            title: lesson.title,
            introduction: lesson.introduction,
            xp_reward: lesson.xp_reward,
            content_version: lesson.content_version,
            author: lesson.author,
            publication_status: lesson.publication_status,
            review_status: lesson.review_status,
            exercises: snapshot.exercises.filter((exercise) => exercise.lesson_id === lesson.id)
              .sort((a, b) => a.position - b.position)
              .map((exercise) => ({
                id: exercise.id,
                lesson_id: exercise.lesson_id,
                position: exercise.position,
                exercise_type: exercise.exercise_type,
                instruction: exercise.instruction,
                prompt: exercise.prompt,
                options: exercise.options,
                word_bank: exercise.word_bank,
                left_items: exercise.left_items,
                right_items: exercise.right_items,
                audio_text: exercise.audio_text,
                accepted_answers: exercise.accepted_answers,
                answer_key: exercise.answer_key,
                explanation: exercise.explanation,
                content_version: exercise.content_version,
                author: exercise.author,
                publication_status: exercise.publication_status,
                review_status: exercise.review_status,
                skill_code: exercise.skill_code,
                difficulty_level: exercise.difficulty_level,
                dialogue_speaker: exercise.dialogue_speaker,
                dialogue_context: exercise.dialogue_context,
              })),
          })),
      }));
    const [expectedUnits, expectedLessons, expectedExercises] = expectedCounts.get(code);
    const lessonCount = units.reduce((sum, unit) => sum + unit.lessons.length, 0);
    const exerciseCount = units.reduce((sum, unit) => sum + unit.lessons.reduce((n, lesson) => n + lesson.exercises.length, 0), 0);
    if (units.length !== expectedUnits || lessonCount !== expectedLessons || exerciseCount !== expectedExercises) {
      throw new Error(`Snapshot de produção inválido: contagem inesperada para ${code}.`);
    }
    return {
      course: {
        code,
        languageCode,
        version: row.content_version,
        title: row.title,
        description: row.description,
        author: row.author,
        xp_per_lesson: row.xp_per_lesson,
        publication_status: row.publication_status,
        review_status: row.review_status,
      },
      units,
    };
  });
  if (snapshot.units.length !== 8 || snapshot.lessons.length !== 32 || snapshot.exercises.length !== 224) {
    throw new Error('Snapshot de produção inválido: o pacote deve conter exatamente 8 unidades, 32 aulas e 224 exercícios.');
  }
  return courses;
}

function loadBaselineCourses() {
  const snapshotPath = process.env.TEC_IDIOMAS_V3_BASELINE_SNAPSHOT;
  if (snapshotPath) {
    return productionSnapshotToCourses(JSON.parse(readFileSync(snapshotPath, 'utf8')));
  }
  const baselineSha = process.env.TEC_IDIOMAS_V3_BASELINE_SHA;
  if (!baselineSha || !/^[a-f0-9]{40}$/i.test(baselineSha)) {
    throw new Error('Defina TEC_IDIOMAS_V3_BASELINE_SNAPSHOT com a exportação exata da produção ou TEC_IDIOMAS_V3_BASELINE_SHA explicitamente para uma fixture descartável.');
  }
  const stemByCode = new Map([
    ['TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'tec-english-foundations-v2-expansion'],
    ['TEC_SPANISH_FOUNDATIONS_V1', 'tec-spanish-foundations-v1'],
    ['TEC_KOREAN_FOUNDATIONS_V1', 'tec-korean-foundations-v1'],
  ]);
  return [...stemByCode].map(([code, stem]) => {
    const file = `content/languages/generated/${stem}.json`;
    const json = execFileSync('git', ['show', `${process.env.TEC_IDIOMAS_V3_BASELINE_SHA ?? baselineSha}:${file}`], { cwd: root, encoding: 'utf8' });
    const course = JSON.parse(json);
    if (course.course.code !== code) throw new Error(`Baseline inesperado para ${code}`);
    return course;
  });
}

const specificAuditFindings = {
  'en-v2x-u1-l1-e6': [{ severity: 'P2', issue: 'A frase aceitava passagem só de ida e de ida e volta sem uma pista que distinguisse as duas.', correction: 'Acrescentada a pista “I will only travel one way.” e alternativas contrastivas.' }],
  'en-v2x-u1-l2-e6': [{ severity: 'P2', issue: 'Catch e board são respostas naturais para “___ the bus”; o gabarito reconhecia apenas catch.', correction: 'Ambas as respostas válidas agora são aceitas e as alternativas foram ajustadas.' }],
  'en-v2x-u4-l4-e3': [{ severity: 'P2', issue: '“Change to the next time” não era uma formulação natural em inglês neste contexto.', correction: 'Substituída por “change/switch to the next available time”.' }],
  'es-v1-u1-l1-e4': [{ severity: 'P2', issue: 'O áudio começava com duas saudações, tornando ambígua a pergunta sobre a saudação inicial.', correction: 'O áudio agora começa apenas com “Buenos días” e a pergunta identifica a saudação de horário.' }],
  'es-v1-u1-l2-e6': [{ severity: 'P2', issue: '“Me ___ Laura” permitia mais de uma leitura sem contexto suficiente.', correction: 'O enunciado agora explicita que a pessoa vai informar o próprio nome.' }],
  'es-v1-u1-l4-e2': [{ severity: 'P3', issue: '“Un agua” é possível em alguns pedidos, mas não ensinava claramente a unidade para iniciante.', correction: 'Reescrita como “Un vaso de agua, por favor.”' }],
  'es-v1-u1-l4-e7': [{ severity: 'P3', issue: 'A prática oral herdava a formulação ambígua do pedido de água.', correction: 'A frase oral foi atualizada junto com o modelo de pedido.' }],
  'ko-v1-u1-l1-e4': [{ severity: 'P2', issue: 'A tradução literal “vá em paz” não é uma equivalência natural de despedida em português.', correction: 'Atualizada para “tchau (dito a quem está indo embora)”.' }],
  'ko-v1-u1-l1-e5': [{ severity: 'P2', issue: 'O par de significado repetia a tradução literal pouco natural.', correction: 'O significado correspondente foi atualizado para a despedida contextual.' }],
  'ko-v1-u2-l2-e3': [{ severity: 'P2', issue: 'O enunciado em português misturava a palavra coreana escrita em Hangul sem transliteração.', correction: 'O prompt agora diz “um gimbap” em português; a resposta continua em Hangul.' }],
  'ko-v1-u2-l3-e1': [{ severity: 'P2', issue: 'A pista em português descrevia seguir em frente e depois virar à esquerda, mas a resposta coreana indicava apenas deslocar-se para a esquerda.', correction: 'A resposta correta agora diz 쭉 가다가 왼쪽으로 도세요. (“Siga em frente e depois vire à esquerda”), com distratores de direção oposta ou retorno.' }],
};

function auditQuestion(row) {
  if (row.change_status !== 'CHANGED') return {
    exercise_id: row.exercise_id, severity: 'NONE_FOUND', status: 'TECHNICAL_REVIEW_COMPLETE_HUMAN_REVIEW_PENDING',
    findings: [], proposed_correction: null, human_review_required: true,
  };
  const findings = [...(specificAuditFindings[row.exercise_id] ?? [])];
  if (row.type === 'MULTIPLE_CHOICE') {
    findings.unshift({ severity: 'P1', issue: 'O contexto exibido antes da resposta já continha o turno esperado e revelava o gabarito.', correction: 'Removido o turno de resposta; o contexto contém somente a fala anterior.' });
    findings.push({ severity: 'P3', issue: 'Os distratores anteriores eram distantes da situação e não avaliavam bem a escolha de resposta.', correction: 'Alternativas substituídas por respostas próximas e plausíveis; o prompt descreve a condição que diferencia a correta.' });
  }
  if (row.exercise_id === 'ko-v1-u1-l1-e1') findings.push({ severity: 'P2', issue: 'A resposta anterior misturava registro formal e informal.', correction: 'A resposta foi harmonizada para a forma educada “반갑습니다”.' });
  return {
    exercise_id: row.exercise_id, severity: findings[0]?.severity ?? 'P3', status: 'CORRECTED_BEFORE_HUMAN_REVIEW',
    findings, proposed_correction: row.before_after, human_review_required: true,
  };
}

function reviewQuestionRows(course, previousCourse = null) {
  const previousById = new Map((previousCourse ? reviewQuestionRows(previousCourse) : []).map((row) => [row.exercise_id, row]));
  return course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => {
    const row = {
    course_code: course.course.code, language_code: course.course.languageCode, content_version: course.course.version,
    unit: unit.title, lesson_id: lesson.id, lesson: lesson.title, objective: lesson.introduction.split('\n\n')[0].replace(/^Objetivo: /, ''),
    exercise_id: exercise.id, position: exercise.position, type: exercise.exercise_type, instruction: exercise.instruction,
    prompt: exercise.prompt, options: exercise.options, word_bank: exercise.word_bank, left_items: exercise.left_items,
    right_items: exercise.right_items, accepted_answers: exercise.accepted_answers, answer_key: exercise.answer_key,
    explanation: exercise.explanation, skill_code: exercise.skill_code, difficulty_level: exercise.difficulty_level,
    audio_text: exercise.audio_text, dialogue_speaker: exercise.dialogue_speaker, dialogue_context: exercise.dialogue_context,
    };
    const contentFingerprint = sha256(stable(row));
    const previous = previousById.get(row.exercise_id);
    const changed = Boolean(previous && previous.content_fingerprint !== contentFingerprint);
    const previousValues = previous ? Object.fromEntries(Object.keys(row).filter((key) => stable(row[key]) !== stable(previous[key])).map((key) => [key, previous[key]])) : null;
    const currentValues = changed ? Object.fromEntries(Object.keys(row).filter((key) => stable(row[key]) !== stable(previous[key])).map((key) => [key, row[key]])) : null;
    return { ...row, content_fingerprint: contentFingerprint, previous_fingerprint: previous?.content_fingerprint ?? null, change_status: changed ? 'CHANGED' : 'UNCHANGED', before_after: changed ? { before: previousValues, after: currentValues } : null };
  })));
}

function htmlEscape(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function buildReviewHtml(course, rows) {
  const embedded = JSON.stringify(rows).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('</script', '<\\/script');
  let html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Revisão offline — ${htmlEscape(course.course.title)}</title>
<style> :root{font:16px/1.5 system-ui,Segoe UI,sans-serif;color:#13253d;background:#f3f7fc}body{margin:0}header{position:sticky;top:0;background:#fff;border-bottom:1px solid #cbd7e7;padding:1rem 2vw;z-index:2}h1{font-size:1.5rem;margin:.1rem 0}.meta{color:#405b79;font-size:.9rem}.controls{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:.8rem}input,select,button{font:inherit;padding:.55rem .7rem;border:1px solid #b7c7da;border-radius:.55rem;background:white}button{cursor:pointer;font-weight:700}button[data-decision="APPROVE"]{border-color:#087a49;color:#087a49}button[data-decision="REQUEST_CHANGES"]{border-color:#a75a00;color:#8a4b00}button[data-decision="REJECT"]{border-color:#a52638;color:#a52638}main{max-width:1100px;margin:auto;padding:1rem}.question{background:#fff;border:1px solid #ced9e7;border-radius:.9rem;margin:1rem 0;padding:1rem;break-inside:avoid}.question h2{font-size:1.1rem;margin:.3rem 0}.pill{display:inline-block;background:#eaf2fc;border-radius:99px;padding:.15rem .5rem;margin:.1rem;font-size:.78rem}.answer{border-left:4px solid #087a49;background:#f0faf5;padding:.6rem;margin:.6rem 0}.note{width:min(100%,700px);min-height:3.4rem;display:block;margin:.6rem 0}.hidden{display:none}.actions{display:flex;flex-wrap:wrap;gap:.4rem}.status{font-weight:800}.status[data-state="APPROVE"]{color:#087a49}.status[data-state="REQUEST_CHANGES"]{color:#8a4b00}.status[data-state="REJECT"]{color:#a52638}.small{font-size:.82rem;color:#405b79} @media print{header{position:static}.controls,.actions,.note{display:none!important}.question{box-shadow:none;page-break-inside:avoid}body{background:#fff}}</style></head><body>
<header><h1>${htmlEscape(course.course.title)}</h1><div class="meta">${htmlEscape(course.course.code)} · versão ${course.course.version} · ${rows.length} exercícios · SHA-256 ${course.manifest.content_fingerprint}</div>
<div class="controls"><input id="search" type="search" placeholder="Pesquisar questão, lição ou habilidade"><select id="type"><option value="">Todos os tipos</option>${TYPES.map((type) => `<option>${type}</option>`).join('')}</select><select id="decision"><option value="">Todas as decisões</option><option value="NOT_REVIEWED">Não revisada</option><option value="APPROVE">Aprovada visualmente</option><option value="REQUEST_CHANGES">Solicitar alteração</option><option value="REJECT">Rejeitada</option></select><button id="export-json">Exportar decisões JSON</button><button id="export-md">Exportar Markdown</button><button onclick="window.print()">Imprimir</button></div><p class="small">Revisão offline. Nenhuma decisão é enviada ao sistema. Todas as questões começam como NÃO REVISADA. A revisão técnica/ChatGPT não substitui a aprovação pedagógica humana.</p></header><main id="list"></main>
<script>const rows=${embedded};const key='tec-idiomas-v3-review:${htmlEscape(course.course.code)}:${course.course.version}';let state=JSON.parse(localStorage.getItem(key)||'{}');const list=document.querySelector('#list');function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function fmt(v){return Array.isArray(v)?v.join(' · '):typeof v==='object'?JSON.stringify(v):String(v??'—')}function render(){const q=document.querySelector('#search').value.toLocaleLowerCase();const type=document.querySelector('#type').value;const decision=document.querySelector('#decision').value;list.innerHTML='';for(const r of rows){const s=state[r.exercise_id]||{decision:'NOT_REVIEWED',notes:''};const hay=[r.unit,r.lesson,r.exercise_id,r.prompt,r.instruction,r.skill_code,r.audio_text,JSON.stringify(r.dialogue_context)].join(' ').toLocaleLowerCase();if((q&&!hay.includes(q))||(type&&r.type!==type)||(decision&&s.decision!==decision))continue;const article=document.createElement('article');article.className='question';article.dataset.type=r.type;article.innerHTML='<div><span class="pill">'+esc(r.unit)+'</span><span class="pill">'+esc(r.lesson)+'</span><span class="pill">'+esc(r.type)+'</span><span class="pill">Dificuldade '+r.difficulty_level+'</span><span class="pill">'+esc(r.skill_code)+'</span></div><div class="small">ID '+esc(r.exercise_id)+' · Objetivo: '+esc(r.objective)+'</div><p><b>'+esc(r.instruction)+'</b></p><h2>'+esc(r.prompt)+'</h2><p>Alternativas/banco: '+esc(fmt(r.options.length?r.options:r.word_bank))+'</p><p>Pares: '+esc(fmt({left:r.left_items,right:r.right_items}))+'</p><p>Áudio: '+esc(r.audio_text||'—')+'</p><p>Diálogo: '+esc(fmt(r.dialogue_context))+'</p>'+(r.change_status==='CHANGED'?'<section class="change"><b>ALTERADO · '+esc(r.exercise_id)+'</b><pre>'+esc(JSON.stringify(r.before_after,null,2))+'</pre></section>':'')+(r.audit.findings.length?'<section class="audit"><b>Achados automáticos · '+esc(r.audit.severity)+'</b>'+r.audit.findings.map(f=>'<p><b>'+esc(f.issue)+'</b><br>Proposta: '+esc(f.correction)+'</p>').join('')+'</section>':'<p class="small">Nenhum defeito concreto encontrado nesta triagem; revisão humana necessária.</p>')+'<div class="answer"><b>Gabarito:</b> '+esc(fmt(r.answer_key))+'<br><b>Respostas aceitas:</b> '+esc(fmt(r.accepted_answers))+'<br><b>Explicação:</b> '+esc(r.explanation)+'</div><p class="status" data-state="'+esc(s.decision)+'">Decisão: '+(s.decision==='NOT_REVIEWED'?'NÃO REVISADA':esc(s.decision))+'</p><textarea class="note" aria-label="Observações para '+esc(r.exercise_id)+'" placeholder="Observações da revisão">'+esc(s.notes)+'</textarea><div class="actions"><button data-decision="APPROVE">Aprovar</button><button data-decision="REQUEST_CHANGES">Solicitar correção</button><button data-decision="REJECT">Rejeitar</button></div>';article.querySelectorAll('[data-decision]').forEach(b=>b.addEventListener('click',()=>{state[r.exercise_id]={decision:b.dataset.decision,notes:article.querySelector('textarea').value};localStorage.setItem(key,JSON.stringify(state));render()}));article.querySelector('textarea').addEventListener('input',e=>{state[r.exercise_id]={...(state[r.exercise_id]||{decision:'NOT_REVIEWED'}),notes:e.target.value};localStorage.setItem(key,JSON.stringify(state))});list.append(article)}if(!list.children.length)list.textContent='Nenhum exercício corresponde aos filtros.'}function download(name,type,content){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}document.querySelectorAll('#search,#type,#decision').forEach(e=>e.addEventListener('input',render));document.querySelector('#export-json').onclick=()=>download('revisao-${course.course.code}-v${course.course.version}.json','application/json',JSON.stringify({course:'${course.course.code}',version:${course.course.version},fingerprint:'${course.manifest.content_fingerprint}',decisions:state},null,2));document.querySelector('#export-md').onclick=()=>download('revisao-${course.course.code}-v${course.course.version}.md','text/markdown',rows.map(r=>{const s=state[r.exercise_id]||{decision:'NOT_REVIEWED',notes:''};return '## '+r.lesson+' — '+r.exercise_id+'\n\n**Tipo:** '+r.type+' · **Habilidade:** '+r.skill_code+' · **Dificuldade:** '+r.difficulty_level+'\n\n**Questão:** '+r.prompt+'\n\n**Gabarito:** '+JSON.stringify(r.answer_key)+'\n\n**Explicação:** '+r.explanation+'\n\n**Decisão:** '+s.decision+'\n\n**Observações:** '+(s.notes||'')}).join('\n\n---\n\n'));render();</script></main></body></html>`;
  const previousFingerprints = JSON.stringify(Object.fromEntries(rows.map((row) => [row.exercise_id, row.previous_fingerprint])));
  html = html.replace("let state=JSON.parse(localStorage.getItem(key)||'{}');", "const saved=JSON.parse(localStorage.getItem(key)||'{}');const previousFingerprints=" + previousFingerprints + ";let state={};for(const row of rows){const old=saved[row.exercise_id];if(old&&((old.fingerprint===row.content_fingerprint)||(old.fingerprint===undefined&&previousFingerprints[row.exercise_id]===row.content_fingerprint)))state[row.exercise_id]={...old,fingerprint:row.content_fingerprint};else state[row.exercise_id]={decision:'NOT_REVIEWED',notes:'',fingerprint:row.content_fingerprint}}");
  html = html.replace("state[r.exercise_id]={decision:b.dataset.decision,notes:article.querySelector('textarea').value};", "state[r.exercise_id]={decision:b.dataset.decision,notes:article.querySelector('textarea').value,fingerprint:r.content_fingerprint};");
  html = html.replace("state[r.exercise_id]={...(state[r.exercise_id]||{decision:'NOT_REVIEWED'}),notes:e.target.value};", "state[r.exercise_id]={...(state[r.exercise_id]||{decision:'NOT_REVIEWED'}),notes:e.target.value,fingerprint:r.content_fingerprint};");
  html = html.replace("'<p>Diálogo: '+esc(fmt(r.dialogue_context))+'</p><div class=\"answer\">", "'<p>Diálogo: '+esc(fmt(r.dialogue_context))+'</p>'+(r.change_status==='CHANGED'?'<section class=\"change\"><b>ALTERADO · '+esc(r.exercise_id)+'</b><pre>'+esc(JSON.stringify(r.before_after,null,2))+'</pre></section>':'')+'<div class=\"answer\">'");
  html = html.replace('.answer{border-left:', '.change{border:2px solid #a75a00;background:#fff8e8;padding:.65rem;margin:.6rem 0;overflow:auto}.change pre{white-space:pre-wrap}.audit{border-left:4px solid #a75a00;background:#fff8e8;padding:.6rem;margin:.6rem 0}.answer{border-left:');
  return html;
}

function buildReviewMarkdown(course, rows) {
  const sections = rows.map((row) => [
    `## ${row.lesson} — ${row.exercise_id}`,
    `**Unidade:** ${row.unit}`,
    `**Tipo:** ${row.type} · **Habilidade:** ${row.skill_code} · **Dificuldade:** ${row.difficulty_level}`,
    row.change_status === 'CHANGED' ? `**ALTERADO · ANTES/DEPOIS:** ${JSON.stringify(row.before_after)}` : '**Conteúdo:** sem alteração em relação à versão anterior.',
    `**Triagem automática:** ${row.audit.severity} · ${row.audit.status}`,
    row.audit.findings.length ? row.audit.findings.map((finding) => `- **${finding.severity}:** ${finding.issue} Proposta: ${finding.correction}`).join('\n') : 'Nenhum defeito concreto encontrado nesta triagem; revisão pedagógica humana continua necessária.',
    `**Instrução:** ${row.instruction}`,
    `**Questão:** ${row.prompt}`,
    `**Alternativas/banco:** ${JSON.stringify(row.options.length ? row.options : row.word_bank)}`,
    `**Pares:** ${JSON.stringify({ left: row.left_items, right: row.right_items })}`,
    `**Áudio:** ${row.audio_text ?? '—'}`,
    `**Diálogo:** ${JSON.stringify(row.dialogue_context)}`,
    `**Gabarito:** ${JSON.stringify(row.answer_key)}`,
    `**Respostas aceitas:** ${JSON.stringify(row.accepted_answers)}`,
    `**Explicação:** ${row.explanation}`,
    '**Decisão inicial:** NÃO REVISADA',
    '**Observações:**',
  ].join('\n')).join('\n\n---\n\n');
  return `# ${course.course.title} — revisão pedagógica offline\n\nCurso: \`${course.course.code}\` · Versão: ${course.course.version} · Fingerprint SHA-256: \`${course.manifest.content_fingerprint}\` · Exercícios: ${rows.length} · Status: STAGING / PEDAGOGICAL_REVIEW_PENDING\n\nCada decisão começa como NÃO REVISADA. Este documento não registra aprovação no banco.\n\n${sections}\n`;
}

export async function generateArtifacts(compiled = compileCourses(), { outputRoot = privateRoot, previousCourses = loadBaselineCourses(), expectedProductionFingerprints = JSON.parse(process.env.TEC_IDIOMAS_V3_EXPECTED_FINGERPRINTS ?? '{}') } = {}) {
  const errors = validateCourses(compiled);
  if (errors.length) throw new Error(`Validação de conteúdo falhou:\n${errors.join('\n')}`);
  const generatedDir = path.join(outputRoot, 'generated');
  const reportsDir = path.join(outputRoot, 'reports');
  const previousByCode = new Map(previousCourses.map((item) => [item.course.code, item]));
  await mkdir(generatedDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  let changedQuestions = 0;
  const changeReport = [];
  for (const course of compiled) {
    const stem = course.course.code.toLowerCase().replaceAll('_', '-');
    const rows = reviewQuestionRows(course, previousByCode.get(course.course.code) ?? null);
    const audit = rows.map(auditQuestion);
    const auditById = new Map(audit.map((item) => [item.exercise_id, item]));
    const reviewRows = rows.map((row) => ({ ...row, audit: auditById.get(row.exercise_id) }));
    changedQuestions += rows.filter((row) => row.change_status === 'CHANGED').length;
    const previousExercises = new Map((previousByCode.get(course.course.code)?.units ?? []).flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => [exercise.id, exercise]))));
    for (const lesson of course.units.flatMap((unit) => unit.lessons)) for (const exercise of lesson.exercises) {
      const previous = previousExercises.get(exercise.id);
      const fields = ['instruction','prompt','options','word_bank','left_items','right_items','audio_text','accepted_answers','answer_key','explanation','dialogue_speaker','dialogue_context'].filter((field) => stable(previous?.[field]) !== stable(exercise[field]));
      if (fields.length) changeReport.push({ course_code: course.course.code, exercise_id: exercise.id, changed_fields: fields, publication_status: exercise.publication_status, review_status: exercise.review_status, human_review_required: true });
    }
    await writeFile(path.join(generatedDir, `${stem}.json`), `${JSON.stringify(course, null, 2)}\n`, 'utf8');
    await writeFile(path.join(reportsDir, `${stem}-v${course.course.version}.html`), buildReviewHtml(course, reviewRows), 'utf8');
    await writeFile(path.join(reportsDir, `${stem}-v${course.course.version}.json`), `${JSON.stringify({ course: course.course, fingerprint: course.manifest.content_fingerprint, questions: reviewRows.map((r) => ({ ...r, decision: 'NOT_REVIEWED', notes: '' })), audit }, null, 2)}\n`, 'utf8');
    await writeFile(path.join(reportsDir, `${stem}-v${course.course.version}.md`), buildReviewMarkdown(course, reviewRows), 'utf8');
  }
  await writeFile(path.join(generatedDir, 'tec-idiomas-v3-content.generated.sql'), generateInsertSql(compiled), 'utf8');
  await writeFile(path.join(generatedDir, 'tec-idiomas-v3-staging-correction.sql'), generateCorrectionSql(previousCourses, compiled, { expectedProductionFingerprints }), 'utf8');
  const summary = compiled.map(({ course, manifest }) => `${course.code}: ${manifest.lesson_count} lições, ${manifest.exercise_count} exercícios, SHA-256 ${manifest.content_fingerprint}`).join('\n');
  const korean = compiled.find((course) => course.course.languageCode === 'ko-KR');
  const specialistReview = korean?.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => ({ exercise_id: exercise.id, status: 'SPECIALIST_REVIEW_REQUIRED', human_review_required: true })))) ?? [];
  await writeFile(path.join(reportsDir, 'tec-idiomas-v34-change-report.json'), `${JSON.stringify({ changed_question_count: changeReport.length, changed_field_count: changeReport.reduce((sum, row) => sum + row.changed_fields.length, 0), questions: changeReport }, null, 2)}\n`, 'utf8');
  const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const changeCsv = ['course_code,exercise_id,changed_fields,publication_status,review_status,human_review_required', ...changeReport.map((row) => [row.course_code, row.exercise_id, row.changed_fields.join('|'), row.publication_status, row.review_status, row.human_review_required].map(csvCell).join(','))].join('\n');
  await writeFile(path.join(reportsDir, 'tec-idiomas-v34-changed-exercise-ids.csv'), `${changeCsv}\n`, 'utf8');
  await writeFile(path.join(reportsDir, 'tec-idiomas-v34-korean-specialist-review.json'), `${JSON.stringify({ course_code: korean?.course.code, status: 'PEDAGOGICAL_REVIEW_PENDING', question_count: specialistReview.length, questions: specialistReview }, null, 2)}\n`, 'utf8');
  const productionFingerprintSummary = Object.entries(expectedProductionFingerprints).map(([code, fingerprint]) => `${code}: ${fingerprint}`).join('\n');
  await writeFile(path.join(reportsDir, 'README.md'), `# Tec Idiomas V3.4 — reconciliação privada com produção\n\nEste pacote contém gabaritos e deve permanecer em armazenamento privado com acesso restrito a revisores autorizados. Não copiar para o repositório público, \`public/\` ou bundle da aplicação. Os HTMLs funcionam offline e preservam decisões somente quando o fingerprint individual da questão não mudou. Questões alteradas exibem comparação antes/depois.\n\n${summary}\n\nFingerprints atuais lidos da produção (somente para precondição do SQL):\n\n${productionFingerprintSummary}\n\nQuestões alteradas: ${changedQuestions}. Todas começam como \`NOT_REVIEWED\`; nenhuma aprovação humana foi registrada. Os 56 exercícios coreanos seguem pendentes de revisão especializada. A aula introdutória \`ko-v1-u1-l1\` foi preservada conforme o conteúdo atual de produção.\n`, 'utf8');
  return { courses: compiled.length, lessons: compiled.reduce((n, c) => n + c.manifest.lesson_count, 0), exercises: compiled.reduce((n, c) => n + c.manifest.exercise_count, 0), changedQuestions, changedFields: changeReport.reduce((sum, row) => sum + row.changed_fields.length, 0), reportsDir, generatedDir };
}

async function main() {
  const compiled = compileCourses();
  const errors = validateCourses(compiled);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  const requested = process.argv[2] ?? 'generate';
  if (requested === 'validate' || requested === '--check') {
    for (const item of compiled) console.log(`${item.course.code}: PASS ${item.manifest.lesson_count} lessons / ${item.manifest.exercise_count} exercises / ${item.manifest.content_fingerprint}`);
    return;
  }
  const result = await generateArtifacts(compiled);
  console.log(`Generated ${result.courses} courses, ${result.lessons} lessons, ${result.exercises} exercises.`);
  console.log(`Review packages: ${result.reportsDir}`);
  console.log(`Private SQL/JSON: ${result.generatedDir}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
