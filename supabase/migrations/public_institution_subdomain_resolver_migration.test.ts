import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Public Institution Subdomain Resolver Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260807000100_public_institution_subdomain_resolver.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('cria a função RPC resolve_public_institution_by_subdomain com security definer e privilégios anon', () => {
    expect(migrationSql).toMatch(/create or replace function public\.resolve_public_institution_by_subdomain/i);
    expect(migrationSql).toMatch(/security definer/i);
    expect(migrationSql).toMatch(/set search_path = ''/i);
    expect(migrationSql).toMatch(/grant execute on function public\.resolve_public_institution_by_subdomain/i);
    expect(migrationSql).toMatch(/to anon, authenticated, service_role/i);
    expect(migrationSql).toMatch(/acc\.status = 'ACTIVE'/i);
  });
});
