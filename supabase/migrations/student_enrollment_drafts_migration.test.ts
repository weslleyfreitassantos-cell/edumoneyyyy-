import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261023000400_student_enrollment_drafts.sql', import.meta.url),
  'utf8',
);

describe('student enrollment drafts migration', () => {
  it('keeps drafts institution-scoped and limits access to authenticated school managers', () => {
    expect(migration).toContain('alter table public.student_enrollment_drafts enable row level security');
    expect(migration).toContain('private.has_institution_role(');
    expect(migration).toContain("array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]");
    expect(migration).toContain('draft.institution_id = p_institution_id');
    expect(migration).toContain('revoke all on public.student_enrollment_drafts from public, anon, authenticated');
  });

  it('validates payload shape and size while rejecting file material and credentials', () => {
    expect(migration).toContain('octet_length(p_payload::text) > 262144');
    expect(migration).toContain('private.valid_student_enrollment_draft_payload(p_payload)');
    expect(migration).toContain('file_path|filepath|signed_url|signedurl|storage_url|storageurl');
    expect(migration).toContain("jsonb_typeof(p_payload->'health') is distinct from 'object'");
    expect(migration).toContain("p_payload->'health' - array[");
    expect(migration).toContain("p_payload->'identity' - array[");
    expect(migration).toContain("length(p_payload->'health'->>'allergies') > 2000");
  });

  it('uses optimistic versions, soft discard, resumable progress and an atomic idempotent completion', () => {
    expect(migration).toContain('version = p_expected_version');
    expect(migration).toContain("status = 'DISCARDED'");
    expect(migration).toContain("status = 'FINALIZING'");
    expect(migration).toContain("if v_draft.status = 'COMPLETED' then");
    expect(migration).toContain('public.create_full_student_enrollment_bundle(v_payload)');
    expect(migration).toContain('completion_result = v_result');
    expect(migration).toContain('create or replace function public.finalize_student_enrollment_draft(\n  p_institution_id uuid,\n  p_draft_id uuid\n)');
    expect(migration).toContain("'identity', v_draft.payload->'identity'");
    expect(migration).toContain("'guardians', v_guardians");
    const finalizer = migration.split('create or replace function public.finalize_student_enrollment_draft(')[1]
      ?.split('revoke all on function public.finalize_student_enrollment_draft(')[0];
    expect(finalizer).toBeDefined();
    expect(finalizer).not.toContain('p_payload');
  });

  it('does not expose draft RPCs to anonymous or public callers', () => {
    const rpcNames = [
      'save_student_enrollment_draft',
      'list_student_enrollment_drafts',
      'get_student_enrollment_draft',
      'discard_student_enrollment_draft',
      'claim_student_enrollment_draft_finalization',
      'record_student_enrollment_draft_progress',
      'release_student_enrollment_draft_finalization',
      'finalize_student_enrollment_draft',
    ];

    for (const rpcName of rpcNames) {
      expect(migration).toContain(`revoke all on function public.${rpcName}`);
      expect(migration).toContain(`grant execute on function public.${rpcName}`);
    }
  });
});
