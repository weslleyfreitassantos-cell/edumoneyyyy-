import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261026000100_psychology_institution_gate.sql', import.meta.url),
  'utf8',
);

describe('psychology institution gate migration', () => {
  it('exposes module management only through the institution manager check', () => {
    expect(migration).toContain('public.psychology_can_manage_module(target_institution_id uuid)');
    expect(migration).toContain('private.psychology_is_manager(target_institution_id)');
    expect(migration).toContain('grant execute on function public.psychology_can_manage_module(uuid) to authenticated');
  });

  it('blocks authorization rosters and revocation while preserving the existing consent workflow', () => {
    expect(migration).toContain("message = 'MODULE_DISABLED'");
    expect(migration).toContain('public.psychology_list_my_authorization_targets(target_institution_id uuid)');
    expect(migration).toContain('public.psychology_revoke_authorization(target_student_id uuid)');
    expect(migration).toContain("'AUTHORIZATION_REVOKED'");
  });

  it('hides authorization rows through RLS whenever the institution module is disabled', () => {
    expect(migration).toContain('drop policy if exists psychology_authorizations_select');
    expect(migration).toMatch(/create policy psychology_authorizations_select[\s\S]*?public\.psychology_module_enabled\(psychology_authorizations\.institution_id\)/);
    expect(migration).toContain('psychology_authorizations.institution_id');
    expect(migration).toContain('psychology_authorizations.student_id');
  });

  it('gates assignments and professional availability while retaining manager configuration access', () => {
    expect(migration).toMatch(/create policy psychology_professionals_select[\s\S]*?public\.psychology_module_enabled\(link\.institution_id\)/);
    expect(migration).toMatch(/create policy psychology_professional_institutions_select[\s\S]*?public\.psychology_module_enabled\(institution_id\)/);
    expect(migration).toMatch(/create policy psychology_assignments_select[\s\S]*?public\.psychology_module_enabled\(institution_id\)/);
    expect(migration).toMatch(/create policy psychology_availability_rules_select[\s\S]*?public\.psychology_module_enabled\(psychology_availability_rules\.institution_id\)/);
    expect(migration).toMatch(/create policy psychology_availability_exceptions_select[\s\S]*?public\.psychology_module_enabled\(psychology_availability_exceptions\.institution_id\)/);
    expect(migration).toContain('private.psychology_is_manager(institution_id)');
    expect(migration).not.toMatch(/create policy psychology_(?:assignments|professionals|professional_institutions)_select[\s\S]*?private\.psychology_module_is_enabled/);
  });
});
