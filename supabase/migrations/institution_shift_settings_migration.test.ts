import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260828000200_institution_shift_settings.sql',
  ),
  'utf8',
);

describe('institution shift settings migration', () => {
  it('creates a safe institution-scoped setting', () => {
    expect(migration).toContain('create table if not exists public.institution_shift_settings');
    expect(migration).toContain("default array['MATUTINO']::text[]");
    expect(migration).toContain('institution_shift_settings_supported');
  });

  it('keeps the rollout additive and does not rewrite existing records', () => {
    expect(migration).toContain('Existing records are intentionally not rewritten');
    expect(migration).not.toMatch(/update public\.(classes|school_time_slots)/i);
  });

  it('protects the setting with tenant-aware policies', () => {
    expect(migration).toContain('public.can_access_institution(institution_id)');
    expect(migration).toContain('public.is_institution_admin(institution_id)');
  });
});
