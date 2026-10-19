import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '20261018000200_class_identity_by_shift.sql'),
  'utf8',
);

describe('class identity by shift migration', () => {
  it('allows the same class name in different shifts while preventing duplicates in one shift', () => {
    expect(migration).toContain('set name = c.name || \' A\'');
    expect(migration).toContain("then 'M'");
    expect(migration).toContain("then 'V'");
    expect(migration).toContain("then 'N'");
    expect(migration).toContain('not exists');
    expect(migration).toContain('institution_id');
    expect(migration).toContain('academic_year_id');
    expect(migration).toContain("coalesce(shift, '')");
    expect(migration).toContain('lower(trim(name))');
    expect(migration).toContain('classes_institution_year_shift_name_unique_idx');
  });
});
