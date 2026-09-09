import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260909000100_learning_center.sql'),
  'utf8',
);
const hardeningMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260909000200_learning_center_hardening.sql'),
  'utf8',
);

describe('learning center migrations', () => {
  it('cria o ciclo pedagógico completo e o cálculo de domínio', () => {
    expect(baseMigration).toContain('create table public.learning_units');
    expect(baseMigration).toContain('create table public.learning_skills');
    expect(baseMigration).toContain('create table public.learning_activities');
    expect(baseMigration).toContain('create table public.learning_questions');
    expect(baseMigration).toContain('create table public.learning_assignments');
    expect(baseMigration).toContain('create table public.learning_attempts');
    expect(baseMigration).toContain('create table public.learning_answers');
    expect(baseMigration).toContain('create table public.learning_skill_progress');
    expect(baseMigration).toContain('create or replace function public.submit_learning_attempt');
    expect(baseMigration).toContain('mastery_percent');
  });

  it('cria coleções e recursos externos curados sem copiar conteúdo', () => {
    const collectionsMigration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260909000400_learning_collections.sql'),
      'utf8',
    );
    expect(collectionsMigration).toContain('create table public.learning_collections');
    expect(collectionsMigration).toContain('create table public.learning_resources');
    expect(collectionsMigration).toContain("resource_type in ('VIDEO', 'LINK', 'RESOURCE')");
    expect(collectionsMigration).toContain('private.learning_can_read_collection');
    expect(collectionsMigration).toContain('approved boolean not null default false');
  });

  it('protege o escopo por aluno, professor e instituição', () => {
    expect(baseMigration).toContain('private.learning_is_assigned_student');
    expect(baseMigration).toContain('public.can_access_institution(institution_id)');
    expect(hardeningMigration).toContain('private.learning_can_read_activity');
    expect(hardeningMigration).toContain('private.learning_can_read_assignment');
    expect(hardeningMigration).toContain('alter function public.submit_learning_attempt(uuid, jsonb) security definer');
    expect(hardeningMigration).toContain('learning_answers_delete');
    const referenceHardening = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260909000500_learning_center_reference_hardening.sql'),
      'utf8',
    );
    expect(referenceHardening).toContain('private.learning_teacher_owns_subject');
    expect(referenceHardening).toContain('private.learning_teacher_owns_subject_class');
    const assignmentFix = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260909000600_fix_learning_assignment_scope.sql'),
      'utf8',
    );
    expect(assignmentFix).toContain('private.learning_can_assign_activity');
    expect(assignmentFix).toContain('learning_assignments_insert');
    const assignmentRpc = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260909000700_publish_learning_activity_rpc.sql'),
      'utf8',
    );
    expect(assignmentRpc).toContain('create or replace function public.publish_learning_activity');
    expect(assignmentRpc).toContain('grant execute on function public.publish_learning_activity(uuid, uuid, timestamptz) to authenticated;');
    expect(assignmentRpc).toContain('on conflict (activity_id, class_id)');
    const managementMigration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260909000800_manage_learning_activities.sql'),
      'utf8',
    );
    expect(managementMigration).toContain('create or replace function public.update_learning_activity');
    expect(managementMigration).toContain('create or replace function public.delete_learning_activity');
    expect(managementMigration).toContain('grant execute on function public.delete_learning_activity(uuid) to authenticated;');
    const studentActivitiesMigration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260909000900_student_learning_activities_rpc.sql'),
      'utf8',
    );
    expect(studentActivitiesMigration).toContain('create or replace function public.list_student_learning_activities');
    expect(studentActivitiesMigration).toContain("a.status = 'PUBLISHED'");
    expect(studentActivitiesMigration).toContain('st.profile_id = auth.uid()');
    expect(studentActivitiesMigration).toContain('grant execute on function public.list_student_learning_activities(uuid) to authenticated;');
  });
});
