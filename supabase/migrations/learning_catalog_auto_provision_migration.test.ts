import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261127000300_learning_catalog_auto_provision.sql', 'utf8');

describe('automatic learning catalog provisioning', () => {
  it('provisions operational institutions, active accounts, and newly published courses', () => {
    expect(migration).toContain('private.provision_tec_learning_releases');
    expect(migration).toContain('public.is_institution_operational(institution.id)');
    expect(migration).toContain("course.publication_status = 'PUBLISHED'");
    expect(migration).toContain('not course.is_test_fixture');
    expect(migration).toContain('provision_tec_learning_releases_after_institution');
    expect(migration).toContain('provision_tec_learning_releases_after_account');
    expect(migration).toContain('provision_tec_learning_releases_after_course');
    expect(migration).toContain('on conflict (course_code, institution_id) do nothing');
  });
});
