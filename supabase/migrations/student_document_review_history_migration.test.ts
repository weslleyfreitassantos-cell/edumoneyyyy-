import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261023000100_student_document_review_history.sql', import.meta.url),
  'utf8',
);

describe('student document review history migration', () => {
  it('supports optional, requested, review, rejection, and disposition states', () => {
    expect(migration).toContain("alter column status set default 'NOT_REQUESTED'");
    for (const status of ['NOT_REQUESTED', 'REQUESTED', 'UNDER_REVIEW', 'REJECTED']) {
      expect(migration).toContain(`'${status}'`);
    }
    expect(migration).toContain("status not in ('REJECTED', 'DISPENSED')");
    expect(migration).toContain("nullif(btrim(notes), '') is not null");
  });

  it('records status transitions with actor and time while keeping the log read-only to clients', () => {
    expect(migration).toContain('public.student_document_status_history');
    expect(migration).toContain('actor_profile_id');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('public.can_manage_institution_operations(institution_id)');
    expect(migration).toContain('grant select on table public.student_document_status_history to authenticated');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('after insert or update on public.student_documents');
  });
});
