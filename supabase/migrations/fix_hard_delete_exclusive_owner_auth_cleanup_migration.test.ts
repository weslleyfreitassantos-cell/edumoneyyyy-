import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Hard Delete Exclusive Owner Auth Cleanup Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260729000300_fix_hard_delete_exclusive_owner_auth_cleanup.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('replaces hard_delete_client_account', () => {
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.hard_delete_client_account/i,
    );
  });

  it('does not always preserve the account owner', () => {
    expect(migrationSql).not.toMatch(
      /Ensure owner is never in exclusive list \(preserved\)/i,
    );
    expect(migrationSql).toMatch(
      /Exclusive owners must be deleted from Auth/i,
    );
  });

  it('keeps shared or super admin owners preserved', () => {
    expect(migrationSql).toMatch(/platform_role\s*=\s*'SUPER_ADMIN'/i);
    expect(migrationSql).toMatch(/email\s*=\s*'superadmin@admin\.com'/i);
    expect(migrationSql).toMatch(/shared_profiles\s*:=\s*array_append/i);
  });

  it('classifies exclusive owners for auth deletion', () => {
    expect(migrationSql).toMatch(
      /exclusive_profiles\s*:=\s*array_append\(exclusive_profiles,\s*account_record\.owner_profile_id\)/i,
    );
    expect(migrationSql).toMatch(/owner_preserved\s*:=\s*false/i);
  });
});
