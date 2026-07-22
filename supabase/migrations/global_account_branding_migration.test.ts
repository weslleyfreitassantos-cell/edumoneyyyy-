import {
  readFileSync,
} from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';

const migration = readFileSync(
  new URL(
    './20260722000300_global_account_branding.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('global account branding migration', () => {
  it('define constraints e unicidade por escopo', () => {
    expect(migration).toContain('branding_settings_scope_account_check');
    expect(migration).toContain('branding_settings_one_global_idx');
    expect(migration).toContain('branding_settings_one_account_idx');
    expect(migration).toContain('account_domains_hostname_unique_idx');
    expect(migration).toContain('account_domains_hostname_not_reserved');
  });

  it('habilita RLS e policies de escrita isoladas', () => {
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toContain('branding_settings_update_policy');
    expect(migration).toContain('account_domains_insert_policy');
    expect(migration).toContain('public.owns_account(account_id)');
    expect(migration).toContain('public.is_platform_super_admin()');
  });

  it('limita a RPC publica e usa search_path explicito', () => {
    expect(migration).toContain('resolve_public_branding');
    expect(migration).toContain('returns table');
    expect(migration).toContain('set search_path =');
    expect(migration).toContain('grant execute on function public.resolve_public_branding(text)');
    expect(migration).not.toMatch(/owner_profile_id|email|membership/i);
  });

  it('inclui policies de Storage e hostnames reservados', () => {
    expect(migration).toContain('branding_storage_write_policy');
    expect(migration).toContain('branding/global');
    expect(migration).toContain('branding/accounts');
    expect(migration).toContain('edumoneyyyy.weslleyfreitassantos.workers.dev');
    expect(migration).toContain('localhost');
  });
});
