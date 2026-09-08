import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Institution Suspension Ownership Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260803000100_institution_suspension_ownership.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('adds suspension ownership metadata', () => {
    expect(migrationSql).toMatch(/suspended_by_profile_id/i);
    expect(migrationSql).toMatch(/suspended_by_scope/i);
    expect(migrationSql).toMatch(/suspended_at/i);
    expect(migrationSql).toMatch(/'PLATFORM'/);
    expect(migrationSql).toMatch(/'ACCOUNT'/);
  });

  it('counts suspended institutions as used licenses', () => {
    expect(migrationSql).toMatch(
      /select\s+count\(\*\)\s+into\s+used_institution_count/i,
    );
    expect(migrationSql).toMatch(
      /where\s+institution\.account_id\s*=\s*new\.account_id/i,
    );
    expect(migrationSql).not.toMatch(
      /where\s+institution\.account_id\s*=\s*new\.account_id[\s\S]{0,160}institution\.active\s+is\s+true/i,
    );
  });
});
