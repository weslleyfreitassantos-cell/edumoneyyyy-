import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Institution Login Background Migration Audit', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261005000100_institution_login_background.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('adiciona somente a coluna opcional do background', () => {
    expect(migrationSql).toMatch(
      /alter table public\.institutions\s+add column if not exists login_background_url text;/i,
    );
    expect(migrationSql).toMatch(/login_background_url text/i);
  });

  it('estende a RPC de escrita sem remover a autorizacao do diretor', () => {
    expect(migrationSql).toMatch(/new_login_background_url text default null/i);
    expect(migrationSql).toMatch(/set_login_background_url boolean default false/i);
    expect(migrationSql).toMatch(
      /login_background_url = case\s+when set_login_background_url then new_login_background_url\s+else inst\.login_background_url/i,
    );
    expect(migrationSql).toMatch(/membership\.profile_id = auth\.uid\(\)/i);
    expect(migrationSql).toMatch(/membership\.institution_id = target_institution_id/i);
    expect(migrationSql).toMatch(/membership\.role = 'DIRECTOR'/i);
  });

  it('permite somente paths de logo, favicon e background com MIME e limite coerentes', () => {
    expect(migrationSql).toContain('(logo|favicon|background)');
    expect(migrationSql).toContain('png|jpg|jpeg|webp');
    expect(migrationSql).toMatch(/asset_kind = 'background' then 5 \* 1024 \* 1024/i);
    expect(migrationSql).toMatch(/asset_extension = 'png'/i);
    expect(migrationSql).toMatch(/metadata_mimetype <> 'image\/png'/i);
    expect(migrationSql).not.toContain('svg');
  });

  it('reaplica as policies server-side do bucket existente', () => {
    expect(migrationSql).toContain("bucket_id = 'institution-branding'");
    expect(migrationSql).toMatch(/create policy institution_branding_director_insert/i);
    expect(migrationSql).toMatch(/create policy institution_branding_director_update/i);
    expect(migrationSql).toMatch(/create policy institution_branding_director_delete/i);
  });

  it('expõe apenas o novo campo visual na RPC publica', () => {
    const publicRpc = migrationSql.match(
      /create or replace function public\.resolve_public_institution_by_subdomain[\s\S]*?revoke all on function public\.resolve_public_institution_by_subdomain/i,
    )?.[0] ?? '';

    expect(publicRpc).toMatch(/login_background_url text/i);
    expect(publicRpc).toMatch(/inst\.login_background_url/i);
    expect(migrationSql).toMatch(/grant execute on function public\.resolve_public_institution_by_subdomain\(text\)\s+to anon, authenticated/i);
    const publicReturns = publicRpc.match(
      /returns table \(([\s\S]*?)\)\s*language/i,
    )?.[1] ?? '';
    expect(publicReturns).not.toMatch(/account_id|owner_profile_id|institution_limit/i);
  });

  it('nao edita a migration historica nem cria dependencia de readiness', () => {
    expect(migrationSql).toMatch(/drop function if exists public\.update_institution_login_branding/i);
    expect(migrationSql).not.toMatch(/operational_readiness|school_setup/i);
  });
});
