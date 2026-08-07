import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Institution Login Branding Migration Audit', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260807165500_institution_login_branding.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('adiciona login_display_name e favicon_url em public.institutions', () => {
    expect(migrationSql).toMatch(
      /add column if not exists login_display_name text/i,
    );
    expect(migrationSql).toMatch(
      /add column if not exists favicon_url text/i,
    );
  });

  it('concede update dos novos campos para authenticated', () => {
    expect(migrationSql).toMatch(
      /grant update \(login_display_name, favicon_url, updated_at\)/i,
    );
    expect(migrationSql).toMatch(/to authenticated/i);
  });

  it('nao libera UPDATE generico em institutions para DIRECTOR', () => {
    expect(migrationSql).toMatch(
      /create policy institutions_update_branding_policy/i,
    );
    const policySql = migrationSql.match(
      /create policy institutions_update_branding_policy[\s\S]*?with check \([\s\S]*?\);/i,
    )?.[0] ?? '';

    expect(policySql).toMatch(/public\.is_platform_super_admin\(\)/i);
    expect(policySql).toMatch(/public\.owns_account\(account_id\)/i);
    expect(policySql).not.toMatch(/DIRECTOR/i);
    expect(policySql).not.toMatch(/public\.memberships/i);
  });

  it('cria RPC autenticada especifica para DIRECTOR atualizar somente branding', () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.update_institution_login_branding/i,
    );
    expect(migrationSql).toMatch(/target_institution_id uuid/i);
    expect(migrationSql).toMatch(/new_login_display_name text/i);
    expect(migrationSql).toMatch(/new_logo_url text/i);
    expect(migrationSql).toMatch(/new_favicon_url text/i);
    expect(migrationSql).toMatch(/new_primary_color text/i);
    expect(migrationSql).toMatch(/new_secondary_color text/i);
    expect(migrationSql).toMatch(/membership\.profile_id = auth\.uid\(\)/i);
    expect(migrationSql).toMatch(/membership\.institution_id = target_institution_id/i);
    expect(migrationSql).toMatch(/membership\.role = 'DIRECTOR'/i);
    expect(migrationSql).toMatch(/update public\.institutions as inst/i);
    expect(migrationSql).not.toMatch(/set\s+subdomain\s*=/i);
    expect(migrationSql).not.toMatch(/set\s+active\s*=/i);
    expect(migrationSql).not.toMatch(/set\s+account_id\s*=/i);
    expect(migrationSql).toMatch(
      /revoke all on function public\.update_institution_login_branding/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.update_institution_login_branding/i,
    );
  });

  it('protege storage de logo e favicon por pasta da institution do DIRECTOR', () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.can_director_write_institution_branding_object/i,
    );
    expect(migrationSql).toContain('logo|favicon');
    expect(migrationSql).toContain('png|jpg|jpeg|webp');
    expect(migrationSql).toMatch(/target_institution_id := path_match\[1\]::uuid/i);
    expect(migrationSql).toMatch(/membership\.institution_id = target_institution_id/i);
    expect(migrationSql).toMatch(
      /create policy institution_branding_director_insert/i,
    );
    expect(migrationSql).toMatch(
      /create policy institution_branding_director_update/i,
    );
    expect(migrationSql).toMatch(
      /create policy institution_branding_director_delete/i,
    );
  });

  it('define SECURITY DEFINER e limpa o search_path de forma segura', () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.resolve_public_institution_by_subdomain/i,
    );
    expect(migrationSql).toMatch(/security definer/i);
    expect(migrationSql).toMatch(/set search_path = ''/i);
  });

  it('schema-qualifica todas as tabelas referenciadas', () => {
    expect(migrationSql).toMatch(/from public\.institutions as inst/i);
    expect(migrationSql).toMatch(/left join public\.accounts as acc/i);
  });

  it('retorna login_display_name e favicon_url na assinatura da RPC', () => {
    expect(migrationSql).toMatch(
      /returns table \(\s*id uuid,\s*name text,\s*subdomain text,\s*login_display_name text,\s*logo_url text,\s*favicon_url text,\s*primary_color text,\s*secondary_color text\s*\)/i,
    );
  });

  it('seleciona os novos campos no corpo da RPC', () => {
    expect(migrationSql).toMatch(/inst\.login_display_name/i);
    expect(migrationSql).toMatch(/inst\.favicon_url/i);
  });

  it('revoga explicitamente EXECUTE de PUBLIC e concede apenas para anon e authenticated', () => {
    expect(migrationSql).toMatch(
      /revoke all on function public\.resolve_public_institution_by_subdomain\(text\)\s+from public, anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.resolve_public_institution_by_subdomain\(text\)\s+to anon, authenticated;/i,
    );
  });

  it('preserva filtros existentes: subdominio minusculo, active, account ACTIVE e reservados', () => {
    expect(migrationSql).toMatch(
      /clean_subdomain := lower\(trim\(target_subdomain\)\);/i,
    );
    expect(migrationSql).toMatch(
      /where inst\.subdomain = clean_subdomain/i,
    );
    expect(migrationSql).toMatch(/and inst\.active is true/i);
    expect(migrationSql).toMatch(
      /\(inst\.account_id is null or acc\.status = 'ACTIVE'\)/i,
    );
    expect(migrationSql).toMatch(/'tecescola'/i);
  });

  it('nao expoe account_id, owner_profile_id, institution_limit ou dados privados na assinatura publica', () => {
    const publicRpc = migrationSql.match(
      /create or replace function public\.resolve_public_institution_by_subdomain[\s\S]*?revoke all on function public\.resolve_public_institution_by_subdomain/i,
    )?.[0] ?? '';
    const returnsTable = publicRpc.match(
      /returns table \(([\s\S]*?)\)\s*language/i,
    )?.[1] ?? '';

    expect(returnsTable).not.toMatch(/account_id/i);
    expect(publicRpc).not.toMatch(/owner_profile_id/i);
    expect(publicRpc).not.toMatch(/institution_limit/i);
  });
});
