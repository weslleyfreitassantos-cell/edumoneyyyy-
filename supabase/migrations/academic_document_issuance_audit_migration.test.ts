import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261023000500_academic_document_issuance_audit.sql', import.meta.url),
  'utf8',
);

describe('academic document issuance audit migration', () => {
  it('stores only audit references and restricts direct writes', () => {
    expect(migration).toContain('actor_profile_id uuid not null');
    expect(migration).toContain('document_type text not null');
    expect(migration).toContain('revoke all on public.academic_document_issuances from public, anon, authenticated');
    expect(migration).toContain('grant select on public.academic_document_issuances to authenticated');
    expect(migration).toContain('academic_document_issuances_manager_read');
    expect(migration).not.toMatch(/create policy[\s\S]*?for insert/i);
    expect(migration).not.toMatch(/\bhealth\s+(text|jsonb)|allerg|diagnos|payload\s+jsonb/i);
  });

  it('requires complete official attendance closure and persisted prior-year enrollment', () => {
    expect(migration).toContain("p_document_type = 'ATTENDANCE_DECLARATION'");
    expect(migration).toContain('result.finalized_at is not null');
    expect(migration).toContain('result.attendance_percentage is not null');
    expect(migration).toContain('v_complete_count <> v_expected_count');
    expect(migration).toContain("p_document_type = 'REENROLLMENT_RECEIPT'");
    expect(migration).toContain('previous_year.end_date < v_year_start');
  });

  it('exposes audited issuance only through the manager-authorized RPC', () => {
    expect(migration).toContain('create or replace function public.record_academic_document_issuance(');
    expect(migration).toContain("array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]");
    expect(migration).toContain('revoke all on function public.record_academic_document_issuance');
    expect(migration).toContain('grant execute on function public.record_academic_document_issuance');
  });
});
