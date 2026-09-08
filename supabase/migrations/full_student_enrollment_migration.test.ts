import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260814000100_full_student_enrollment.sql', import.meta.url),
  'utf8',
);

const updateMigration = readFileSync(
  new URL('./20260830000200_update_full_student_enrollment.sql', import.meta.url),
  'utf8',
);

describe('full student enrollment migration', () => {
  it('cria os registros complementares da matricula', () => {
    expect(migration).toContain('create table if not exists public.student_registration_details');
    expect(migration).toContain('create table if not exists public.student_addresses');
    expect(migration).toContain('create table if not exists public.student_previous_schooling');
    expect(migration).toContain('create table if not exists public.student_health_information');
    expect(migration).toContain('create table if not exists public.student_documents');
  });

  it('protege os dados sensiveis com RLS e papeis institucionais', () => {
    expect(migration).toMatch(/enable row level security/gi);
    expect(migration).toContain("'ADMIN', 'DIRECTOR', 'SECRETARY'");
    expect(migration).toContain('private.has_institution_role');
  });

  it('expoe uma operacao atomica para concluir o pacote', () => {
    expect(migration).toContain('create or replace function public.create_full_student_enrollment_bundle');
    expect(migration).toContain('security definer');
    expect(migration).toContain('insert into public.enrollments');
    expect(migration).toContain('insert into public.guardianships');
    expect(migration).toContain('grant execute on function public.create_full_student_enrollment_bundle(jsonb) to authenticated');
  });

  it('nao remove tabelas existentes nem executa deploy remoto', () => {
    expect(migration.toLowerCase()).not.toContain('drop table');
    expect(migration.toLowerCase()).not.toContain('db push');
    expect(migration.toLowerCase()).not.toContain('functions deploy');
  });

  it('disponibiliza uma atualizacao completa sem recriar a matricula', () => {
    expect(updateMigration).toContain('create or replace function public.update_full_student_enrollment_bundle');
    expect(updateMigration).toContain('update public.students');
    expect(updateMigration).toContain('update public.enrollments');
    expect(updateMigration).toContain('grant execute on function public.update_full_student_enrollment_bundle(jsonb) to authenticated');
    expect(updateMigration).not.toContain('insert into public.enrollments');
    expect(updateMigration).not.toContain('Associe pelo menos um responsavel ao aluno.');
  });
});
