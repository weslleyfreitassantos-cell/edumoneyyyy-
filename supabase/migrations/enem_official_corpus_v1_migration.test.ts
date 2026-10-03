import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261003000500_enem_official_corpus_v1.sql'),
  'utf8',
);

describe('ENEM official corpus migration', () => {
  it('stores batches and occurrence-level provenance for idempotent rollback', () => {
    expect(migration).toContain('create table if not exists public.learning_enem_import_batches');
    expect(migration).toContain('manifest_fingerprint');
    expect(migration).toContain('create table if not exists public.learning_enem_official_occurrences');
    expect(migration).toContain('learning_enem_occurrence_identity_unique');
    expect(migration).toContain('artifact_sha256');
    expect(migration).toContain('answer_key_sha256');
  });

  it('keeps language, answer status, quality and media explicit', () => {
    for (const value of ['ENGLISH', 'SPANISH', 'ANNULLED', 'UNKNOWN', 'REVIEW_REQUIRED', 'learning_enem_media_assets']) {
      expect(migration).toContain(value);
    }
  });

  it('does not expose corpus control tables to client roles', () => {
    expect(migration).toContain(
      'revoke all on table public.learning_enem_import_batches, public.learning_enem_official_occurrences, public.learning_enem_media_assets from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant all on table public.learning_enem_import_batches, public.learning_enem_official_occurrences, public.learning_enem_media_assets to service_role',
    );
  });
});
