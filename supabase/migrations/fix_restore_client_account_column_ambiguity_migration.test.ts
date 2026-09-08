import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Fix restore_client_account column ambiguity migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260729000200_fix_restore_client_account_column_ambiguity.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('replaces restore_client_account without changing its signature', () => {
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.restore_client_account\(\s*target_account_id\s+uuid,\s*actor_profile_id\s+uuid,\s*change_reason\s+text\s+default\s+null\s*\)/i,
    );
  });

  it('uses explicit aliases for account_domains columns', () => {
    expect(migrationSql).toMatch(
      /from\s+public\.account_domains\s+as\s+domain[\s\S]*domain\.account_id\s+<>\s+account_record\.id/i,
    );
    expect(migrationSql).toMatch(
      /from\s+public\.account_domains\s+as\s+own_domain[\s\S]*own_domain\.account_id\s+=\s+account_record\.id/i,
    );
    expect(migrationSql).not.toMatch(
      /where\s+account_id\s+(?:<>|=)\s+account_record\.id/i,
    );
  });

  it('keeps service_role as the only executor', () => {
    expect(migrationSql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.restore_client_account\(uuid,\s*uuid,\s*text\)\s+from\s+public,\s*anon,\s*authenticated/i,
    );
    expect(migrationSql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.restore_client_account\(uuid,\s*uuid,\s*text\)\s+to\s+service_role/i,
    );
  });
});
