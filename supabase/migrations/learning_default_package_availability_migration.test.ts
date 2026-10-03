import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const availability = readFileSync('supabase/migrations/20261003000900_learning_default_package_availability.sql', 'utf8');
const defaults = readFileSync('supabase/migrations/20261003001000_learning_v4_default_packages.sql', 'utf8');

describe('automatic learning package availability migrations', () => {
  it('keeps automatic eligibility tenant-scoped and assignment-free', () => {
    expect(availability).toContain('create table public.learning_package_default_rules');
    expect(availability).toContain('security definer');
    expect(availability).toContain('public.can_manage_institution_operations(p_institution_id)');
    expect(availability).toContain("'AUTOMATIC_DEFAULT'");
    expect(availability).toContain("'EXPLICIT_ASSIGNMENT'");
    expect(availability).not.toMatch(/insert\s+into\s+public\.learning_package_assignments/i);
  });

  it('keeps explicit assignments available while defaults are added', () => {
    expect(availability).toContain('assignment.student_id = p_student_id');
    expect(availability).toContain('assignment.class_id = context_class_id');
    expect(availability).toContain("case when assignment.id is null then 'AUTOMATIC_DEFAULT' else 'EXPLICIT_ASSIGNMENT' end");
  });

  it('promotes only versioned V4 lessons and never writes per-student access rows', () => {
    expect(defaults).toContain("catalog.code = 'TECESCOLA_CORE'");
    expect(defaults).toContain("'tec-escola-core-v4'");
    expect(defaults).toContain("'automatic_default'");
    expect(defaults).toContain('is not distinct from null');
    expect(defaults).not.toMatch(/insert\s+into\s+public\.learning_package_assignments/i);
  });
});
