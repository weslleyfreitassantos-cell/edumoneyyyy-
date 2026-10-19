import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261018000600_curriculum_template_class_links.sql'),
  'utf8',
);

describe('curriculum template class links migration', () => {
  it('persists scoped template-to-class associations', () => {
    expect(migration).toContain('create table if not exists public.curriculum_template_classes');
    expect(migration).toContain('constraint curriculum_template_classes_unique unique (template_id, class_id)');
    expect(migration).toContain('private.can_access_academic_institution(institution_id)');
    expect(migration).toContain('public.can_manage_institution_operations(institution_id)');
    expect(migration).toContain('insert into public.curriculum_template_classes');
    expect(migration).toContain('on conflict (template_id, class_id) do update');
  });

  it('backfills only exact active matrix matches', () => {
    expect(migration).toContain('the active class matrix still matches the saved template exactly');
    expect(migration).toContain('class_item.is_complementary = template_item.is_complementary');
    expect(migration).toContain('class_item.active is true');
  });
});
