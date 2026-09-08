import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260906222415_advisor_performance_hardening.sql',
  ),
  'utf8',
);

describe('advisor performance hardening migration', () => {
  it('makes backend-only tables explicitly deny direct API access', () => {
    expect(
      (migrationSql.match(/no_direct_access/g) ?? []).length,
    ).toBe(5);
    expect(migrationSql).toContain('using (false)');
    expect(migrationSql).toContain('with check (false)');
  });

  it('optimizes all advisor-reported auth policy evaluations', () => {
    expect(
      (migrationSql.match(/alter policy /g) ?? []).length,
    ).toBe(24);
    expect(migrationSql).toContain('(select auth.uid())');
  });

  it('adds a covering index for every advisor-reported foreign key', () => {
    expect(
      (migrationSql.match(/create index if not exists /g) ?? []).length,
    ).toBe(61);
  });
});
