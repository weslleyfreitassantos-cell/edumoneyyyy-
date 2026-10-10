import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20261010000200_enem_subject_classification_bncc_global_discovery_v2.sql', import.meta.url), 'utf8');

describe('ENEM classification and global BNCC discovery migration', () => {
  it('backfills only explicit Xequemat taxonomy evidence', () => {
    expect(migration).toContain('classify_enem_topic_v2');
    expect(migration).toContain('XEQUEMAT_TOPIC_TAXONOMY_V2');
    expect(migration).toContain("coalesce(question_bank.metadata->>'enem_subject', '') = ''");
    expect(migration).toContain("classification_review_state");
    expect(migration).toContain("question_bank.source_type = 'ENEM_STRUCTURED_PROVIDER'");
    expect(migration).toContain("structured-text-only-v6");
    expect(migration).toContain("not structured.required_media_present");
    expect(migration).not.toContain('delete from public.learning_enem_structured_content');
    expect(migration).not.toContain('correct_answer =');
    expect(migration).not.toContain('learning_attempt');
  });

  it('discovers BNCC from enrollment context without institution subject offerings', () => {
    const discovery = migration.slice(migration.indexOf('create or replace function public.list_student_guided_learning_targets'));
    expect(discovery).toContain('public.enrollments');
    expect(discovery).toContain('public.learning_curriculum_grade_targets');
    expect(discovery).toContain("catalog.code = 'BNCC_2018'");
    expect(discovery).not.toContain('public.subject_offerings');
    expect(discovery).not.toContain('learning_curriculum_subject_links');
    expect(discovery).toContain('null::uuid as subject_id');
  });

  it('keeps global BNCC entry server-side scoped and stage/grade checked', () => {
    expect(migration).toContain('private.learning_v2_scope_student');
    expect(migration).toContain('LEARNING_V4_BNCC_MAPPING_REQUIRED');
    expect(migration).toContain('LEARNING_V4_TARGET_NOT_ELIGIBLE');
    expect(migration).toContain('target_stage');
    expect(migration).toContain('target_grade');
    expect(migration).toContain('create or replace function private.assert_bncc_guided_session_scope');
  });
});
