import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261025000800_classroom_activity_authoring_v2.sql', import.meta.url),
  'utf8',
);

describe('classroom activity authoring v2', () => {
  it('supports scheduled assignments and bounded retries', () => {
    expect(migration).toContain('add column if not exists available_at timestamptz');
    expect(migration).toContain('add column if not exists max_attempts integer');
    expect(migration).toContain('learning_assignments_max_attempts_check');
    expect(migration).toContain('LEARNING_ASSIGNMENT_NOT_AVAILABLE_OR_ATTEMPTS_EXHAUSTED');
    expect(migration).toContain('assignment.available_at is null or assignment.available_at <= now()');
    expect(migration).toContain('assignment.due_at is null or assignment.due_at >= now()');
  });

  it('keeps question-bank answer keys behind the active teacher role and review filter', () => {
    expect(migration).toContain('LEARNING_QUESTION_BANK_TEACHER_SCOPE_DENIED');
    expect(migration).toContain("membership.role = 'TEACHER'::public.user_role");
    expect(migration).toContain("'approved', 'published', 'approved_for_production'");
    expect(migration).toContain("'review_pending', 'pedagogical_review_pending', 'rejected', 'authored', 'tech_validated'");
    expect(migration).toContain("nullif(trim(coalesce(question.metadata->>'pedagogical_review_status', '')), '') is null");
    expect(migration).toContain("<> 'staging'");
    expect(migration).toContain("<> 'true'");
    expect(migration).toContain('LEARNING_QUESTION_BANK_SCOPE_OR_REVIEW_DENIED');
    expect(migration).toContain('LEARNING_MULTIPLE_CHOICE_OPTIONS_INVALID');
    expect(migration).toContain('LEARNING_TRUE_FALSE_ANSWER_INVALID');
    expect(migration).toContain('LEARNING_QUESTION_POINTS_INVALID');
    expect(migration).toContain('grant execute on function public.search_teacher_learning_question_bank_v1');
  });

  it('switches to the protected function owner only for the authorized hosted session and restores postgres after its ACL', () => {
    const guardStart = migration.indexOf('do $classroom_activity_question_bank_owner_guard$');
    const firstSchemaWrite = migration.indexOf('alter table public.learning_assignments');
    const ownerRoleSwitch = migration.indexOf('do $classroom_activity_question_bank_owner_role$');
    const setAdminRole = migration.indexOf("execute 'set role supabase_admin'", ownerRoleSwitch);
    const functionStart = migration.indexOf('create or replace function public.list_teacher_learning_question_bank', ownerRoleSwitch);
    const functionEnd = migration.indexOf('\n$$;', functionStart) + '\n$$;'.length;
    const ownerRevoke = migration.indexOf('revoke all on function public.list_teacher_learning_question_bank(uuid)', functionEnd);
    const ownerGrant = migration.indexOf('grant execute on function public.list_teacher_learning_question_bank(uuid) to authenticated', ownerRevoke);
    const roleRestoreBlock = migration.indexOf('do $classroom_activity_question_bank_role_restore$', ownerGrant);
    const roleRestore = migration.indexOf("execute 'set role postgres'", roleRestoreBlock);
    const nextFunction = migration.indexOf('create or replace function', roleRestore);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(firstSchemaWrite).toBeGreaterThan(guardStart);
    expect(ownerRoleSwitch).toBeGreaterThan(firstSchemaWrite);
    expect(setAdminRole).toBeGreaterThan(ownerRoleSwitch);
    expect(migration.slice(guardStart, ownerRoleSwitch)).toContain("function_owner = 'postgres'");
    expect(migration.slice(guardStart, ownerRoleSwitch)).toContain("function_owner = 'supabase_admin'");
    expect(migration.slice(guardStart, ownerRoleSwitch)).toContain("session_user = 'supabase_admin'");
    expect(migration.slice(guardStart, ownerRoleSwitch)).toContain("current_user = 'postgres'");
    expect(migration.slice(guardStart, ownerRoleSwitch)).toContain('coalesce(session_role_is_superuser, false)');
    expect(migration.slice(guardStart, ownerRoleSwitch)).toContain('LEARNING_QUESTION_BANK_OWNER_EXECUTOR_REQUIRED');
    expect(migration.slice(ownerRoleSwitch, functionStart)).toContain("session_user = 'supabase_admin' and current_user = 'postgres'");
    expect(migration.slice(ownerRoleSwitch, functionStart)).not.toContain('set role supabase_admin;');
    expect(functionStart).toBeGreaterThan(setAdminRole);
    expect(ownerRevoke).toBeGreaterThan(functionEnd);
    expect(ownerGrant).toBeGreaterThan(ownerRevoke);
    expect(roleRestore).toBeGreaterThan(ownerGrant);
    expect(migration.slice(roleRestoreBlock, roleRestore)).toContain("session_user = 'supabase_admin' and current_user = 'supabase_admin'");
    expect(nextFunction).toBeGreaterThan(roleRestore);
    expect(migration.match(/grant execute on function public\.list_teacher_learning_question_bank\(uuid\)/g)).toHaveLength(1);
  });

  it('publishes atomically only to teacher-authorized classes', () => {
    expect(migration).toContain('public.publish_learning_activity_to_classes_v1');
    expect(migration).toContain('private.learning_teacher_can_assign_activity');
    expect(migration).toContain('public.publish_learning_activity(');
    expect(migration).toContain('cardinality(coalesce(p_class_ids');
    expect(migration).toContain('LEARNING_ASSIGNMENT_DUPLICATE_CLASS');
    expect(migration).toContain('public.archive_learning_activity_v1');
  });

  it('filters student access by assignment schedule and does not expose answer keys', () => {
    const studentRpc = migration.slice(migration.indexOf('create or replace function public.list_student_learning_activities'));
    const trigger = studentRpc.slice(studentRpc.indexOf('create or replace function private.enforce_learning_assignment_attempt_policy'));
    expect(studentRpc.slice(0, studentRpc.indexOf('create or replace function private.enforce_learning_assignment_attempt_policy'))).toContain('assignment.available_at is null or assignment.available_at <= now()');
    expect(studentRpc.slice(0, studentRpc.indexOf('create or replace function private.enforce_learning_assignment_attempt_policy'))).not.toContain("'correct_answer_json'");
    expect(studentRpc.slice(0, studentRpc.indexOf('create or replace function private.enforce_learning_assignment_attempt_policy'))).not.toContain("'explanation'");
    expect(trigger).toContain('create trigger learning_attempt_runs_assignment_policy');
    expect(trigger).toContain('< assignment.max_attempts');
    expect(trigger).toContain('activity.status = \'PUBLISHED\'');
    expect(trigger).toContain('student.profile_id = auth.uid()');
    expect(trigger).toContain('pg_advisory_xact_lock');
    expect(trigger).toContain('new.run_number = (');
    expect(trigger).toContain('previous.student_id = new.student_id');
  });
});
