import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261007000400_enem_official_primary_language_full_pool_v1.sql'),
  'utf8',
);

describe('ENEM primary-language full pool migration', () => {
  it('uses the metadata contract consumed by the dynamic catalog gate', () => {
    expect(migration).toContain('"area_verified":true');
    expect(migration).toContain('"render_ready":true');
    expect(migration).toContain('"subject_verified":true');
    expect(migration).not.toContain('enem_area_verified');
  });

  it('reconciles existing canonical questions instead of only inserting new rows', () => {
    expect(migration).toContain('update public.learning_question_bank set');
    expect(migration).toContain('metadata->>\'canonical_id\'');
    expect(migration).toContain('learning_enem_media_assets');
    expect(migration).toContain('ENEM_OFFICIAL_PRIMARY_LANGUAGE_2017_2025_V1');
  });
});
