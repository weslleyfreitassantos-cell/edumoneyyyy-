import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260911000300_multitenant_runtime_grants.sql',
  ),
  'utf8',
);

describe('multi-tenant runtime grants migration', () => {
  it('grants only the runtime operations required by authenticated clients', () => {
    expect(migrationSql).toContain(
      'grant select, insert, update on table public.access_devices',
    );
    expect(migrationSql).toContain(
      'grant select on table public.access_events',
    );
    expect(migrationSql).toContain(
      'grant select, insert on table public.financial_contracts,',
    );
    expect(migrationSql).toContain('grant insert on table public.access_events');
    expect(migrationSql).not.toMatch(/grant\s+all/i);
    expect(migrationSql).toMatch(/from anon/i);
  });

  it('keeps operational RLS scoped to director and secretary', () => {
    expect(migrationSql).toContain("array['DIRECTOR', 'SECRETARY']");
    expect(migrationSql).not.toMatch(
      /access_(?:devices|events)[\s\S]*?array\['ADMIN'/i,
    );
    expect(migrationSql).not.toMatch(
      /finance_(?:contract|invoice|payment)_staff[\s\S]*?array\['ADMIN'/i,
    );
  });
});
