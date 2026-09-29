import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930000600_timetable_manual_editor_v2.sql', import.meta.url),
  'utf8',
);

describe('manual timetable editor v2 migration', () => {
  it('keeps all editing behind draft and institution checks', () => {
    expect(migration).toContain('private.assert_editable_timetable_draft');
    expect(migration).toContain('TIMETABLE_VERSION_NOT_DRAFT');
    expect(migration).toContain('public.can_manage_institution_operations(p_institution_id)');
    expect(migration).toContain('TIMETABLE_OFFERING_SCOPE_MISMATCH');
    expect(migration).toContain('TIMETABLE_ROOM_SCOPE_MISMATCH');
  });

  it('validates configured slots and breaks before accepting manual entries', () => {
    expect(migration).toContain('SCHOOL_TIME_SLOT_NOT_CONFIGURED');
    expect(migration).toContain('TIMETABLE_BREAK_CONFLICT');
    expect(migration).toContain('create or replace function public.add_timetable_draft_entry');
    expect(migration).toContain('create or replace function public.update_timetable_draft_entry');
  });

  it('provides conflict diagnostics instead of hiding invalid drafts', () => {
    expect(migration).toContain('create or replace function public.validate_timetable_draft');
    expect(migration).toContain('DRAFT_EMPTY');
    expect(migration).toContain('TEACHER_NOT_AVAILABLE');
    expect(migration).toContain('CLASS_CONFLICT');
    expect(migration).toContain('TEACHER_CONFLICT');
    expect(migration).toContain('ROOM_CONFLICT');
    expect(migration).toContain('WEEKLY_LESSONS_MISMATCH');
    expect(migration).toContain('VERSION_SCOPE_INCOMPLETE');
    expect(migration).toContain('generation_shift');
  });

  it('copies a day atomically without overwriting occupied target cells', () => {
    expect(migration).toContain('create or replace function public.copy_timetable_draft_day');
    expect(migration).toContain('TARGET_CELL_OCCUPIED');
    expect(migration).toContain('created_count');
    expect(migration).toContain('conflict_count');
  });

  it('provides an atomic consecutive double-slot action', () => {
    const runtimeMigration = readFileSync(
      new URL('./20260930000700_timetable_manual_editor_v2_runtime.sql', import.meta.url),
      'utf8',
    );
    expect(runtimeMigration).toContain('create or replace function public.add_timetable_draft_double_slot');
    expect(runtimeMigration).toContain('TIMETABLE_DOUBLE_SLOT_NOT_CONSECUTIVE');
    expect(runtimeMigration).toContain("return pg_catalog.jsonb_build_object('first_id', first_id, 'second_id', second_id)");
    expect(runtimeMigration).toContain('returning id into first_id');
    expect(runtimeMigration).toContain('returning id into second_id');
  });

  it('does not modify the published timetable read model', () => {
    expect(migration).not.toContain('update public.timetable_entries');
    expect(migration).not.toContain('insert into public.timetable_entries');
    expect(migration).toContain('notify pgrst');
  });
});
