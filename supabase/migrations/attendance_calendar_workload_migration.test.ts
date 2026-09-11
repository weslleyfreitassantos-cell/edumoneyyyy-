import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260911000100_attendance_calendar_workload.sql', import.meta.url),
  'utf8',
);

describe('attendance calendar workload migration', () => {
  it('mantém a validação de grade exata e adiciona o bloqueio do calendário', () => {
    expect(migration).toMatch(
      /create or replace function private\.validate_attendance_session_schedule/i,
    );
    expect(migration).toContain('timetable_entry.institution_id = new.institution_id');
    expect(migration).toContain('timetable_entry.subject_offering_id = new.subject_offering_id');
    expect(migration).toContain('new.session_date');
    expect(migration).toContain('timetable_entry.start_time = new.starts_at');
    expect(migration).toContain('timetable_entry.end_time = new.ends_at');
    expect(migration).toContain('from private.academic_day_blockers(');
    expect(migration).toContain("raise exception 'ATTENDANCE_CALENDAR_BLOCKED'");
    expect(migration).toContain("raise exception 'ATTENDANCE_SCHEDULE_NOT_FOUND'");
    expect(migration).toContain('old.starts_at is not distinct from new.starts_at');
    expect(migration).toContain('old.ends_at is not distinct from new.ends_at');
  });

  it('calcula carga pela grade e por sessões CLOSED sem multiplicar por alunos', () => {
    expect(migration).toContain('pg_catalog.generate_series');
    expect(migration).toContain('timetable_entry.active is true');
    expect(migration).toContain('timetable_occurrence.is_blocked is false');
    expect(migration).toContain('timetable_occurrence.is_blocked is true');
    expect(migration).toContain("session_record.status = 'CLOSED'");
    expect(migration).toContain('session_record.ends_at - session_record.starts_at');
    expect(migration).not.toContain('attendance_records');
    expect(migration).not.toContain('subjects.workload');
    expect(migration).toContain('session_record.session_date <= p_reference_date');
    expect(migration).toContain('term_record.start_date as term_start_date');
    expect(migration).toContain('term_record.end_date as term_end_date');
  });

  it('expõe RPC autenticada com autorização existente e search_path vazio', () => {
    expect(migration).toMatch(
      /create or replace function public\.get_subject_offering_workload_progress/i,
    );
    expect(migration).toContain('set search_path = \'\'');
    expect(migration).toContain('auth.uid() is null');
    expect(migration).toContain('public.can_access_institution(p_institution_id)');
    expect(migration).toContain('public.can_manage_institution_operations(p_institution_id)');
    expect(migration).toContain('private.is_teacher_for_offering(');
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('to authenticated');
  });
});
