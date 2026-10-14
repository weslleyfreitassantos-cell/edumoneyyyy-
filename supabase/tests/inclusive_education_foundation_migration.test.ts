import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261014000100_inclusive_education_foundation.sql'), 'utf8');

describe('inclusive education foundation migration', () => {
  it('reuses school entities and creates PEI/AEE history tables', () => {
    expect(migration).toContain('references public.students(id)');
    expect(migration).toContain('references public.institutions(id)');
    expect(migration).toContain('create table public.inclusive_pei_plans');
    expect(migration).toContain('create table public.inclusive_aee_assignments');
    expect(migration).toContain('create table public.inclusive_aee_plans');
    expect(migration).toContain('create table public.inclusive_aee_sessions');
    expect(migration).toContain('create table public.inclusive_document_revisions');
    expect(migration).not.toMatch(/alter\s+type\s+public\.user_role/i);
  });

  it('enforces institution and least-privilege gates in RLS', () => {
    expect(migration).toContain('alter table public.inclusive_pei_plans enable row level security');
    expect(migration).toContain('private.inclusive_student_belongs');
    expect(migration).toContain('private.inclusive_teacher_can_student');
    expect(migration).toContain('private.inclusive_aee_can_student');
    expect(migration).toContain('private.inclusive_is_manager');
    expect(migration).toContain('private.inclusive_member_belongs');
    expect(migration).toContain("membership.role in ('ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER')");
    expect(migration).toContain('private.inclusive_document_belongs');
    expect(migration).toContain('create policy inclusive_revision_insert');
    expect(migration).toContain('unique (document_type, document_id, version)');
  });

  it('does not allow revision authorship alone to bypass institution authorization', () => {
    const revisionSelect = migration.match(/create policy inclusive_revision_select[\s\S]*?;/i)?.[0] ?? '';
    const revisionInsert = migration.match(/create policy inclusive_revision_insert[\s\S]*?;/i)?.[0] ?? '';
    const assignmentSelect = migration.match(/create policy inclusive_aee_assignment_select[\s\S]*?;/i)?.[0] ?? '';
    const assignmentWrite = migration.match(/create policy inclusive_aee_assignment_write[\s\S]*?;/i)?.[0] ?? '';

    expect(revisionSelect).toContain('private.inclusive_is_manager(institution_id)');
    expect(revisionSelect).toContain('private.inclusive_document_belongs(institution_id, document_type, document_id)');
    expect(revisionSelect).not.toContain('changed_by');
    expect(revisionInsert).toContain('private.inclusive_is_manager(institution_id)');
    expect(revisionInsert).toContain('private.inclusive_document_belongs(institution_id, document_type, document_id)');
    expect(revisionInsert).toContain('changed_by = (select auth.uid())');
    expect(assignmentSelect).toContain('private.inclusive_student_belongs(institution_id, student_id)');
    expect(assignmentSelect).toContain('private.inclusive_member_belongs(institution_id, professional_profile_id)');
    expect(assignmentWrite).toContain('private.inclusive_student_belongs(institution_id, student_id)');
    expect(assignmentWrite).toContain('private.inclusive_member_belongs(institution_id, professional_profile_id)');
  });

  it('does not create public access for the security-definer helpers', () => {
    expect(migration).toContain('revoke all on function private.inclusive_is_manager(uuid) from public, anon, authenticated');
    expect(migration).toContain('revoke all on function private.inclusive_member_belongs(uuid, uuid) from public, anon, authenticated');
    expect(migration).not.toMatch(/grant\s+execute\s+on\s+function\s+private\.inclusive_.*\s+to\s+anon/i);
  });
});
