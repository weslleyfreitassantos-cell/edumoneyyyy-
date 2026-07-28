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

const assetEnforcementMigration = readFileSync(
  new URL(
    './20260722000400_branding_asset_enforcement.sql',
    import.meta.url,
  ),
  'utf8',
);

const pathSourceOfTruthMigration = readFileSync(
  new URL(
    './20260722000500_branding_paths_as_source_of_truth.sql',
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

  it('cria migration corretiva para enforcement de assets', () => {
    expect(assetEnforcementMigration).toContain(
      'is_valid_branding_asset_path',
    );
    expect(assetEnforcementMigration).toContain(
      'is_valid_branding_asset_url',
    );
    expect(assetEnforcementMigration).toContain(
      'is_valid_branding_storage_metadata',
    );
    expect(assetEnforcementMigration).toContain(
      'branding_settings_logo_pair_check',
    );
    expect(assetEnforcementMigration).toContain(
      'branding_settings_logo_url_matches_path_check',
    );
    expect(assetEnforcementMigration).toContain(
      'branding_storage_insert_policy',
    );
    expect(assetEnforcementMigration).toContain(
      'branding_storage_update_policy',
    );
    expect(assetEnforcementMigration).toContain(
      'branding_storage_delete_policy',
    );
  });

  it('valida metadata, MIME, extensoes e limites no Storage', () => {
    expect(assetEnforcementMigration).toContain("object_metadata ->> 'mimetype'");
    expect(assetEnforcementMigration).toContain("object_metadata ->> 'size'");
    expect(assetEnforcementMigration).toContain("'image/png'");
    expect(assetEnforcementMigration).toContain("'image/jpeg'");
    expect(assetEnforcementMigration).toContain("'image/webp'");
    expect(assetEnforcementMigration).toContain('(png|jpg|webp)');
    expect(assetEnforcementMigration).toContain('2 * 1024 * 1024');
    expect(assetEnforcementMigration).toContain('512 * 1024');
  });

  it('documenta que assert textual nao substitui smoke DB real', () => {
    expect(assetEnforcementMigration).toContain(
      "coalesce((storage.foldername(name))[1], '') <> 'branding'",
    );
    expect(assetEnforcementMigration).toContain(
      '/storage/v1/object/public/institution-branding/',
    );
    expect(assetEnforcementMigration).toContain('?v=');
  });

  it('remove URL publica como fonte de verdade no schema ativo', () => {
    expect(pathSourceOfTruthMigration).toContain(
      'drop constraint if exists branding_settings_logo_pair_check',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'drop constraint if exists branding_settings_favicon_pair_check',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'drop constraint if exists branding_settings_logo_url_matches_path_check',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'drop constraint if exists branding_settings_favicon_url_matches_path_check',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'drop function if exists public.is_valid_branding_asset_url(text, text)',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'drop column if exists logo_url',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'drop column if exists favicon_url',
    );
  });

  it('recria resolve_public_branding retornando paths sem URLs', () => {
    expect(pathSourceOfTruthMigration).toContain(
      'returns table (',
    );
    expect(pathSourceOfTruthMigration).toContain('logo_path text');
    expect(pathSourceOfTruthMigration).toContain('favicon_path text');
    expect(pathSourceOfTruthMigration).not.toContain('logo_url text');
    expect(pathSourceOfTruthMigration).not.toContain('favicon_url text');
    expect(pathSourceOfTruthMigration).toContain(
      'coalesce(account_branding.logo_path, global_branding.logo_path)',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'coalesce(account_branding.favicon_path, global_branding.favicon_path)',
    );
    expect(pathSourceOfTruthMigration).toContain(
      'grant execute on function public.resolve_public_branding(text)',
    );
    expect(pathSourceOfTruthMigration).not.toContain('supabase.co');
    expect(pathSourceOfTruthMigration).not.toContain(
      '/storage/v1/object/public',
    );
  });
});
