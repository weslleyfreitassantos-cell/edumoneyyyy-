import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260906160000_school_onboarding_integrity.sql'),
  'utf8',
);

describe('school onboarding integrity migration', () => {
  it('permite SECRETARY administrar a instituição sem ampliar escopo de tenant', () => {
    expect(migration).toContain("'SECRETARY'::public.user_role");
    expect(migration).toContain('public.is_institution_operational(target_institution_id)');
    expect(migration).toContain('set search_path = \'\'');
  });

  it('protege matrícula ativa por aluno e ano, preservando histórico', () => {
    expect(migration).toContain('enrollments_active_student_year_unique');
    expect(migration).toContain("lower(btrim(status)) = 'active'");
    expect(migration).toContain('where active is true');
  });

  it('normaliza e restringe turnos sem apagar registros', () => {
    expect(migration).toContain("set shift = case");
    expect(migration).toContain("and shift not in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO')");
    expect(migration).not.toContain("and upper(btrim(shift)) not in");
    expect(migration).toContain('classes_supported_shift');
    expect(migration).toContain('school_time_slots_supported_shift');
    expect(migration).toContain('school_schedule_breaks_supported_shift');
    expect(migration).not.toMatch(/delete\s+from\s+public\.(classes|school_time_slots|school_schedule_breaks)/i);
  });
});
