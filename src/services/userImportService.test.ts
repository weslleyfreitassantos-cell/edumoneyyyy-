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
const schoolClassAWithStudents = { ...schoolClass, active_enrollments_count: 8 } as ClassRow;
const schoolClassB = { ...schoolClass, id: 'class-7b', name: '7º B', active_enrollments_count: 2 } as ClassRow;
const schoolClassC = { ...schoolClass, id: 'class-7c', name: '7º C', active_enrollments_count: 2 } as ClassRow;
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

  it('reads the official spreadsheet names for birth and enrollment dates', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Importação',
      headers: [
        'Nome completo', 'E-mail', 'Data de nascimento',
        'Responsável 1 - Nome completo', 'Responsável 1 - E-mail',
        'Responsável 1 - Parentesco', 'Ano letivo', 'Ano escolar / série',
        'Data da matrícula',
      ],
      rows: [{
        rowNumber: 2,
        values: {
          nome_completo: 'Aluno Oficial',
          e_mail: 'oficial@example.com',
          data_de_nascimento: '01/01/2010',
          responsavel_1_nome_completo: 'Responsável Oficial',
          responsavel_1_e_mail: 'responsavel@example.com',
          responsavel_1_parentesco: 'Pai',
          ano_letivo: '2027',
          ano_escolar_serie: '7º ano',
          data_da_matricula: '01/02/2027',
        },
      }],
    }, { years: [year], classes: [schoolClass] });

    expect(result.previews[0]?.errors).toEqual([]);
    expect(result.previews[0]?.data.identity.birth_date).toBe('2010-01-01');
    expect(result.previews[0]?.data.enrolled_at).toBe('2027-02-01');
  });

  it('uses the default year and distributes students across matching classes', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Alunos',
      headers: ['full_name', 'email', 'birth_date', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship', 'ano_escolar'],
      rows: [1, 2, 3].map((index) => ({
        rowNumber: index + 1,
        values: {
          full_name: `Aluno ${index}`,
          email: `aluno${index}@example.com`,
          birth_date: '31/08/2016',
          guardian_1_full_name: 'Carlos Souza',
          guardian_1_email: 'carlos@example.com',
          guardian_1_relationship: 'Pai',
          ano_escolar: '7º ano',
        },
      })),
    }, {
      years: [year],
      classes: [schoolClassAWithStudents, schoolClassB, schoolClassC],
      defaultAcademicYearId: year.id,
    });

    expect(result.previews.every((preview) => preview.errors.length === 0)).toBe(true);
    expect(result.previews.map((preview) => preview.data.academic_year_id)).toEqual([
      year.id,
      year.id,
      year.id,
    ]);
    expect(result.previews.map((preview) => preview.data.class_id)).toEqual([
      schoolClassB.id,
      schoolClassC.id,
      schoolClassB.id,
    ]);
    expect(result.previews[0]?.warnings).toContain('Turma atribuída automaticamente: 7º B.');
  });

  it('asks for the school grade when multiple classes cannot be distinguished', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Alunos',
      headers: ['full_name', 'email', 'birth_date', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship'],
      rows: [{
        rowNumber: 2,
        values: {
          full_name: 'Aluno sem série',
          email: 'aluno@example.com',
          birth_date: '31/08/2016',
          guardian_1_full_name: 'Carlos Souza',
          guardian_1_email: 'carlos@example.com',
          guardian_1_relationship: 'Pai',
        },
      }],
    }, {
      years: [year],
      classes: [schoolClass, schoolClassB],
      defaultAcademicYearId: year.id,
    });

    expect(result.previews[0]?.errors).toContain(
      'Informe o ano escolar/série para distribuir o aluno entre as turmas.',
    );
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
