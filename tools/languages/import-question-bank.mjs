#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PRIVATE_ROOT = path.join(process.env.LOCALAPPDATA ?? os.tmpdir(), 'TecEscola', 'private', 'language-imports');
const EXERCISE_TYPES = new Set(['MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING']);
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const DATA_LICENSES = new Set(['CC0-1.0', 'CC-BY-2.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'MIT']);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const clean = (value) => String(value ?? '').normalize('NFKC').trim();
const normalizedText = (value) => clean(value).toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else field += character;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field.length || row.length) { row.push(field); if (row.some((cell) => cell.trim() !== '')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim().replace(/^\uFEFF/, ''));
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) throw new Error('CSV headers must be non-empty and unique.');
  return rows.map((cells, rowIndex) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${rowIndex + 2} has ${cells.length} cells; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  });
}

function parseInput(text, inputPath) {
  const extension = path.extname(inputPath).toLocaleLowerCase();
  if (extension === '.csv') return parseCsv(text);
  if (extension === '.jsonl' || extension === '.ndjson') {
    return text.split(/\r?\n/u).map((line, index) => {
      if (!line.trim()) return null;
      try { return JSON.parse(line); } catch { throw new Error(`Invalid JSONL at line ${index + 1}.`); }
    }).filter(Boolean);
  }
  if (extension === '.json') {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed.exercises)) return parsed.exercises;
    throw new Error('JSON input must be an array or contain a questions/exercises array.');
  }
  throw new Error('Supported input formats: .csv, .json, .jsonl, .ndjson.');
}

function parseJsonField(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return value;
  try { return JSON.parse(value); } catch { throw new Error(`${field} must contain valid JSON.`); }
}

function requireText(record, field, label = field) {
  const value = clean(record[field]);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function normalizeRecord(record, index) {
  const id = requireText(record, 'id', `row ${index + 1}: id`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(id)) throw new Error(`${id}: id must be a stable 3–128 character identifier.`);
  const languageCode = requireText(record, 'language_code', `${id}: language_code`);
  if (!LANGUAGE_TAG.test(languageCode)) throw new Error(`${id}: language_code must be a BCP-47 tag such as en-US.`);
  const level = Number(record.level);
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error(`${id}: level must be an integer from 1 to 5.`);
  const exerciseType = requireText(record, 'exercise_type', `${id}: exercise_type`).toUpperCase();
  if (!EXERCISE_TYPES.has(exerciseType)) throw new Error(`${id}: unsupported exercise_type ${exerciseType}.`);
  const license = requireText(record, 'license', `${id}: license`).toUpperCase();
  if (!DATA_LICENSES.has(license)) throw new Error(`${id}: data license ${license} is not in the approved commercial-use allowlist.`);
  const sourceUrl = requireText(record, 'source_url', `${id}: source_url`);
  let parsedSourceUrl;
  try { parsedSourceUrl = new URL(sourceUrl); } catch { throw new Error(`${id}: source_url is invalid.`); }
  if (parsedSourceUrl.protocol !== 'https:') throw new Error(`${id}: source_url must use HTTPS.`);
  const source = requireText(record, 'source', `${id}: source`);
  const sourceId = requireText(record, 'source_id', `${id}: source_id`);
  const attribution = clean(record.attribution);
  if (license.startsWith('CC-BY') && !attribution) throw new Error(`${id}: attribution is required for ${license}.`);
  const options = parseJsonField(record.options, 'options', []);
  const acceptedAnswers = parseJsonField(record.accepted_answers, 'accepted_answers', []);
  const answerKey = parseJsonField(record.answer_key, 'answer_key', {});
  const context = parseJsonField(record.context ?? record.dialogue_context, 'context', []);
  const wordBank = parseJsonField(record.word_bank, 'word_bank', []);
  const leftItems = parseJsonField(record.left_items, 'left_items', []);
  const rightItems = parseJsonField(record.right_items, 'right_items', []);
  for (const [field, value] of Object.entries({ options, accepted_answers: acceptedAnswers, word_bank: wordBank, left_items: leftItems, right_items: rightItems })) {
    if (!Array.isArray(value)) throw new Error(`${id}: ${field} must be an array.`);
    if (value.some((item) => typeof item !== 'string' || !item.trim())) throw new Error(`${id}: ${field} must contain only non-empty strings.`);
  }
  if (!answerKey || typeof answerKey !== 'object' || Array.isArray(answerKey)) throw new Error(`${id}: answer_key must be an object.`);
  if (!Array.isArray(context)) throw new Error(`${id}: context must be an array of dialogue turns.`);
  if (!Array.isArray(acceptedAnswers) || !acceptedAnswers.length) throw new Error(`${id}: accepted_answers must contain at least one answer.`);
  if (exerciseType !== 'MATCHING' && stable(acceptedAnswers) !== stable(Array.isArray(answerKey.accepted) ? answerKey.accepted : [])) throw new Error(`${id}: accepted_answers and answer_key.accepted must match exactly.`);
  if (exerciseType === 'MULTIPLE_CHOICE' && (options.length < 3 || !acceptedAnswers.every((answer) => options.includes(answer)))) throw new Error(`${id}: multiple choice needs at least three options containing every accepted answer.`);
  if (exerciseType === 'FILL_BLANK' && (options.length < 3 || !acceptedAnswers.every((answer) => options.includes(answer)))) throw new Error(`${id}: fill blank needs at least three options containing every accepted answer.`);
  if (['MULTIPLE_CHOICE', 'FILL_BLANK'].includes(exerciseType) && new Set(options.map(normalizedText)).size !== options.length) throw new Error(`${id}: options contain duplicate normalized choices.`);
  if (exerciseType === 'WORD_ORDER' && wordBank.length < 2) throw new Error(`${id}: word order needs a shuffled word_bank with at least two items.`);
  if (exerciseType === 'LISTENING' && !clean(record.audio_text)) throw new Error(`${id}: listening exercise needs audio_text.`);
  if (exerciseType === 'MATCHING' && (leftItems.length < 2 || leftItems.length !== rightItems.length || !answerKey.pairs || Object.keys(answerKey.pairs).length !== leftItems.length)) throw new Error(`${id}: matching exercise needs paired items and an answer_key.pairs object.`);
  const prompt = requireText(record, 'prompt', `${id}: prompt`);
  const explanation = requireText(record, 'explanation', `${id}: explanation`);
  const instruction = requireText(record, 'instruction', `${id}: instruction`);
  const lessonId = requireText(record, 'lesson_id', `${id}: lesson_id`);
  const lessonTitle = requireText(record, 'lesson_title', `${id}: lesson_title`);
  const courseCode = requireText(record, 'course_code', `${id}: course_code`).toUpperCase();
  const skillCode = requireText(record, 'skill_code', `${id}: skill_code`).toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(skillCode)) throw new Error(`${id}: skill_code is invalid.`);
  const dialogueText = Array.isArray(context) ? context.map((turn) => clean(turn?.text)).join(' ') : '';
  if (context.some((turn) => !turn || typeof turn !== 'object' || !clean(turn.speaker) || !clean(turn.text))) throw new Error(`${id}: every context turn needs a speaker and text.`);
  const answerTexts = [...acceptedAnswers, ...(Array.isArray(answerKey.accepted) ? answerKey.accepted : [])].map(clean).filter(Boolean);
  if (exerciseType === 'MULTIPLE_CHOICE' && answerTexts.some((answer) => containsAnswer(dialogueText, answer))) throw new Error(`${id}: the pre-answer dialogue contains the expected answer.`);
  const content = {
    id, course_code: courseCode, language_code: languageCode, level, lesson_id: lessonId,
    lesson_title: lessonTitle, skill_code: skillCode, exercise_type: exerciseType, instruction, prompt,
    context, options, word_bank: wordBank, left_items: leftItems, right_items: rightItems,
    audio_text: clean(record.audio_text) || null, accepted_answers: acceptedAnswers, answer_key: answerKey,
    explanation, source, source_url: parsedSourceUrl.href, source_id: sourceId, license,
    attribution: attribution || null,
  };
  const fingerprintPayload = { ...content };
  content.fingerprint = sha256(stable(fingerprintPayload));
  content.dedupe_fingerprint = sha256(stable({
    course_code: courseCode, language_code: languageCode, exercise_type: exerciseType,
    prompt, options, word_bank: wordBank, left_items: leftItems, right_items: rightItems,
    audio_text: clean(record.audio_text) || null, accepted_answers: acceptedAnswers,
    answer_key: answerKey, context, explanation,
  }));
  content.provenance = {
    source, source_url: parsedSourceUrl.href, source_id: sourceId,
    license, attribution: attribution || null,
  };
  return content;
}

function containsAnswer(context, answer) {
  const words = (value) => clean(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const haystack = words(context);
  const needle = words(answer);
  return needle.length > 0 && needle.length <= haystack.length && haystack.some((_, start) => needle.every((word, offset) => haystack[start + offset] === word));
}

export function validateAndDeduplicate(records) {
  const accepted = [];
  const ids = new Map();
  const prompts = new Map();
  const exact = new Set();
  const duplicates = [];
  for (let index = 0; index < records.length; index += 1) {
    const question = normalizeRecord(records[index], index);
    const previousId = ids.get(question.id);
    if (previousId) {
      if (previousId.fingerprint !== question.fingerprint) throw new Error(`${question.id}: conflicting records reuse the same id.`);
      duplicates.push({ id: question.id, reason: 'IDENTICAL_ID_AND_FINGERPRINT' });
      continue;
    }
    const promptKey = `${question.language_code}:${question.exercise_type}:${normalizedText(question.prompt)}`;
    const previousPrompt = prompts.get(promptKey);
    if (previousPrompt) {
      if (previousPrompt.dedupe_fingerprint !== question.dedupe_fingerprint) throw new Error(`${question.id}: duplicate normalized prompt conflicts with ${previousPrompt.id}.`);
      duplicates.push({ id: question.id, reason: 'IDENTICAL_PROMPT_AND_CONTENT', duplicate_of: previousPrompt.id });
      continue;
    }
    if (exact.has(question.dedupe_fingerprint)) {
      duplicates.push({ id: question.id, reason: 'IDENTICAL_FINGERPRINT' });
      continue;
    }
    ids.set(question.id, question);
    prompts.set(promptKey, question);
    exact.add(question.dedupe_fingerprint);
    accepted.push(question);
  }
  return { questions: accepted, duplicates };
}

async function ensureOutsideRepository(target) {
  const resolved = path.resolve(target);
  const repositoryRoot = await realpath(REPO_ROOT);
  let existingPath = resolved;
  const missingSegments = [];
  let actualPath;
  while (!actualPath) {
    try {
      actualPath = path.resolve(await realpath(existingPath), ...missingSegments);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      const parent = path.dirname(existingPath);
      if (parent === existingPath) throw error;
      missingSegments.unshift(path.basename(existingPath));
      existingPath = parent;
    }
  }
  const relative = path.relative(repositoryRoot, actualPath);
  const isInsideRepository = relative === ''
    || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  if (isInsideRepository) {
    throw new Error('Private output must be outside the repository to prevent answer keys entering Git or the public bundle.');
  }
  return resolved;
}

export async function importQuestionBank({ inputPath, outputDir = PRIVATE_ROOT }) {
  const raw = await readFile(inputPath, 'utf8');
  const parsed = parseInput(raw, inputPath);
  if (!parsed.length) throw new Error('Input contains no question rows.');
  const { questions, duplicates } = validateAndDeduplicate(parsed);
  if (!questions.length) throw new Error('Input contains no unique valid questions.');
  const privateDir = await ensureOutsideRepository(outputDir);
  await mkdir(privateDir, { recursive: true });
  const privatePath = path.join(privateDir, 'question-bank-review.json');
  const publicManifestPath = path.join(privateDir, 'question-bank-manifest.json');
  const manifestQuestions = questions.map((question) => ({
    id: question.id,
    course_code: question.course_code,
    language_code: question.language_code,
    level: question.level,
    lesson_id: question.lesson_id,
    exercise_type: question.exercise_type,
    source: question.source,
    source_url: question.source_url,
    source_id: question.source_id,
    license: question.license,
    attribution: question.attribution,
    option_count: question.options.length,
    public_fingerprint: sha256(stable({
      id: question.id, course_code: question.course_code, language_code: question.language_code,
      level: question.level, lesson_id: question.lesson_id, exercise_type: question.exercise_type,
      source: question.source, source_url: question.source_url, source_id: question.source_id,
      license: question.license, attribution: question.attribution,
    })),
  }));
  await writeFile(privatePath, `${JSON.stringify({ format: 'tec-language-question-review-v1', created_at: new Date().toISOString(), question_count: questions.length, duplicate_count: duplicates.length, duplicates, questions }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await writeFile(publicManifestPath, `${JSON.stringify({ format: 'tec-language-question-manifest-v1', question_count: manifestQuestions.length, content_fingerprint: sha256(stable(manifestQuestions)), questions: manifestQuestions }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { inputCount: parsed.length, importedCount: questions.length, duplicateCount: duplicates.length, privatePath, publicManifestPath };
}

async function main() {
  const [inputPath, outputDir] = process.argv.slice(2);
  if (!inputPath || process.argv.includes('--help')) {
    console.log('Usage: node tools/languages/import-question-bank.mjs <input.csv|json|jsonl> [private-output-directory]');
    process.exitCode = inputPath ? 0 : 2;
    return;
  }
  try {
    const result = await importQuestionBank({ inputPath, outputDir });
    console.log(`INPUT_ROWS=${result.inputCount}`);
    console.log(`QUESTIONS_IMPORTED=${result.importedCount}`);
    console.log(`DUPLICATES_REMOVED=${result.duplicateCount}`);
    console.log(`PRIVATE_REVIEW=${result.privatePath}`);
    console.log(`MANIFEST=${result.publicManifestPath}`);
  } catch (error) {
    console.error(`IMPORT_FAILED=${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
