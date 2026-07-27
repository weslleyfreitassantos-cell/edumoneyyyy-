import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260727000300_fix_timetable_conflict_trigger_variables.sql', import.meta.url),
  'utf8',
);

describe('timetable conflict trigger fix migration', () => {
  it('usa CREATE OR REPLACE FUNCTION', () => {
    const matches = migration.match(/create or replace function/g);
    expect(matches?.length).toBe(2);
  });

  it('usa v_class_id nas funções', () => {
    expect(migration).toContain('v_class_id');
  });

  it('usa v_teacher_profile_id nas funções', () => {
    expect(migration).toContain('v_teacher_profile_id');
  });

  it('mantém SECURITY DEFINER', () => {
    const matches = migration.match(/security definer/gi);
    expect(matches?.length).toBe(2);
  });

  it('mantém SET search_path =', () => {
    const matches = migration.match(/set search_path = ''/g);
    expect(matches?.length).toBe(2);
  });

  it('mantém overlap parcial (entry.start_time < new.end_time AND new.start_time < entry.end_time)', () => {
    expect(migration).toContain('entry.start_time < new.end_time');
    expect(migration).toContain('new.start_time < entry.end_time');
  });

  it('mantém exclusão do próprio registro no UPDATE (entry.id is distinct from new.id)', () => {
    expect(migration).toContain('entry.id is distinct from new.id');
  });

  it('mantém day_of_week check', () => {
    expect(migration).toContain('entry.day_of_week = new.day_of_week');
  });

  it('mantém active check', () => {
    expect(migration).toContain('entry.active is true');
  });

  it('não recria tabelas', () => {
    expect(migration).not.toContain('create table');
  });

  it('não altera RLS ou policies', () => {
    expect(migration).not.toContain('alter table');
    expect(migration).not.toContain('policy');
  });

  it('não altera dados (sem INSERT, UPDATE, DELETE em dados)', () => {
    expect(migration).not.toMatch(/^\s*insert\s+into/i);
    expect(migration).not.toMatch(/^\s*update\s+/i);
    expect(migration).not.toMatch(/^\s*delete\s+from/i);
  });

  it('preserva notificação pgrst', () => {
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it('usa BEGIN / COMMIT', () => {
    expect(migration).toMatch(/^begin;?\s*$/m);
    expect(migration).toMatch(/^commit;?\s*$/m);
  });
});
