import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('delete-institution coverage', () => {
  it('uses one database transaction for all dependent deletes', () => {
    expect(source).toContain('rpc("delete_institution_data_atomic_v1"');
    expect(source).not.toContain('.from(table)');
  });

  it('keeps the dependency list in the transactional SQL function', () => {
    const migration = readFileSync(
      new URL('../../migrations/20261120174530_delete_institution_data_atomic_v1.sql', import.meta.url),
      'utf8',
    );
    for (const table of [
      'learning_answers',
      'learning_attempts',
      'learning_guided_sessions',
      'timetable_version_entries',
      'teacher_availability',
      'classes',
      'students',
    ]) {
      expect(migration).toContain(`'${table}'`);
    }
  });

  it('passes both tenant scope identifiers to the transaction', () => {
    expect(source).toContain('.eq("id", input.institutionId)');
    expect(source).toContain('.eq("account_id", input.accountId)');
    expect(source).toContain('p_account_id: account.id');
    expect(source).toContain('p_institution_id: institution.id');
  });

  it('reports a foreign-key blocker as an atomic no-deletion conflict', () => {
    expect(source).toContain('deleteError.code === "23503"');
    expect(source).toContain('INSTITUTION_HAS_UNSUPPORTED_DEPENDENCIES');
    expect(source).toContain('Nenhum dado foi excluido.');
  });
});
