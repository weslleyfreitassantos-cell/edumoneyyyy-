import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Harden Director Institution Branding Write Migration Audit', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260807165600_harden_director_institution_branding_write.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('contem somente o hardening da policy generica de update de institutions', () => {
    expect(migrationSql).toMatch(
      /drop policy if exists institutions_update_branding_policy/i,
    );
    expect(migrationSql).toMatch(
      /create policy institutions_update_branding_policy/i,
    );
    expect(migrationSql).not.toMatch(/alter table/i);
    expect(migrationSql).not.toMatch(/create or replace function/i);
    expect(migrationSql).not.toMatch(/grant execute/i);
  });

  it('remove DIRECTOR do UPDATE generico e preserva escrita administrativa', () => {
    const policySql = migrationSql.match(
      /create policy institutions_update_branding_policy[\s\S]*?with check \([\s\S]*?\);/i,
    )?.[0] ?? '';

    expect(policySql).toMatch(/public\.is_platform_super_admin\(\)/i);
    expect(policySql).toMatch(/public\.owns_account\(account_id\)/i);
    expect(policySql).not.toMatch(/DIRECTOR/i);
    expect(policySql).not.toMatch(/public\.memberships/i);
  });
});
