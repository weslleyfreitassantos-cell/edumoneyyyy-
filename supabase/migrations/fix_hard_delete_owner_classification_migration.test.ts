import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Hard delete owner classification migration', () => {
  const migrationSql = readFileSync(
    new URL(
      './20260906010000_fix_hard_delete_owner_classification.sql',
      import.meta.url,
    ),
    'utf8',
  );

  it('classifies the account owner even without dependent records', () => {
    expect(migrationSql).toMatch(
      /for\s+linked_profile\s+in\s+select\s+account_record\.owner_profile_id\s+as\s+pid\s+union\s+select\s+distinct\s+m\.profile_id\s+as\s+pid/i,
    );
  });

  it('keeps shared-owner and exclusive-owner outcomes explicit', () => {
    expect(migrationSql).toMatch(
      /shared_profiles\s*:=\s*array_append/i,
    );
    expect(migrationSql).toMatch(
      /exclusive_profiles\s*:=\s*array_append/i,
    );
    expect(migrationSql).toMatch(
      /'exclusiveProfileIds',\s*exclusive_profiles/i,
    );
  });
});
