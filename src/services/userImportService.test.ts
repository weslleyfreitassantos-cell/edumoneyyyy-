import { describe, expect, it, vi } from 'vitest';

import type { AcademicYearRow } from './academicStructureService';
import type { ClassRow } from './classService';
import type { SubjectRow } from './subjectService';
import {
  buildStudentImportPreviews,
  buildTeacherImportPreviews,
  importStudents,
  type ImportPreview,
  type StudentImportPreviewData,
} from './userImportService';

import { createFullStudentEnrollment } from './fullStudentEnrollmentService';

vi.mock('./fullStudentEnrollmentService', () => ({
  createFullStudentEnrollment: vi.fn(),
}));

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
      headers: ['full_name', 'email', 'birth_date', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship', 'academic_year', 'ano_escolar', 'class'],
      rows: [{
        rowNumber: 2,
        values: {
          full_name: 'Ana Souza', email: 'ana@example.com', birth_date: '31/08/2016',
          guardian_1_full_name: 'Carlos Souza', guardian_1_email: 'carlos@example.com', guardian_1_relationship: 'Pai',
          academic_year: '2027', ano_escolar: '7º ano', class: '7º A',
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

  it('accepts Excel date text with a time suffix', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Importação',
      headers: [
        'Nome completo', 'E-mail', 'Data de nascimento',
        'Responsável 1 - Nome completo', 'Responsável 1 - E-mail',
        'Responsável 1 - Parentesco', 'Ano letivo', 'Ano escolar / série',
      ],
      rows: [{
        rowNumber: 2,
        values: {
          nome_completo: 'Aluno Excel',
          e_mail: 'excel@example.com',
          data_de_nascimento: '2010-01-01 00:00:00',
          responsavel_1_nome_completo: 'Responsável Excel',
          responsavel_1_e_mail: 'responsavel-excel@example.com',
          responsavel_1_parentesco: 'Pai',
          ano_letivo: '2027',
          ano_escolar_serie: '7º ano',
        },
      }],
    }, { years: [year], classes: [schoolClass] });

    expect(result.previews[0]?.errors).toEqual([]);
    expect(result.previews[0]?.data.identity.birth_date).toBe('2010-01-01');
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

  it('distributes a minimal student file across active classes within the provided grade', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Alunos',
      headers: ['full_name', 'email', 'birth_date', 'ano_escolar', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship'],
      rows: [1, 2].map((index) => ({
        rowNumber: index + 1,
        values: {
          full_name: `Aluno mínimo ${index}`,
          email: `aluno-minimo-${index}@example.com`,
          birth_date: '31/08/2016',
          ano_escolar: '7º ano',
          guardian_1_full_name: 'Carlos Souza',
          guardian_1_email: 'carlos@example.com',
          guardian_1_relationship: 'Pai',
        },
      })),
    }, {
      years: [year],
      classes: [schoolClass, { ...schoolClassB, active_enrollments_count: 0 }],
      defaultAcademicYearId: year.id,
    });

    expect(result.previews.every((preview) => preview.errors.length === 0)).toBe(true);
    expect(result.previews.map((preview) => preview.data.class_id)).toEqual([
      schoolClass.id,
      schoolClassB.id,
    ]);
  });

  it('requires the student grade even when classes are available', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Alunos',
      headers: ['full_name', 'email', 'birth_date', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship'],
      rows: [{
        rowNumber: 2,
        values: {
          full_name: 'Aluno sem série',
          email: 'aluno-sem-serie@example.com',
          birth_date: '31/08/2016',
          guardian_1_full_name: 'Carlos Souza',
          guardian_1_email: 'carlos@example.com',
          guardian_1_relationship: 'Pai',
        },
      }],
    }, {
      years: [year],
      classes: [schoolClass],
      defaultAcademicYearId: year.id,
    });

    expect(result.previews[0]?.errors).toContain('Ano escolar / série é obrigatório.');
  });

  it('rejects a grade outside the standardized education levels', () => {
    const result = buildStudentImportPreviews({
      sheetName: 'Alunos',
      headers: ['full_name', 'email', 'birth_date', 'ano_escolar', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship'],
      rows: [{
        rowNumber: 2,
        values: {
          full_name: 'Aluno nível inválido',
          email: 'aluno-nivel-invalido@example.com',
          birth_date: '31/08/2016',
          ano_escolar: '10º ano',
          guardian_1_full_name: 'Carlos Souza',
          guardian_1_email: 'carlos@example.com',
          guardian_1_relationship: 'Pai',
        },
      }],
    }, {
      years: [year],
      classes: [schoolClass],
      defaultAcademicYearId: year.id,
    });

    expect(result.previews[0]?.errors).toContain(
      'Ano escolar / série inválido. Use 1 a 9 ou 1 EM, 2 EM e 3 EM.',
    );
  });

  it('keeps numeric grades in fundamental education separate from high school', () => {
    const fundamentalClass = {
      ...schoolClass,
      id: 'class-1-fundamental',
      name: '1º ano A',
      grade_level: '1',
    } as ClassRow;
    const highSchoolClass = {
      ...schoolClass,
      id: 'class-1-high-school',
      name: '1ª série EM A',
      grade_level: '1º EM',
    } as ClassRow;

    const result = buildStudentImportPreviews({
      sheetName: 'Alunos',
      headers: ['full_name', 'email', 'birth_date', 'ano_escolar', 'guardian_1_full_name', 'guardian_1_email', 'guardian_1_relationship'],
      rows: [
        {
          rowNumber: 2,
          values: {
            full_name: 'Aluno Fundamental', email: 'fundamental@example.com', birth_date: '31/08/2016', ano_escolar: '1',
            guardian_1_full_name: 'Carlos Souza', guardian_1_email: 'carlos@example.com', guardian_1_relationship: 'Pai',
          },
        },
        {
          rowNumber: 3,
          values: {
            full_name: 'Aluno Ensino Médio', email: 'medio@example.com', birth_date: '31/08/2008', ano_escolar: '1 EM',
            guardian_1_full_name: 'Maria Souza', guardian_1_email: 'maria@example.com', guardian_1_relationship: 'Mãe',
          },
        },
      ],
    }, {
      years: [year],
      classes: [fundamentalClass, highSchoolClass],
      defaultAcademicYearId: year.id,
    });

    expect(result.previews.map((preview) => preview.data.class_id)).toEqual([
      fundamentalClass.id,
      highSchoolClass.id,
    ]);
    expect(result.previews.every((preview) => preview.errors.length === 0)).toBe(true);
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

  it('accepts a minimal teacher file without optional academic data', () => {
    const result = buildTeacherImportPreviews({
      sheetName: 'Professores',
      headers: ['full_name', 'email'],
      rows: [{
        rowNumber: 2,
        values: {
          full_name: 'João Silva',
          email: 'joao@example.com',
        },
      }],
    }, subjects);

    expect(result.previews[0]?.errors).toEqual([]);
    expect(result.previews[0]?.data.subject_ids).toEqual([]);
    expect(result.previews[0]?.warnings).toContain(
      'Professor sem disciplinas; faça as atribuições depois do cadastro.',
    );
  });

  it('imports students with bounded concurrency and preserves result order', async () => {
    let active = 0;
    let maximumActive = 0;
    vi.mocked(createFullStudentEnrollment).mockImplementation(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { student_id: 'student-1', enrollment_id: 'enrollment-1', guardian_profile_ids: [], documents_pending: 0, email_pending: false };
    });

    const previews = Array.from({ length: 7 }, (_, index) => ({
      rowNumber: index + 2,
      label: `Aluno ${index + 1}`,
      data: {} as StudentImportPreviewData,
      errors: [],
      warnings: [],
    })) satisfies Array<ImportPreview<StudentImportPreviewData>>;
    const progress: number[] = [];

    const result = await importStudents('institution-1', previews, (item) => progress.push(item.current));

    expect(maximumActive).toBe(3);
    expect(result.failed).toEqual([]);
    expect(result.emailPending).toEqual([]);
    expect(result.succeeded.map((item) => item.rowNumber)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
