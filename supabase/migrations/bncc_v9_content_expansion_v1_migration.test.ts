import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildV9ContentExpansionMigration } from '../../tools/adaptive/generate-v9-content-expansion';

const migration = readFileSync(new URL('./20261011000500_bncc_v9_content_expansion_v1.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('BNCC V9 authored content expansion migration', () => {
  it('adds demo-only questions with pending human review and protects idempotency', () => {
    expect(migration).toBe(buildV9ContentExpansionMigration());
    expect(migration).toContain("existing.source_type='TECESCOLA_V9_AUTHORED_V1'");
    expect(migration).toContain('V9_EXPANSION_IDEMPOTENCY_CONTENT_MISMATCH');
    expect(migration).toContain('v_question_count < 20');
    expect(migration).toContain('V9_EXPANSION_JOURNEY_COUNT_MISMATCH');
    expect(migration).toContain("'pedagogical_review_status','PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain('"demo_preview_only":true');
    expect(migration).toContain('learning_skill_lessons(canonical_skill_id,version,title,summary,content_markdown,worked_example,tips,estimated_minutes,metadata,active)');
    expect(migration).toContain("existing.canonical_skill_id=v_skill_id and existing.version=5");
    expect(migration).toContain('V9_EXPANSION_LESSON_IDEMPOTENCY_MISMATCH');
    expect(migration).toContain(' and estimated_minutes=');
    expect(migration).not.toMatch(/delete\s+from\s+public\.learning_(guided_sessions|guided_steps|guided_step_attempts)/i);
    expect(migration).not.toMatch(/truncate\s+/i);
  });

  it('accepts larger fresh pools while preserving server selection and a distinct content state', () => {
    expect(migration).toContain("replace(function_definition, ') = 2', ') >= 2')");
    expect(migration).toContain("'CONTENT_EXHAUSTED'");
    expect(migration).toContain("'CONTENT_POOL_RESTORED'");
    expect(migration).toContain('private.pick_guided_v4_fresh_question_set');
    expect(migration).toContain("'selection_integrity_version','SERVER_SELECTED_V1'");
    expect(migration).toContain('LEARNING_V9_CONTENT_STILL_EXHAUSTED');
    expect(migration).toContain('mastery_unproven');
  });

  it('keeps content-resumption authorization server-side and returns remediation guidance only after grading', () => {
    expect(migration).toContain('private.assert_bncc_discipline_journey_v9(p_institution_id,p_student_id,p_journey_id)');
    expect(migration).toContain("session_row.decision_reason not in ('CONTENT_EXHAUSTED','REMEDIATION_QUESTION_POOL_EXHAUSTED')");
    expect(migration).toContain("'error_focus', case when not correct then item.metadata->>'error_focus' else null end");
    expect(migration).toContain("'remediation_hint', case when not correct then item.metadata->>'remediation_hint' else null end");
    expect(migration).toContain('V9_START_JOURNEY_LESSON_PATCH_MISMATCH');
    expect(migration).toContain('select max(latest.version) from public.learning_skill_lessons latest');
    expect(migration).toContain('grant execute on function public.resume_content_exhausted_guided_journey_v9(uuid,uuid,uuid) to authenticated');
    expect(migration).toContain('revoke all on function public.resume_content_exhausted_guided_journey_v9(uuid,uuid,uuid) from public,anon');
  });
});
