import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    './20261005000300_platform_login_background.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('platform login background migration', () => {
  it('persiste o background global como path de Storage', () => {
    expect(migration).toContain(
      'add column if not exists login_background_path text',
    );
    expect(migration).toContain(
      'branding_settings_login_background_path_scope_check',
    );
    expect(migration).toContain(
      "current_kind in ('logo', 'favicon', 'background')",
    );
  });

  it('mantem limite de 5 MB para background no Storage', () => {
    expect(migration).toContain(
      "when asset_kind = 'background' then 5 * 1024 * 1024",
    );
  });

  it('retorna o path no resolver publico para admin e contas', () => {
    expect(migration).toContain('login_background_path text');
    expect(migration).toContain(
      'account_branding.login_background_path',
    );
    expect(migration).toContain(
      'global_branding.login_background_path',
    );
    expect(migration).toContain(
      'grant execute on function public.resolve_public_branding(text)',
    );
  });
});
