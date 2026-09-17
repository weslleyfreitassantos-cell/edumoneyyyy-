import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260917000100_student_registration_table_grants.sql', import.meta.url),
  'utf8',
);

const tables = [
  'student_registration_details',
  'student_addresses',
  'student_previous_schooling',
  'student_health_information',
  'student_documents',
];

describe('student registration table grants migration', () => {
  it('permite a leitura autenticada das tabelas usadas pelo editor', () => {
    expect(migration).toContain('grant select on table');
    expect(migration).toContain('to authenticated');

    for (const table of tables) {
      expect(migration).toContain(`public.${table}`);
    }
  });

  it('mantem anon sem acesso e recarrega o schema do PostgREST', () => {
    expect(migration).toContain('from anon');
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
