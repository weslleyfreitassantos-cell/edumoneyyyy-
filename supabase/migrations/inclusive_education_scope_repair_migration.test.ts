import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261118000200_inclusive_education_rls_scope_repair.sql'),
  'utf8',
);

function policy(name: string): string {
  return migration.match(new RegExp(`create policy ${name}[\\s\\S]*?;`, 'i'))?.[0] ?? '';
}

describe('inclusive education tenant-scope repair migration', () => {
  it('grants table operations required for RLS-protected assignment and revision access', () => {
    expect(migration).toContain('grant select, insert, update, delete on public.inclusive_aee_assignments to authenticated');
    expect(migration).toContain('grant select, insert on public.inclusive_document_revisions to authenticated');
  });

  it('requires an active institution member for AEE assignment access', () => {
    const selectPolicy = policy('inclusive_aee_assignment_select');
    const writePolicy = policy('inclusive_aee_assignment_write');

    expect(selectPolicy).toContain('private.inclusive_student_belongs(institution_id, student_id)');
    expect(selectPolicy).toContain('private.inclusive_member_belongs(institution_id, professional_profile_id)');
    expect(writePolicy).toContain('private.inclusive_student_belongs(institution_id, student_id)');
    expect(writePolicy).toContain('private.inclusive_member_belongs(institution_id, professional_profile_id)');
    expect(writePolicy).toContain('private.inclusive_is_manager(institution_id)');
  });

  it('binds revision access to an existing document in the same institution', () => {
    const selectPolicy = policy('inclusive_revision_select');
    const insertPolicy = policy('inclusive_revision_insert');
    const documentGate = migration.match(
      /create or replace function private\.inclusive_document_belongs[\s\S]*?\$\$;/i,
    )?.[0] ?? '';

    expect(documentGate).toContain('plan.id = target_document_id');
    expect(documentGate).toContain('plan.institution_id = target_institution_id');
    expect(selectPolicy).toContain('private.inclusive_is_manager(institution_id)');
    expect(selectPolicy).toContain('private.inclusive_document_belongs(institution_id, document_type, document_id)');
    expect(insertPolicy).toContain('private.inclusive_document_belongs(institution_id, document_type, document_id)');
    expect(insertPolicy).toContain('changed_by = (select auth.uid())');
    expect(migration).not.toMatch(/create policy inclusive_revision_(select|insert)[\s\S]*?or changed_by/i);
  });
});
