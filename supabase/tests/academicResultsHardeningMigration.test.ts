import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260911000600_academic_results_hardening.sql'),
  'utf8',
);

describe('academic results hardening migration', () => {
  it('guards assessment and grade mutations after publication/closure boundaries', () => {
    expect(migration).toContain('create or replace function private.prevent_closed_assessment_mutation()');
    expect(migration).toContain("old.status = 'CLOSED'");
    expect(migration).toContain("closure.status = 'CLOSED'");
    expect(migration).toContain('create or replace function private.prevent_closed_grade_mutation()');
    expect(migration).toContain("assessment.status <> 'PUBLISHED'");
    expect(migration).toContain('assessments_prevent_closed_mutation');
    expect(migration).toContain('grades_prevent_closed_mutation');
    expect(migration).toContain('before insert or update or delete on public.assessments');
    expect(migration).toContain('before insert or update or delete on public.grades');
  });

  it('keeps the historical term-closing migration immutable', () => {
    expect(migration).not.toContain('drop table');
    expect(migration).not.toContain('drop policy');
    expect(migration).toContain('without rewriting the historical');
  });
});
