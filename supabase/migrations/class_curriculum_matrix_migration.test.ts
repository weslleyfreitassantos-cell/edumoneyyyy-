import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260724000100_class_curriculum_matrix.sql', import.meta.url),
  'utf8',
);

describe('class curriculum matrix migration', () => {
  it('cria a tabela class_curriculum_items com todos os campos', () => {
    expect(migration).toContain('create table public.class_curriculum_items');
    expect(migration).toContain('id uuid primary key');
    expect(migration).toContain('institution_id uuid not null');
    expect(migration).toContain('class_id uuid not null');
    expect(migration).toContain('subject_id uuid not null');
    expect(migration).toContain('weekly_lessons smallint not null');
    expect(migration).toContain('lesson_duration_minutes smallint not null');
    expect(migration).toContain('needs_review boolean not null default false');
    expect(migration).toContain('active boolean not null default true');
    expect(migration).toContain('created_at timestamptz not null default now()');
    expect(migration).toContain('updated_at timestamptz not null default now()');
  });

  it('define FKs com on delete restrict', () => {
    expect(migration).toContain('references public.institutions(id)');
    expect(migration).toContain('references public.classes(id)');
    expect(migration).toContain('references public.subjects(id)');
    expect(migration).toContain('on delete restrict');
  });

  it('define unique(class_id, subject_id)', () => {
    expect(migration).toContain('constraint class_curriculum_items_class_subject_unique');
    expect(migration).toContain('unique (class_id, subject_id)');
  });

  it('impõe limites de weekly_lessons (1 a 20)', () => {
    expect(migration).toContain('weekly_lessons between 1 and 20');
  });

  it('impõe limites de lesson_duration_minutes (15 a 180)', () => {
    expect(migration).toContain('lesson_duration_minutes between 15 and 180');
  });

  it('habilita RLS', () => {
    expect(migration).toMatch(/enable row level security/i);
  });

  it('cria policies de select e write usando helpers institucionais', () => {
    expect(migration).toContain('class_curriculum_items_select_policy');
    expect(migration).toContain('class_curriculum_items_write_policy');
    expect(migration).toContain('class_curriculum_items_update_policy');
    expect(migration).toContain('public.can_access_institution(institution_id)');
    expect(migration).toContain('public.can_manage_institution_operations(institution_id)');
  });

  it('não possui policy de delete', () => {
    expect(migration).not.toContain('class_curriculum_items_delete_policy');
  });

  it('faz backfill de subject_offerings', () => {
    expect(migration).toContain('from public.subject_offerings as offerings');
    expect(migration).toContain('weekly_lessons');
    expect(migration).toContain('lesson_duration_minutes');
    expect(migration).toContain('on conflict (class_id, subject_id)');
    expect(migration).toContain('do nothing');
  });

  it('define needs_review = true no backfill', () => {
    expect(migration).toContain('needs_review');
    expect(migration).toContain('true');
  });

  it('cria proteção CURRICULUM_COMPONENT_REQUIRED', () => {
    expect(migration).toContain('CURRICULUM_COMPONENT_REQUIRED');
    expect(migration).toContain('subject_offerings_require_curriculum_item');
    expect(migration).toContain('validate_offering_requires_curriculum_item');
  });

  it('cria proteção CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS', () => {
    expect(migration).toContain('CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS');
    expect(migration).toContain('class_curriculum_items_check_deactivation');
    expect(migration).toContain('validate_curriculum_item_deactivation');
  });

  it('usa set search_path = nas funções', () => {
    const matches = migration.match(/set search_path = ''/g);
    expect(matches?.length).toBeGreaterThanOrEqual(4);
  });
});
