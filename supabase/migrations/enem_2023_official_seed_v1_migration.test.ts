import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930000500_enem_2023_official_seed_v1.sql', import.meta.url),
  'utf8',
);
const normalizedMigration = migration.replace(/\r\n/g, '\n');

describe('official ENEM seed migration', () => {
  it('seeds only the reviewed official question and historical simulation', () => {
    expect(migration).toContain("'ENEM_OFFICIAL_2023_D2_CD5'");
    expect(migration).toContain("'ENEM 2023 · Matemática · Caderno 5'");
    expect(migration).toContain("'HISTORICAL_EXAM'");
    expect(migration).toContain("'https://download.inep.gov.br/enem/provas_e_gabaritos/2023_PV_impresso_D2_CD5.pdf'");
    expect(migration).toContain("'RATIO_PROPORTION'");
    expect(migration).toContain("'artifact_sha256'");
    expect(migration).toContain("'answer_key_sha256'");
  });

  it('keeps the source global and links the question to a canonical skill', () => {
    expect(migration).toContain("package_type = 'ENEM'");
    expect(migration).toContain('institution_id is null');
    expect(migration).toContain('learning_question_bank_skill_links');
    expect(normalizedMigration).toContain("skill_role)\n  values (v_question_id, v_skill_id, 'PRIMARY')");
  });
});
