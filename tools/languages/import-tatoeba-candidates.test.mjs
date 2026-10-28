import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { adaptTatoebaSentences, fetchTatoebaCandidates, importTatoebaCandidates } from './import-tatoeba-candidates.mjs';

const temporaryDirectories = [];

async function tempDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tec-tatoeba-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function pair(overrides = {}) {
  return {
    id: 10,
    text: 'Bom dia.',
    lang: 'por',
    license: 'CC BY 2.0 FR',
    owner: 'writer_one',
    is_unapproved: false,
    translations: [{
      id: 20,
      text: 'Good morning.',
      lang: 'eng',
      license: 'CC BY 2.0 FR',
      owner: 'writer_two',
      is_unapproved: false,
      is_direct: true,
    }],
    ...overrides,
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Tatoeba candidate intake', () => {
  it('keeps stable source and translation IDs, attribution, license, and mandatory review flags', () => {
    const [question] = adaptTatoebaSentences([pair({ translations: [
      { ...pair().translations[0], id: 21, text: 'Good morning, everyone.' },
      { ...pair().translations[0], id: 20 },
    ] })], 'en');

    expect(question).toMatchObject({
      id: 'tatoeba-en-10-20',
      source_id: 'tatoeba:10:20',
      license: 'CC-BY-2.0',
      review_flags: expect.arrayContaining(['PEDAGOGICAL_REVIEW_REQUIRED', 'CEFR_LEVEL_UNVERIFIED', 'ALTERNATIVE_TRANSLATIONS_REQUIRE_REVIEW']),
    });
    expect(question.attribution).toContain('writer_one');
    expect(question.attribution).toContain('writer_two');
    expect(question.attribution).toContain('CC BY 2.0 FR');
  });

  it('allows only direct, approved, attributable or CC0 translations and selects one canonical candidate', () => {
    const [question] = adaptTatoebaSentences([pair({
      license: 'CC0 1.0',
      owner: null,
      translations: [
        { id: 20, text: 'Good morning.', lang: 'eng', license: 'CC BY 2.0 FR', owner: 'writer_two', is_unapproved: false, is_direct: true },
        { id: 21, text: 'Morning!', lang: 'eng', license: 'CC0 1.0', owner: null, is_unapproved: false, is_direct: true },
        { id: 22, text: 'Buenos días.', lang: 'spa', license: 'CC BY 2.0 FR', owner: 'writer_three', is_unapproved: false, is_direct: true },
        { id: 23, text: 'Hello.', lang: 'eng', license: 'PROBLEM', owner: 'writer_four', is_unapproved: false, is_direct: true },
        { id: 24, text: 'Hi.', lang: 'eng', license: 'CC BY 2.0 FR', owner: 'writer_five', is_unapproved: true, is_direct: true },
        { id: 25, text: 'Hey.', lang: 'eng', license: 'CC BY 2.0 FR', owner: 'writer_six', is_unapproved: false, is_direct: false },
      ],
    })], 'en');

    expect(question.license).toBe('CC-BY-2.0');
    expect(question.accepted_answers).toEqual(['Good morning.']);
    expect(question.review_flags).toContain('ALTERNATIVE_TRANSLATIONS_REQUIRE_REVIEW');
  });

  it('queries bounded pages from the stable API and stops at the requested number of candidates', async () => {
    const firstPage = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [pair(), pair({ id: 11, text: 'Boa noite.', translations: [{ ...pair().translations[0], id: 21, text: 'Good night.' }] })], paging: { has_next: true, next: 'https://api.tatoeba.org/v1/sentences?after=10,11' } }),
    });
    const secondPage = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [pair({ id: 12, translations: [{ ...pair().translations[0], id: 22 }] })], paging: { has_next: false, next: null } }),
    });
    const fetchImpl = vi.fn().mockImplementation((url) => String(url).includes('after=') ? secondPage(url) : firstPage(url));

    const result = await fetchTatoebaCandidates({ targetKey: 'en', limit: 2, fetchImpl, pageSize: 2 });

    expect(result.candidates).toHaveLength(2);
    expect(result.pageCount).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('trans%3Alang=eng');
    expect(String(fetchImpl.mock.calls[0][0])).toContain('showtrans%3Ais_unapproved=no');
  });

  it('refuses pagination links that leave the official API origin', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [pair()], paging: { has_next: true, next: 'https://attacker.example/v1/sentences' } }),
    });

    await expect(fetchTatoebaCandidates({ targetKey: 'en', limit: 2, fetchImpl, pageSize: 1 }))
      .rejects.toThrow(/pagination left the documented read-only sentence endpoint/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('removes conflicting duplicate prompts instead of arbitrarily choosing an answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          pair(),
          pair({ id: 11, translations: [{ ...pair().translations[0], id: 21, text: 'Hello.' }] }),
        ],
        paging: { has_next: false, next: null },
      }),
    });

    const result = await fetchTatoebaCandidates({ targetKey: 'en', limit: 2, fetchImpl, pageSize: 2 });

    expect(result.candidates).toHaveLength(0);
    expect(result.ambiguousPromptsRemoved).toBe(1);
    expect(result.ambiguousCandidateIds).toEqual(['tatoeba-en-10-20', 'tatoeba-en-11-21']);
  });

  it('deduplicates identical prompts with identical answers deterministically', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [pair(), pair({ id: 11, translations: [{ ...pair().translations[0], id: 21 }] })],
        paging: { has_next: false, next: null },
      }),
    });

    const result = await fetchTatoebaCandidates({ targetKey: 'en', limit: 2, fetchImpl, pageSize: 2 });

    expect(result.candidates).toHaveLength(1);
    expect(result.exactDuplicatesRemoved).toBe(1);
    expect(result.candidates[0].id).toBe('tatoeba-en-10-20');
  });

  it('keeps answer-bearing review output private and the manifest free of answers', async () => {
    const outputDir = path.join(await tempDirectory(), 'private');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [pair()], paging: { has_next: false, next: null } }),
    });

    const result = await importTatoebaCandidates({ targetKey: 'en', limit: 1, outputDir, fetchImpl });
    const privateReview = JSON.parse(await readFile(result.privatePath, 'utf8'));
    const manifest = await readFile(result.publicManifestPath, 'utf8');

    expect(result).toMatchObject({ importedCount: 1, candidateOnly: true, reviewStatus: 'PENDING' });
    expect(privateReview.questions[0].answer_key.accepted).toEqual(['Good morning.']);
    expect(privateReview.questions[0].review_flags).toContain('PEDAGOGICAL_REVIEW_REQUIRED');
    expect(manifest).not.toContain('Good morning.');
  });
});
