import {
  readFileSync,
} from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';

const serviceSource = readFileSync(
  new URL('./brandingService.ts', import.meta.url),
  'utf8',
);

const migrationSource = readFileSync(
  new URL(
    '../../supabase/migrations/20260722000300_global_account_branding.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('branding isolation regressions', () => {
  it('nao resolve conta a partir de split do subdominio', () => {
    expect(serviceSource).not.toContain('hostname.split');
    expect(migrationSource).not.toContain('split_part');
    expect(migrationSource).toContain('public.account_domains');
    expect(migrationSource).toContain("domain.status = 'ACTIVE'");
  });

  it('mantem o dominio principal reservado no fallback global', () => {
    expect(migrationSource).toContain(
      'edumoneyyyy.weslleyfreitassantos.workers.dev',
    );
    expect(migrationSource).toContain(
      "normalized_hostname <> 'edumoneyyyy.weslleyfreitassantos.workers.dev'",
    );
  });

  it('evita single cego no servico novo de branding', () => {
    expect(serviceSource).not.toContain('.single()');
    expect(serviceSource).toContain('.maybeSingle()');
    expect(serviceSource).toContain('BRANDING_UPDATE_EMPTY');
  });

  it('nao usa Math.random para nomes de arquivos no Storage', () => {
    expect(serviceSource).not.toContain('Math.random');
    expect(serviceSource).toContain('randomUUID');
    expect(serviceSource).toContain('getRandomValues');
  });
});
