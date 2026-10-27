import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    './20261019000400_bncc_aurora_portuguese_subject_binding.sql',
    import.meta.url,
  ),
  'utf8',
).replace(/\r\n/g, '\n');

describe('Aurora Portuguese BNCC subject binding', () => {
  it('targets only the unique active Aurora institution and its exact PORT subject', () => {
    expect(migration).toContain("institution.public_slug = 'aurora-integral'");
    expect(migration).toContain('institution.active');
    expect(migration).toContain("upper(btrim(subject.code)) = 'PORT'");
    expect(migration).toContain("upper(btrim(subject.name)) = 'LÍNGUA PORTUGUESA'");
    expect(migration).toContain('subject.institution_id = target_institution_id');
    expect(migration).toContain('subject_count <> 1');
  });

  it('upserts only the private Portuguese binding and leaves school content unchanged', () => {
    expect(migration).toContain("canonical.code = 'PORTUGUESE'");
    expect(migration).toContain('private.learning_demo_subject_bindings');
    expect(migration).toContain('on conflict (institution_id, subject_id) do update');
    expect(migration).not.toMatch(/\b(update|delete)\s+public\.(subjects|learning_bncc_discipline_journeys)/i);
    expect(migration).not.toMatch(/\b(drop\s+table|truncate\s+)/i);
    expect(migration).not.toMatch(/\b(insert|update)\s+public\.learning_bncc_discipline_journeys/i);
  });
});
