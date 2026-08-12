import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Admin institution name RPC migration audit', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260812000100_admin_update_institution_name.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('cria uma RPC autenticada especifica para renomear instituicoes', () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.update_admin_institution_name\(\s*target_institution_id uuid,\s*new_name text\s*\)/i,
    );
    expect(migrationSql).toMatch(/security definer/i);
    expect(migrationSql).toMatch(/set search_path = ''/i);
    expect(migrationSql).toMatch(/auth\.uid\(\)/i);
    expect(migrationSql).toMatch(/public\.is_platform_super_admin\(\)/i);
    expect(migrationSql).toMatch(/public\.owns_account\(target_account_id\)/i);
  });

  it('valida e normaliza o nome no servidor', () => {
    expect(migrationSql).toMatch(
      /normalized_name := btrim\(coalesce\(new_name, ''\)\)/i,
    );
    expect(migrationSql).toMatch(/normalized_name = ''/i);
    expect(migrationSql).toMatch(/using errcode = '23514'/i);
  });

  it('atualiza somente name e nao aceita accountId como prova de acesso', () => {
    const functionSql = migrationSql.match(
      /create or replace function public\.update_admin_institution_name[\s\S]*?notify pgrst/i,
    )?.[0] ?? '';

    expect(functionSql).toMatch(/set name = normalized_name/i);
    expect(functionSql).not.toMatch(/set\s+subdomain\s*=/i);
    expect(functionSql).not.toMatch(/set\s+active\s*=/i);
    expect(functionSql).not.toMatch(/set\s+account_id\s*=/i);
    expect(functionSql).not.toMatch(/updated_at\s*=/i);
    expect(functionSql).not.toMatch(/accountId/i);
    expect(functionSql).not.toMatch(/target_account_id uuid\s*[,)]/i);
  });

  it('rejeita conta inexistente ou usuario sem autorizacao', () => {
    expect(migrationSql).toMatch(/if not found then/i);
    expect(migrationSql).toMatch(/using errcode = 'P0002'/i);
    expect(migrationSql).toMatch(/using errcode = '42501'/i);
    expect(migrationSql).toMatch(
      /target_account_id is not null\s+and public\.owns_account\(target_account_id\)/i,
    );
  });

  it('revoga acesso generico e concede EXECUTE somente a authenticated', () => {
    expect(migrationSql).toMatch(
      /revoke all on function public\.update_admin_institution_name\(uuid, text\)\s+from public, anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.update_admin_institution_name\(uuid, text\)\s+to authenticated;/i,
    );
    expect(migrationSql).not.toMatch(/to anon/i);
    expect(migrationSql).not.toMatch(/grant update .*institutions/i);
  });
});
