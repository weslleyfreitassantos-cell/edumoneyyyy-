import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261127000400_learning_catalog_default_access.sql', 'utf8');

describe('default learning catalog access', () => {
  it('removes trigger-based provisioning and keeps an explicit opt-out', () => {
    expect(migration).toContain('drop trigger if exists provision_tec_learning_releases_after_institution');
    expect(migration).toContain('institution.active is true');
    expect(migration).toContain("account.status = 'ACTIVE'");
    expect(migration).toContain('release.enabled is false');
    expect(migration).toContain("course.publication_status = 'PUBLISHED'");
  });
});
