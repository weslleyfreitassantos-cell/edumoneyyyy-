import { describe, expect, it } from 'vitest';

import {
  getActiveClassesForYear,
  getPreferredAcademicYear,
  getSuggestedClassId,
} from './academicSelection';

const year = (id: string, active = true, startDate = '2026-01-01') => ({
  id,
  institution_id: 'institution-1',
  name: id,
  start_date: startDate,
  end_date: `${startDate.slice(0, 4)}-12-31`,
  active,
  terms: [],
});

const classRecord = (
  id: string,
  academicYearId: string,
  capacity = 30,
  activeEnrollmentsCount = 0,
) => ({
  id,
  institution_id: 'institution-1',
  academic_year_id: academicYearId,
  academic_year_name: academicYearId,
  name: id,
  grade_level: '1º ano',
  shift: 'Integral',
  capacity,
  active: true,
  active_enrollments_count: activeEnrollmentsCount,
  active_offerings_count: 0,
  active_curriculum_items_count: 0,
});

describe('academic selection helpers', () => {
  it('prefere o ano ativo que contém a data atual', () => {
    const years = [
      year('2027', true, '2027-01-01'),
      year('2026', true),
    ];

    expect(getPreferredAcademicYear(years, new Date('2026-08-31'))?.id).toBe(
      '2026',
    );
  });

  it('filtra turmas pelo ano e ordena as opções', () => {
    const classes = [
      classRecord('Turma B', '2026'),
      classRecord('Turma A', '2026'),
      classRecord('Turma de outro ano', '2027'),
    ];

    expect(
      getActiveClassesForYear(classes, '2026').map((item) => item.name),
    ).toEqual(['Turma A', 'Turma B']);
  });

  it('só sugere uma turma quando a escolha é única', () => {
    expect(getSuggestedClassId([classRecord('Turma A', '2026')])).toBe(
      'Turma A',
    );
    expect(
      getSuggestedClassId([
        classRecord('Turma A', '2026'),
        classRecord('Turma B', '2026'),
      ]),
    ).toBe('');
    expect(
      getSuggestedClassId([classRecord('Turma lotada', '2026', 30, 30)]),
    ).toBe('');
  });
});
