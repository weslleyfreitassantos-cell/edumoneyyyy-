import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { importQuestionBank, validateAndDeduplicate } from './import-question-bank.mjs';

const temporaryDirectories = [];

async function tempDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tec-language-import-'));
  temporaryDirectories.push(directory);
  return directory;
}

function question(overrides = {}) {
  return {
    id: 'lesson-1-q1',
    course_code: 'TEC_ENGLISH_FOUNDATIONS_V5',
    language_code: 'en-US',
    level: 1,
    lesson_id: 'lesson-1',
    lesson_title: 'Greetings',
    skill_code: 'en_greetings',
    exercise_type: 'MULTIPLE_CHOICE',
    instruction: 'Choose the response that fits the conversation.',
    prompt: 'How do you greet someone in the morning?',
    context: [],
    options: ['Good morning.', 'Good night.', 'Goodbye.'],
    word_bank: [],
    left_items: [],
    right_items: [],
    audio_text: null,
    accepted_answers: ['Good morning.'],
    answer_key: { accepted: ['Good morning.'] },
    explanation: 'Use “Good morning” before noon.',
    source: 'Tec Escola original',
    source_url: 'https://example.org/content',
    source_id: 'original-001',
    license: 'CC-BY-4.0',
    attribution: 'Tec Escola',
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('multilingual question bank importer', () => {
  it('normalizes valid content and removes exact duplicates across source IDs', () => {
    const result = validateAndDeduplicate([
      question(),
      question({ id: 'lesson-1-q1-copy', source_id: 'other-copy' }),
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.duplicates).toEqual([{ id: 'lesson-1-q1-copy', reason: 'IDENTICAL_PROMPT_AND_CONTENT', duplicate_of: 'lesson-1-q1' }]);
    expect(result.questions[0].provenance).toMatchObject({ license: 'CC-BY-4.0', attribution: 'Tec Escola' });
  });

  it('rejects a pre-answer dialogue that contains the correct answer', () => {
    expect(() => validateAndDeduplicate([
      question({ context: [{ speaker: 'Tutor', text: 'Good morning.' }] }),
    ])).toThrow(/pre-answer dialogue contains the expected answer/);
  });

  it('rejects unclear or non-commercial licenses and missing attribution', () => {
    expect(() => validateAndDeduplicate([question({ license: 'CC-BY-NC-4.0' })])).toThrow(/not in the approved commercial-use allowlist/);
    expect(() => validateAndDeduplicate([question({ license: 'CC-BY-NC-ND-4.0' })])).toThrow(/not in the approved commercial-use allowlist/);
    expect(() => validateAndDeduplicate([question({ attribution: '' })])).toThrow(/attribution is required/);
  });

  it('rejects conflicting duplicate prompts and mismatched answer keys', () => {
    expect(() => validateAndDeduplicate([
      question(),
      question({ id: 'lesson-1-q2', source_id: 'other', answer_key: { accepted: ['Goodbye.'] }, accepted_answers: ['Goodbye.'] }),
    ])).toThrow(/duplicate normalized prompt conflicts/);
    expect(() => validateAndDeduplicate([question({ answer_key: { accepted: ['Goodbye.'] } })])).toThrow(/must match exactly/);
  });

  it('accepts JSON and writes private answers separately from a key-free manifest', async () => {
    const directory = await tempDirectory();
    const inputPath = path.join(directory, 'questions.json');
    const outputDir = path.join(directory, 'private');
    await writeFile(inputPath, JSON.stringify({ questions: [question()] }), 'utf8');

    const result = await importQuestionBank({ inputPath, outputDir });
    const privateFile = JSON.parse(await readFile(result.privatePath, 'utf8'));
    const manifest = JSON.parse(await readFile(result.publicManifestPath, 'utf8'));

    expect(result.importedCount).toBe(1);
    expect(privateFile.questions[0].answer_key).toEqual({ accepted: ['Good morning.'] });
    expect(JSON.stringify(manifest)).not.toContain('Good morning.');
    expect(manifest.questions[0]).toHaveProperty('license', 'CC-BY-4.0');
  });

  it('parses CSV quoting, commas, and JSON-valued cells', async () => {
    const directory = await tempDirectory();
    const inputPath = path.join(directory, 'questions.csv');
    const columns = Object.keys(question());
    const csvCell = (value) => `"${String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replaceAll('"', '""')}"`;
    await writeFile(inputPath, `${columns.join(',')}\n${columns.map((column) => csvCell(question()[column])).join(',')}\n`, 'utf8');

    const result = await importQuestionBank({ inputPath, outputDir: path.join(directory, 'private') });
    expect(result.inputCount).toBe(1);
    expect(result.importedCount).toBe(1);
  });

  it('refuses answer-bearing output inside the repository', async () => {
    const directory = await tempDirectory();
    const inputPath = path.join(directory, 'questions.json');
    await writeFile(inputPath, JSON.stringify({ questions: [question()] }), 'utf8');

    await expect(importQuestionBank({ inputPath, outputDir: path.resolve('tools/languages/private-test-output') }))
      .rejects.toThrow(/must be outside the repository/);
  });

  it('refuses an outside symlink whose target resolves inside the repository', async () => {
    const directory = await tempDirectory();
    const inputPath = path.join(directory, 'questions.json');
    const outputLink = path.join(directory, 'linked-output');
    await writeFile(inputPath, JSON.stringify({ questions: [question()] }), 'utf8');
    await symlink(path.resolve('tools/languages'), outputLink, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(importQuestionBank({ inputPath, outputDir: outputLink }))
      .rejects.toThrow(/must be outside the repository/);
  });
});
