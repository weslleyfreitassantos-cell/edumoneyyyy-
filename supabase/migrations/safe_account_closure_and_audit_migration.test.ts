import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Safe Account Closure and Audit Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260726000200_safe_account_closure_and_audit.sql'
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('uses btrim for normalization', () => {
    expect(migrationSql).toMatch(/btrim\s*\(/);
  });

  it('collapses whitespace using regexp_replace with \\s+', () => {
    expect(migrationSql).toMatch(/regexp_replace\s*\(\s*coalesce\s*\(\s*change_reason\s*,\s*''\s*\)\s*,\s*'\\s\+'\s*,\s*' '\s*,\s*'g'\s*\)/);
  });

  it('requires reason for SUSPENDED and CANCELED status in RPC', () => {
    expect(migrationSql).toMatch(/if\s+normalized_status\s+in\s*\(\s*'SUSPENDED'\s*,\s*'CANCELED'\s*\)\s+and\s+normalized_reason\s+is\s+null\s+then/i);
  });

  it('validates non-null reason length between 10 and 500 in RPC', () => {
    expect(migrationSql).toMatch(/if\s+normalized_reason\s+is\s+not\s+null\s+and\s+not\s*\(\s*length\s*\(\s*normalized_reason\s*\)\s+between\s+10\s+and\s+500\s*\)\s+then/i);
  });

  it('permits null reason for ACTIVE in table constraints', () => {
    expect(migrationSql).toMatch(/constraint\s+account_status_events_reason_required_check\s+check\s*\(\s*new_status\s*=\s*'ACTIVE'\s+or\s+reason\s+is\s+not\s+null\s*\)/i);
    expect(migrationSql).toMatch(/constraint\s+account_status_events_reason_length_check\s+check\s*\(\s*reason\s+is\s+null\s+or\s+length\s*\(\s*reason\s*\)\s+between\s+10\s+and\s+500\s*\)/i);
  });

  it('maintains security definer for RPC', () => {
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.change_account_status[\s\S]*?security\s+definer/i);
  });

  it('maintains search_path set to empty string for RPC', () => {
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.change_account_status[\s\S]*?set\s+search_path\s*=\s*''/i);
  });

  it('restricts execution of change_account_status to service_role', () => {
    expect(migrationSql).toMatch(/revoke\s+all\s+on\s+function\s+public\.change_account_status\(uuid,\s*text,\s*uuid,\s*text,\s*jsonb\)\s+from\s+public,\s*anon,\s*authenticated;/i);
    expect(migrationSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.change_account_status\(uuid,\s*text,\s*uuid,\s*text,\s*jsonb\)\s+to\s+service_role;/i);
  });
});
