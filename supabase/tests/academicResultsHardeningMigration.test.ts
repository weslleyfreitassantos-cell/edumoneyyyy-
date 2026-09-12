import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260911000600_academic_results_hardening.sql'),
  'utf8',
);

function functionBody(signature: string): string {
  const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = migration.match(
    new RegExp(
      `create or replace function ${escapedSignature}[\\s\\S]*?as \\\$\\$([\\s\\S]*?)\\$\\$;`,
      'i',
    ),
  );
  if (!match) throw new Error(`Missing migration function: ${signature}`);
  return match[1];
}

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

  it('requires the exact active academic membership for student and guardian access', () => {
    expect(functionBody('private.can_student_view_assessment')).toMatch(
      /private\.has_exact_institution_role\([\s\S]*array\['STUDENT'::public\.user_role\]/,
    );
    expect(functionBody('private.can_student_view_grade')).toMatch(
      /private\.has_exact_institution_role\([\s\S]*array\['STUDENT'::public\.user_role\]/,
    );

    for (const signature of [
      'private.can_guardian_view_assessment',
      'private.can_guardian_view_grade',
      'private.can_view_student_term_result',
      'private.can_guardian_view_attendance',
    ]) {
      expect(functionBody(signature)).toMatch(
        /private\.has_exact_institution_role\([\s\S]*array\['GUARDIAN'::public\.user_role\]/,
      );
      expect(functionBody(signature)).toContain('guardianship.active is true');
    }
  });
});
