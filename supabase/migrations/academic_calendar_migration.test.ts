import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260908000200_academic_calendar.sql'),
  'utf8',
);

describe('academic calendar migration', () => {
  it('cria o domínio de eventos, constraints e índices da instituição', () => {
    expect(migration).toContain('create table public.academic_calendar_events');
    expect(migration).toContain('create type public.academic_calendar_event_type');
    expect(migration).toContain('create type public.academic_calendar_audience');
    expect(migration).toContain('academic_calendar_events_class_audience_check');
    expect(migration).toContain('academic_calendar_events_institution_active_idx');
    expect(migration).toContain('academic_calendar_events_validate_references');
  });

  it('isola operações administrativas e leituras por público com RLS', () => {
    expect(migration).toContain('alter table public.academic_calendar_events enable row level security');
    expect(migration).toContain('academic_calendar_events_staff_insert');
    expect(migration).toContain('academic_calendar_events_staff_update');
    expect(migration).toContain('academic_calendar_events_student_select');
    expect(migration).toContain('academic_calendar_events_guardian_select');
    expect(migration).toContain('academic_calendar_events_teacher_select');
    expect(migration).toContain('private.has_institution_role');
  });
});
