import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260902000200_harden_sensitive_rpc_permissions.sql', import.meta.url),
  'utf8',
);

describe('harden sensitive RPC permissions migration', () => {
  it('revoga execução anônima das operações autenticadas', () => {
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('grant execute on function public.get_current_self_registration() to authenticated');
    expect(migration).toContain('grant execute on function public.update_current_self_registration(jsonb) to authenticated');
    expect(migration).toContain('grant execute on function public.create_full_student_enrollment_bundle(jsonb) to authenticated');
    expect(migration).toContain('grant execute on function public.update_full_student_enrollment_bundle(jsonb) to authenticated');
    expect(migration).toContain('grant execute on function public.can_view_institution_profile(uuid) to authenticated');
  });

  it('mantém branding público e fixa o search_path do resolver', () => {
    expect(migration).toContain('alter function public.get_public_institution_branding(text)');
    expect(migration).toContain('set search_path = \'\';');
    expect(migration).not.toMatch(/revoke all on function public\.get_public_institution_branding/i);
  });
});
