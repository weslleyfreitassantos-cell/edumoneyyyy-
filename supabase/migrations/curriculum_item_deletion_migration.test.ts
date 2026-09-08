import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '20260904000100_curriculum_item_deletion.sql'),
  'utf8',
);

describe('curriculum item deletion migration', () => {
  it('creates a protected physical deletion trigger', () => {
    expect(migration).toContain('create or replace function private.validate_curriculum_item_deletion');
    expect(migration).toContain('before delete on public.class_curriculum_items');
    expect(migration).toContain('CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS');
    expect(migration).toContain('CURRICULUM_COMPONENT_HAS_ACTIVE_TIMETABLE_ENTRIES');
  });

  it('limits deletion to managers of the institution', () => {
    expect(migration).toContain('create policy class_curriculum_items_delete_policy');
    expect(migration).toContain('public.can_manage_institution_operations(institution_id)');
    expect(migration).toContain('grant delete on table public.class_curriculum_items');
  });
});
