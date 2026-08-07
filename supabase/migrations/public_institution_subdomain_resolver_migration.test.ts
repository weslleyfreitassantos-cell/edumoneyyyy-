import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Public Institution Subdomain Resolver Migration Audit', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260807000100_public_institution_subdomain_resolver.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('define SECURITY DEFINER e limpa o search_path de forma segura', () => {
    expect(migrationSql).toMatch(/create or replace function public\.resolve_public_institution_by_subdomain/i);
    expect(migrationSql).toMatch(/security definer/i);
    expect(migrationSql).toMatch(/set search_path = ''/i);
  });

  it('schema-qualifica todas as tabelas referenciadas', () => {
    expect(migrationSql).toMatch(/from public\.institutions as inst/i);
    expect(migrationSql).toMatch(/left join public\.accounts as acc/i);
  });

  it('revoga explicitamente EXECUTE de PUBLIC e concede apenas para anon e authenticated', () => {
    expect(migrationSql).toMatch(/revoke all on function public\.resolve_public_institution_by_subdomain\(text\)\s+from public, anon, authenticated;/i);
    expect(migrationSql).toMatch(/grant execute on function public\.resolve_public_institution_by_subdomain\(text\)\s+to anon, authenticated;/i);
  });

  it('filtra por subdomínio minúsculo, instituição ativa e conta ativa', () => {
    expect(migrationSql).toMatch(/clean_subdomain := lower\(trim\(target_subdomain\)\);/i);
    expect(migrationSql).toMatch(/where inst\.subdomain = clean_subdomain/i);
    expect(migrationSql).toMatch(/and inst\.active is true/i);
    expect(migrationSql).toMatch(/\(inst\.account_id is null or acc\.status = 'ACTIVE'\)/i);
  });

  it('retorna exclusivamente campos públicos e omite account_id, owner_profile_id e dados privados', () => {
    expect(migrationSql).toMatch(/returns table \(\s*id uuid,\s*name text,\s*subdomain text,\s*logo_url text,\s*primary_color text,\s*secondary_color text\s*\)/i);
    expect(migrationSql).not.toMatch(/owner_profile_id/i);
    expect(migrationSql).not.toMatch(/institution_limit/i);
  });
});
