import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '20260904000200_curriculum_template_deletion.sql'),
  'utf8',
);
const foundation = readFileSync(
  resolve(__dirname, '20260817000100_academic_automation_foundation.sql'),
  'utf8',
);

describe('curriculum template deletion migration', () => {
  it('allows only institution managers to physically delete templates', () => {
    expect(migration).toContain('grant delete on table public.curriculum_templates');
    expect(migration).toContain('create policy curriculum_templates_delete_policy');
    expect(migration).toContain('for delete');
    expect(migration).toContain('public.can_manage_institution_operations(institution_id)');
  });

  it('keeps template items covered by the existing cascade', () => {
    expect(foundation).toContain(
      'references public.curriculum_templates(id) on delete cascade',
    );
  });
});
