import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Allow Account Owner Select All Institutions Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260730000100_allow_account_owner_select_all_institutions.sql'
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('drops existing institutions_select_policy', () => {
    expect(migrationSql).toMatch(/drop\s+policy\s+if\s+exists\s+institutions_select_policy\s+on\s+public\.institutions/i);
  });

  it('allows account owner to select institutions via owns_account', () => {
    expect(migrationSql).toMatch(/public\.owns_account\s*\(\s*account_id\s*\)/i);
  });

  it('allows super admin to select institutions', () => {
    expect(migrationSql).toMatch(/public\.is_platform_super_admin\s*\(\s*\)/i);
  });
});
