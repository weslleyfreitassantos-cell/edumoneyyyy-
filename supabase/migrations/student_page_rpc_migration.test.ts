import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./20260914000100_student_page_rpc.sql', import.meta.url),
  'utf8',
);

describe('student page RPC migration', () => {
  it('define uma RPC paginada, invoker e tenant-scoped', () => {
    expect(source).toContain('create or replace function public.list_students_page');
    expect(source).toContain('p_institution_id uuid');
    expect(source).toContain('p_search text');
    expect(source).toContain('p_limit integer');
    expect(source).toContain('p_offset integer');
    expect(source).toContain('security invoker');
    expect(source).toContain('set search_path = \'\'');
    expect(source).toContain('from public.students as student');
    expect(source).toContain('join public.profiles as profile');
    expect(source).toContain('where student.institution_id = p_institution_id');
    expect(source).toContain('count(*) over () as total_count');
    expect(source).toContain('limit greatest(least(coalesce(p_limit, 25), 100), 1)');
    expect(source).toContain('offset greatest(coalesce(p_offset, 0), 0)');
  });

  it('não expõe dados sensíveis e concede execução somente a authenticated', () => {
    expect(source).not.toContain('birth_date');
    expect(source).not.toContain('cpf');
    expect(source).not.toContain('avatar_url');
    expect(source).toContain('revoke all on function public.list_students_page');
    expect(source).toContain('from public, anon');
    expect(source).toContain('to authenticated');
  });
});
