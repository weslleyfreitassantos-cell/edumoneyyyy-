#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importQuestionBank } from './import-question-bank.mjs';

const SOURCE = 'Elispeak Common English Mistakes';
const SOURCE_URL = 'https://github.com/elispeak/elispeak-common-english-mistakes';
const CEFR_LEVELS = new Map([['A1', 1], ['A2', 2], ['B1', 3], ['B2', 4], ['C1', 5]]);
const titleCase = (value) => value.split(/[_\s]+/u).map((part) => part ? `${part[0].toLocaleUpperCase()}${part.slice(1)}` : '').join(' ');

export function adaptElispeakRows(rows) {
  if (!Array.isArray(rows)) throw new Error('Elispeak input must be an array of JSONL records.');
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Elispeak row ${index + 1} must be an object.`);
    const id = String(row.id ?? '').trim();
    const cefr = String(row.cefr ?? '').trim().toUpperCase();
    const learnerSentence = String(row.learner_sentence ?? '').trim();
    const correctedSentence = String(row.corrected_sentence ?? '').trim();
    const explanation = String(row.explanation ?? '').trim();
    const category = String(row.category ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_|_$/gu, '');
    if (!/^cem-[a-z0-9-]+$/u.test(id)) throw new Error(`Elispeak row ${index + 1} has an invalid stable id.`);
    if (!CEFR_LEVELS.has(cefr)) throw new Error(`${id}: unsupported CEFR level ${cefr || '(empty)'}.`);
    if (!learnerSentence || !correctedSentence || !explanation || !category) throw new Error(`${id}: sentence, correction, explanation, and category are required.`);

    return {
      id: `elispeak-${id}`,
      course_code: 'TEC_ENGLISH_FOUNDATIONS_V5_CANDIDATES',
      language_code: 'en-US',
      level: CEFR_LEVELS.get(cefr),
      lesson_id: `en-common-mistakes-${category}`,
      lesson_title: `${titleCase(category)} practice`,
      skill_code: `en_mistakes_${category}`,
      exercise_type: 'TRANSLATION',
      instruction: 'Rewrite the sentence in natural English.',
      prompt: `Correct this sentence: “${learnerSentence}”`,
      context: [],
      options: [],
      word_bank: [],
      left_items: [],
      right_items: [],
      audio_text: null,
      accepted_answers: [correctedSentence],
      answer_key: { accepted: [correctedSentence] },
      explanation,
      source: SOURCE,
      source_url: SOURCE_URL,
      source_id: id,
      license: 'MIT',
      attribution: `${SOURCE}, ${id}; MIT license; see tools/languages/licenses/elispeak-MIT.txt.`,
    };
  });
}

export async function importElispeakCandidates({ inputPath, outputDir }) {
  const raw = await readFile(inputPath, 'utf8');
  const rows = raw.split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`Invalid Elispeak JSONL at line ${index + 1}.`); }
  });
  if (!rows.length) throw new Error('Elispeak input has no records.');
  const adapted = adaptElispeakRows(rows);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tec-elispeak-adapter-'));
  try {
    const adaptedPath = path.join(temporaryDirectory, 'elispeak-candidates.json');
    await writeFile(adaptedPath, JSON.stringify({ questions: adapted }), 'utf8');
    const imported = await importQuestionBank({ inputPath: adaptedPath, outputDir });
    return { ...imported, candidateOnly: true, pedagogicalReview: 'PENDING' };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const [inputPath, outputDir] = process.argv.slice(2);
  if (!inputPath || process.argv.includes('--help')) {
    console.log('Usage: node tools/languages/import-elispeak-candidates.mjs <source.jsonl> [private-output-directory]');
    process.exitCode = inputPath ? 0 : 2;
    return;
  }
  try {
    const result = await importElispeakCandidates({ inputPath, outputDir });
    console.log(`QUESTIONS_IMPORTED=${result.importedCount}`);
    console.log(`CANDIDATES_ONLY=${result.candidateOnly ? 'YES' : 'NO'}`);
    console.log(`PEDAGOGICAL_REVIEW=${result.pedagogicalReview}`);
    console.log(`PRIVATE_REVIEW=${result.privatePath}`);
    console.log(`MANIFEST=${result.publicManifestPath}`);
  } catch (error) {
    console.error(`IMPORT_FAILED=${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
