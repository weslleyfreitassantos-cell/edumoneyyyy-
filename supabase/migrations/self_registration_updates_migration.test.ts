import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831000200_self_registration_updates.sql'),
  'utf8',
);

describe('self registration updates migration', () => {
  it('restringe leitura e escrita ao usuário autenticado', () => {
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain("grant execute on function public.get_current_self_registration() to authenticated");
    expect(migration).toContain("grant execute on function public.update_current_self_registration(jsonb) to authenticated");
    expect(migration).toContain('v_profile.role::text <> v_role');
  });

  it('não altera campos acadêmicos, vínculos ou documentos', () => {
    expect(migration).toContain('update public.students');
    expect(migration).not.toMatch(/update public\.enrollments/i);
    expect(migration).not.toMatch(/update public\.guardianships/i);
    expect(migration).not.toMatch(/update public\.student_documents/i);
    expect(migration).not.toMatch(/registration_number\s*=/i);
    expect(migration).not.toMatch(/class_id\s*=/i);
  });
});
