import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260727000200_class_timetable.sql', import.meta.url),
  'utf8',
);

describe('class timetable migration', () => {
  it('cria a tabela rooms com todos os campos', () => {
    expect(migration).toContain('create table public.rooms');
    expect(migration).toContain('id uuid primary key');
    expect(migration).toContain('institution_id uuid not null');
    expect(migration).toContain('name text not null');
    expect(migration).toContain('code text');
    expect(migration).toContain('capacity smallint');
    expect(migration).toContain('active boolean not null default true');
    expect(migration).toContain('created_at timestamptz not null default now()');
    expect(migration).toContain('updated_at timestamptz not null default now()');
  });

  it('cria a tabela timetable_entries com todos os campos', () => {
    expect(migration).toContain('create table public.timetable_entries');
    expect(migration).toContain('subject_offering_id uuid not null');
    expect(migration).toContain('room_id uuid');
    expect(migration).toContain('day_of_week smallint not null');
    expect(migration).toContain('start_time time without time zone not null');
    expect(migration).toContain('end_time time without time zone not null');
  });

  it('define FKs com on delete restrict', () => {
    expect(migration).toContain('references public.institutions(id)');
    expect(migration).toContain('references public.subject_offerings(id)');
    expect(migration).toContain('references public.rooms(id)');
    expect(migration).toContain('on delete restrict');
  });

  it('impõe day_of_week entre 1 e 6', () => {
    expect(migration).toContain('day_of_week between 1 and 6');
  });

  it('impõe start_time < end_time', () => {
    expect(migration).toContain('check (start_time < end_time)');
  });

  it('impõe limite de capacidade (1 a 500)', () => {
    expect(migration).toContain('capacity between 1 and 500');
  });

  it('habilita RLS em ambas as tabelas', () => {
    const matches = migration.match(/enable row level security/gi);
    expect(matches?.length).toBe(2);
  });

  it('cria policies de select e write usando helpers institucionais', () => {
    expect(migration).toContain('rooms_select_policy');
    expect(migration).toContain('rooms_write_policy');
    expect(migration).toContain('rooms_update_policy');
    expect(migration).toContain('timetable_entries_select_policy');
    expect(migration).toContain('timetable_entries_write_policy');
    expect(migration).toContain('timetable_entries_update_policy');
    expect(migration).toContain('public.can_access_institution(institution_id)');
    expect(migration).toContain('public.can_manage_institution_operations(institution_id)');
  });

  it('não possui policies de delete', () => {
    expect(migration).not.toContain('rooms_delete_policy');
    expect(migration).not.toContain('timetable_entries_delete_policy');
  });

  it('cria conflito de sala (ROOM_ALREADY_BOOKED)', () => {
    expect(migration).toContain('ROOM_ALREADY_BOOKED');
    expect(migration).toContain('timetable_entries_check_room_conflict');
    expect(migration).toContain('check_timetable_entry_room_conflict');
  });

  it('cria conflito de professor (TEACHER_ALREADY_BOOKED)', () => {
    expect(migration).toContain('TEACHER_ALREADY_BOOKED');
    expect(migration).toContain('timetable_entries_check_teacher_conflict');
    expect(migration).toContain('check_timetable_entry_teacher_conflict');
  });

  it('cria conflito de turma (CLASS_ALREADY_BOOKED)', () => {
    expect(migration).toContain('CLASS_ALREADY_BOOKED');
    expect(migration).toContain('timetable_entries_check_class_conflict');
    expect(migration).toContain('check_timetable_entry_class_conflict');
  });

  it('usa set search_path = nas funções', () => {
    const matches = migration.match(/set search_path = ''/g);
    expect(matches?.length).toBeGreaterThanOrEqual(6);
  });
});
