import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260916000100_student_registration_number.sql', import.meta.url),
  'utf8',
);

describe('student registration number migration', () => {
  it('recreates the concurrency-safe annual RA generator', () => {
    expect(migration).toContain('create or replace function public.generate_student_registration_number');
    expect(migration).toContain('student_registration_counters');
    expect(migration).toContain('on conflict');
    expect(migration).toContain('last_value + 1');
    expect(migration).toContain('lpad(next_value::text, 4, \'0\')');
    expect(migration).toContain('9999');
  });

  it('keeps automatic RA generation on direct student inserts', () => {
    expect(migration).toContain('create or replace function public.set_student_registration_number');
    expect(migration).toContain('drop trigger if exists students_generate_registration_number');
    expect(migration).toContain('create trigger students_generate_registration_number');
    expect(migration).toContain('execute function public.set_student_registration_number()');
  });

  it('exposes the functions only to the service role', () => {
    expect(migration).toContain('revoke all on function public.generate_student_registration_number(uuid) from public');
    expect(migration).toContain('revoke all on function public.set_student_registration_number() from public');
    expect(migration).toContain('grant execute on function public.generate_student_registration_number(uuid) to service_role');
    expect(migration).toContain('grant execute on function public.set_student_registration_number() to service_role');
  });
});
