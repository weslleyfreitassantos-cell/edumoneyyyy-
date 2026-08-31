import { describe, expect, it } from 'vitest';

import type { AcademicYearRow } from './academicStructureService';
import type { ClassRow } from './classService';
import type { SubjectRow } from './subjectService';
import {
  buildStudentImportPreviews,
  buildTeacherImportPreviews,
} from './userImportService';

const year = { id: 'year-2027', institution_id: 'institution-1', name: '2027', start_date: '2027-02-01', end_date: '2027-12-17', active: true, terms: [] } as AcademicYearRow;
const schoolClass = { id: 'class-7a', institution_id: 'institution-1', academic_year_id: 'year-2027', academic_year_name: '2027', name: '7º A', grade_level: '7º', shift: 'INTEGRAL', capacity: 35, active: true, active_enrollments_count: 0, active_offerings_count: 0, active_curriculum_items_count: 0 } as ClassRow;
const subjects = [
  { id: 'subject-mat', institution_id: 'institution-1', name: 'Matemática', code: 'MAT', workload: 5, active: true, active_offerings_count: 0 },
  { id: 'subject-fis', institution_id: 'institution-1', name: 'Física', code: 'FIS', workload: 2, active: true, active_offerings_count: 0 },
] as SubjectRow[];

describe('userImportService', () => {
  it('builds the complete student draft and resolves academic links', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Alunos',
      headers: ['full_name', 'email', 'birth_date', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship', 'academic_year', 'class'],
      rows: [{
        rowNumber: 2,
        values: {
          full_name: 'Ana Souza', email: 'ana@example.com', birth_date: '31/08/2016',
          guardian_1_full_name: 'Carlos Souza', guardian_1_email: 'carlos@example.com', guardian_1_relationship: 'Pai',
          academic_year: '2027', class: '7º A',
        },
      }],
    }, { years: [year], classes: [schoolClass] });

    const preview = result.previews[0];
    expect(preview?.errors).toEqual([]);
    expect(preview?.data.identity.birth_date).toBe('2016-08-31');
    expect(preview?.data.academic_year_id).toBe('year-2027');
    expect(preview?.data.class_id).toBe('class-7a');
    expect(preview?.data.documents).toHaveLength(10);
  });

  it('requires a responsible and rejects unavailable teacher subjects or times', () => {
    const student = buildStudentImportPreviews({
      sheetName: 'Alunos', headers: ['full_name', 'email', 'birth_date'],
      rows: [{ rowNumber: 2, values: { full_name: 'Sem responsável', email: 'student@example.com', birth_date: '2016-08-31' } }],
    }, { years: [year], classes: [schoolClass] });
    expect(student.previews[0]?.errors.some((error) => error.includes('responsável'))).toBe(true);

    const teacher = buildTeacherImportPreviews({
      sheetName: 'Professores', headers: ['full_name', 'email', 'subjects', 'availability_1_day', 'availability_1_start', 'availability_1_end'],
      rows: [{ rowNumber: 2, values: { full_name: 'João Silva', email: 'joao@example.com', subjects: 'Química', availability_1_day: 'Segunda', availability_1_start: '12:00', availability_1_end: '08:00' } }],
    }, subjects);
    expect(teacher.previews[0]?.errors).toEqual(expect.arrayContaining([
      'Disciplina não encontrada: Química.',
      'Disponibilidade 1: o fim deve ser posterior ao início.',
    ]));
  });

  it('resolves teacher disciplines by code and Portuguese day names', () => {
    const result = buildTeacherImportPreviews({
      sheetName: 'Professores', headers: ['full_name', 'email', 'subjects', 'primary_subject', 'availability_1_day', 'availability_1_start', 'availability_1_end'],
      rows: [{ rowNumber: 2, values: { full_name: 'João Silva', email: 'joao@example.com', subjects: 'MAT;FIS', primary_subject: 'MAT', availability_1_day: 'Segunda', availability_1_start: '07:00', availability_1_end: '12:00' } }],
    }, subjects);
    expect(result.previews[0]?.errors).toEqual([]);
    expect(result.previews[0]?.data.subject_ids).toEqual(['subject-mat', 'subject-fis']);
    expect(result.previews[0]?.data.availability[0]).toEqual({ day_of_week: 1, start_time: '07:00', end_time: '12:00' });
  });
});
