import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importQuestionBank } from './import-question-bank.mjs';

const API_ORIGIN = 'https://api.tatoeba.org';
const SOURCE_URL = 'https://tatoeba.org';
const API_SENTENCES = `${API_ORIGIN}/v1/sentences`;
const MAX_PAGE_SIZE = 50;
const MAX_CANDIDATES = 2000;

export const TATOEBA_TARGETS = Object.freeze({
  en: { source: 'por', target: 'eng', languageCode: 'en-US', languageName: 'inglês', courseCode: 'TEC_ENGLISH_FOUNDATIONS_V5_CANDIDATES' },
  es: { source: 'por', target: 'spa', languageCode: 'es-ES', languageName: 'espanhol', courseCode: 'TEC_SPANISH_FOUNDATIONS_CANDIDATES' },
  ko: { source: 'por', target: 'kor', languageCode: 'ko-KR', languageName: 'coreano', courseCode: 'TEC_KOREAN_FOUNDATIONS_CANDIDATES' },
  fr: { source: 'eng', target: 'fra', languageCode: 'fr-FR', languageName: 'francês', courseCode: 'TEC_FRENCH_FOUNDATIONS_CANDIDATES' },
  de: { source: 'eng', target: 'deu', languageCode: 'de-DE', languageName: 'alemão', courseCode: 'TEC_GERMAN_FOUNDATIONS_CANDIDATES' },
  it: { source: 'eng', target: 'ita', languageCode: 'it-IT', languageName: 'italiano', courseCode: 'TEC_ITALIAN_FOUNDATIONS_CANDIDATES' },
  ja: { source: 'eng', target: 'jpn', languageCode: 'ja-JP', languageName: 'japonês', courseCode: 'TEC_JAPANESE_FOUNDATIONS_CANDIDATES' },
  zh: { source: 'eng', target: 'cmn', languageCode: 'zh-CN', languageName: 'mandarim', courseCode: 'TEC_MANDARIN_FOUNDATIONS_CANDIDATES' },
});

const clean = (value) => String(value ?? '').normalize('NFKC').trim();
const stableAnswers = (answers) => [...new Set(answers.map(clean).filter(Boolean))].sort((left, right) => left.localeCompare(right));
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const normalizedText = (value) => clean(value).toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();

function promptKey(question) {
  return `${question.language_code}:${question.exercise_type}:${normalizedText(question.prompt)}`;
}

function answerFingerprint(question) {
  return stable({
    course_code: question.course_code, language_code: question.language_code, exercise_type: question.exercise_type,
    prompt: question.prompt, options: question.options, word_bank: question.word_bank,
    left_items: question.left_items, right_items: question.right_items, audio_text: question.audio_text,
    accepted_answers: question.accepted_answers, answer_key: question.answer_key,
    context: question.context, explanation: question.explanation,
  });
}

function normalizeLicense(value) {
  if (value === 'CC BY 2.0 FR') return 'CC-BY-2.0';
  if (value === 'CC0 1.0') return 'CC0-1.0';
  return null;
}

function eligibleSentence(sentence, languageCode) {
  return Boolean(sentence
    && Number.isInteger(sentence.id)
    && sentence.lang === languageCode
    && clean(sentence.text)
    && sentence.is_unapproved === false
    && normalizeLicense(sentence.license)
    && (sentence.license === 'CC0 1.0' || clean(sentence.owner)));
}

export function adaptTatoebaSentences(sentences, targetKey) {
  const target = TATOEBA_TARGETS[targetKey];
  if (!target) throw new Error(`Unsupported Tatoeba target: ${targetKey}.`);
  if (!Array.isArray(sentences)) throw new Error('Tatoeba API data must be an array of sentences.');

  const records = [];
  for (const sentence of sentences) {
    if (!eligibleSentence(sentence, target.source)) continue;
    const translations = (Array.isArray(sentence.translations) ? sentence.translations : [])
      .filter((translation) => eligibleSentence(translation, target.target)
        && translation.is_direct === true)
      .sort((left, right) => left.id - right.id);
    if (!translations.length) continue;

    // Treat each sentence pair as one answer candidate. Other translations may
    // be equally valid but are kept out of the automatic answer key until review.
    const translation = translations[0];
    const acceptedAnswers = stableAnswers([translation.text]);
    if (acceptedAnswers.length !== 1) continue;
    const sourceLicense = normalizeLicense(sentence.license);
    const license = [sourceLicense, normalizeLicense(translation.license)].includes('CC-BY-2.0') ? 'CC-BY-2.0' : 'CC0-1.0';
    const sourceId = `tatoeba:${sentence.id}:${translation.id}`;
    const sourcePage = `${SOURCE_URL}/${target.source}/sentences/show/${sentence.id}`;
    const translationPage = `${SOURCE_URL}/${target.target}/sentences/show/${translation.id}`;
    const attribution = license === 'CC-BY-2.0'
      ? `Tatoeba (CC BY 2.0 FR). Sentença ${sentence.id} por ${sentence.owner ?? 'autor CC0'}: ${sourcePage}. Tradução ${translation.id} por ${translation.owner ?? 'autor CC0'}: ${translationPage}.`
      : `Tatoeba (CC0 1.0). Sentença ${sentence.id}: ${sourcePage}; tradução ${translation.id}: ${translationPage}.`;
    const reviewFlags = [
      'PEDAGOGICAL_REVIEW_REQUIRED',
      'CEFR_LEVEL_UNVERIFIED',
      ...(translations.length > 1 ? ['ALTERNATIVE_TRANSLATIONS_REQUIRE_REVIEW'] : []),
      ...(targetKey === 'ja' ? ['CHECK_HIRAGANA_KATAKANA_SEQUENCE'] : []),
      ...(targetKey === 'zh' ? ['ADD_AND_REVIEW_PINYIN_TONES'] : []),
      ...(targetKey === 'ko' ? ['CHECK_HANGUL_BEGINNER_SEQUENCE'] : []),
    ];

    records.push({
      id: `tatoeba-${targetKey}-${sentence.id}-${translation.id}`,
      course_code: target.courseCode,
      language_code: target.languageCode,
      level: 1,
      lesson_id: `tatoeba-${targetKey}-translation-candidates`,
      lesson_title: `Traduções candidatas de ${target.languageName}`,
      skill_code: `tatoeba_translation_${targetKey}`,
      exercise_type: 'TRANSLATION',
      instruction: `Traduza a frase para ${target.languageName}. Este item é candidato e requer revisão pedagógica.`,
      prompt: `Traduza para ${target.languageName}: “${clean(sentence.text)}”`,
      context: [], options: [], word_bank: [], left_items: [], right_items: [], audio_text: null,
      accepted_answers: acceptedAnswers,
      answer_key: { accepted: acceptedAnswers },
      explanation: 'A tradução de referência vem de uma ligação direta do corpus. Outras respostas naturais podem existir; confirme-as durante a revisão.',
      source: 'Tatoeba', source_url: sourcePage, source_id: sourceId, license, attribution,
      review_flags: reviewFlags,
    });
  }
  return records;
}

function buildFirstPage(target, pageSize) {
  const url = new URL(API_SENTENCES);
  const parameters = {
    lang: target.source,
    'trans:lang': target.target,
    'trans:is_direct': 'yes',
    'trans:is_unapproved': 'no',
    'trans:is_orphan': 'no',
    'showtrans:lang': target.target,
    'showtrans:is_direct': 'yes',
    'showtrans:is_unapproved': 'no',
    'showtrans:is_orphan': 'no',
    sort: 'words',
    limit: String(pageSize),
  };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

function validateNextPageUrl(value) {
  let next;
  try { next = new URL(value); } catch { throw new Error('Tatoeba returned an invalid pagination URL.'); }
  if (next.origin !== API_ORIGIN || next.pathname !== '/v1/sentences') {
    throw new Error('Tatoeba pagination left the documented read-only sentence endpoint.');
  }
  return next;
}

export async function fetchTatoebaCandidates({ targetKey, limit, fetchImpl = fetch, pageSize = MAX_PAGE_SIZE }) {
  const target = TATOEBA_TARGETS[targetKey];
  if (!target) throw new Error(`Unsupported Tatoeba target: ${targetKey}.`);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CANDIDATES) {
    throw new Error(`limit must be an integer from 1 to ${MAX_CANDIDATES}.`);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error(`pageSize must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
  }

  const candidates = new Map();
  const ambiguousPrompts = new Set();
  const ambiguousCandidateIds = new Set();
  let exactDuplicatesRemoved = 0;
  let nextUrl = buildFirstPage(target, pageSize);
  let pageCount = 0;
  while (nextUrl && candidates.size < limit && pageCount < 200) {
    const response = await fetchImpl(nextUrl, { headers: { accept: 'application/json' } });
    if (!response?.ok) throw new Error(`Tatoeba API returned HTTP ${response?.status ?? 'unknown'}.`);
    const payload = await response.json();
    if (!Array.isArray(payload?.data) || !payload?.paging || typeof payload.paging.has_next !== 'boolean') {
      throw new Error('Tatoeba API response is missing sentence or pagination data.');
    }
    for (const candidate of adaptTatoebaSentences(payload.data, targetKey)) {
      const key = promptKey(candidate);
      if (ambiguousPrompts.has(key)) continue;
      const previous = candidates.get(key);
      if (!previous) {
        candidates.set(key, candidate);
        continue;
      }
      if (answerFingerprint(previous) === answerFingerprint(candidate)) {
        exactDuplicatesRemoved += 1;
      } else {
        candidates.delete(key);
        ambiguousPrompts.add(key);
        ambiguousCandidateIds.add(previous.id);
        ambiguousCandidateIds.add(candidate.id);
      }
    }
    pageCount += 1;
    nextUrl = payload.paging.has_next && payload.paging.next
      ? validateNextPageUrl(payload.paging.next)
      : null;
  }
  return {
    targetKey,
    requestedLimit: limit,
    pageCount,
    candidates: [...candidates.values()].slice(0, limit),
    exactDuplicatesRemoved,
    ambiguousPromptsRemoved: ambiguousPrompts.size,
    ambiguousCandidateIds: [...ambiguousCandidateIds].sort(),
    pageLimitReached: Boolean(nextUrl && pageCount >= 200),
  };
}

export async function importTatoebaCandidates({ targetKey, limit, outputDir, fetchImpl = fetch }) {
  const result = await fetchTatoebaCandidates({ targetKey, limit, fetchImpl });
  if (!result.candidates.length) throw new Error('Tatoeba returned no eligible direct translation candidates.');
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tec-tatoeba-candidates-'));
  try {
    const inputPath = path.join(temporaryDirectory, 'tatoeba-candidates.json');
    await writeFile(inputPath, JSON.stringify({ questions: result.candidates }), { encoding: 'utf8', mode: 0o600 });
    const imported = await importQuestionBank({ inputPath, outputDir });
    const intakeReportPath = path.join(outputDir ?? path.dirname(imported.privatePath), 'tatoeba-intake-report.json');
    await writeFile(intakeReportPath, `${JSON.stringify({
      source: 'Tatoeba API /v1/sentences',
      target: targetKey,
      requested_count: limit,
      imported_count: imported.importedCount,
      pages_read: result.pageCount,
      exact_duplicates_removed: result.exactDuplicatesRemoved,
      ambiguous_prompts_removed: result.ambiguousPromptsRemoved,
      page_limit_reached: result.pageLimitReached,
      rejected_ambiguous_candidate_ids: result.ambiguousCandidateIds,
      answer_content_included: false,
      review_status: 'PENDING',
    }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    return { ...imported, ...result, intakeReportPath, candidateOnly: true, reviewStatus: 'PENDING' };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const [targetKey, rawLimit, outputDir] = process.argv.slice(2);
  if (!targetKey || !rawLimit || process.argv.includes('--help')) {
    console.log('Usage: node tools/languages/import-tatoeba-candidates.mjs <en|es|ko|fr|de|it|ja|zh> <limit> [private-output-directory]');
    process.exitCode = targetKey ? 0 : 2;
    return;
  }
  try {
    const limit = Number(rawLimit);
    const result = await importTatoebaCandidates({ targetKey, limit, outputDir });
    console.log(`CANDIDATES_IMPORTED=${result.importedCount}`);
    console.log(`PAGES_READ=${result.pageCount}`);
    console.log('CANDIDATE_ONLY=YES');
    console.log('PEDAGOGICAL_REVIEW=PENDING');
    console.log(`PRIVATE_REVIEW=${result.privatePath}`);
    console.log(`MANIFEST=${result.publicManifestPath}`);
  } catch (error) {
    console.error(`IMPORT_FAILED=${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
