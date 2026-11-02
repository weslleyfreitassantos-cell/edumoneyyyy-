import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261101000100_bncc_guided_hint_evidence_v5.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');
const normalizedMigration = migration.replace(/''/g, "'");

describe('BNCC guided hint evidence V5 migration', () => {
  it('records hint use through a student-scoped authenticated server function', () => {
    expect(migration).toContain('public.record_guided_learning_hint_v5');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('private.learning_v2_scope_student(session_row.institution_id, session_row.student_id)');
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain('student.active');
    expect(migration).toContain('LEARNING_HINT_STUDENT_AUTH_REQUIRED');
    expect(migration).toContain('private.assert_bncc_discipline_journey_v9');
    expect(migration).toContain('for update');
    expect(migration).toContain("session_row.current_step_id is distinct from step_row.id");
    expect(migration).toContain("'used_hint_question_ids'");
    expect(migration).toContain("revoke all on function public.record_guided_learning_hint_v5(uuid, uuid) from public, anon");
    expect(migration).toContain('grant execute on function public.record_guided_learning_hint_v5(uuid, uuid) to authenticated');
    expect(migration).not.toMatch(/drop\s+table|truncate\s+/i);
  });

  it('counts only unanswered-without-hint correctness as adaptive evidence while retaining attempt score', () => {
    expect(normalizedMigration).toContain("step.metadata->'used_hint_question_ids'");
    expect(normalizedMigration).toContain("'used_hint',used_hint");
    expect(normalizedMigration).toContain("'independent_score',evidence_score");
    expect(normalizedMigration).toContain("'assisted_question_count',assisted_count");
    expect(normalizedMigration).toContain('evidence_score>=80,evidence_score');
    expect(normalizedMigration).toContain("outcome:=case when evidence_score>=80 then 'SUCCESS' else 'GAP' end;");
    expect(normalizedMigration).toContain("'score',score,'independent_score',evidence_score");
    expect(normalizedMigration).toContain("'has_hint'");
  });
});
