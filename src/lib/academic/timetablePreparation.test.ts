import { describe, expect, it } from 'vitest';

import { buildTimetablePreparationReport } from './timetablePreparation';

const baseInput = {
  institutionId: 'institution-1',
  academicYearId: 'year-1',
  terms: [{ id: 'term-1', active: true }],
  classes: [{ id: 'class-1', name: '1A', shift: 'MATUTINO', capacity: 30, active: true, academic_year_id: 'year-1' }],
  enrollments: [],
  curriculumItems: [{ class_id: 'class-1', subject_id: 'subject-1', weekly_lessons: 5, active: true }],
  subjectNames: { 'subject-1': 'Matemática' },
  offerings: [{ class_id: 'class-1', subject_id: 'subject-1', teacher_profile_id: 'teacher-1', term_id: 'term-1', active: true }],
  teacherSubjects: [{ teacher_profile_id: 'teacher-1', subject_id: 'subject-1', active: true }],
  teacherAvailability: [{ teacher_profile_id: 'teacher-1', day_of_week: 1, start_time: '07:00', end_time: '12:00', active: true }],
  slots: [{ shift: 'MATUTINO', day_of_week: 1, start_time: '07:00', end_time: '07:50', active: true }],
  breaks: [],
  rooms: [{ id: 'room-1', class_id: 'class-1', capacity: 30, active: true }],
};

describe('buildTimetablePreparationReport', () => {
  it('consolida a demanda operacional antes da geração', () => {
    const report = buildTimetablePreparationReport(baseInput);

    expect(report.ready).toBe(true);
    expect(report.totals).toMatchObject({ classes: 1, students: 0, weeklyLessons: 5, rooms: 1, slots: 1 });
    expect(report.classes[0]).toMatchObject({ name: '1A', weeklyLessons: 5, compatibleSlots: 1, assignedRooms: 1 });
    expect(report.warnings.some((item) => item.code === 'SCHOOL_SLOT_CAPACITY')).toBe(true);
  });

  it('bloqueia turma acima da capacidade de alunos ou sala', () => {
    const report = buildTimetablePreparationReport({
      ...baseInput,
      enrollments: Array.from({ length: 31 }, (_, index) => ({
        class_id: 'class-1',
        academic_year_id: 'year-1',
        active: true,
        status: 'ACTIVE',
        student_id: `student-${index}`,
      })),
      rooms: [{ id: 'room-1', class_id: 'class-1', capacity: 20, active: true }],
    });

    expect(report.ready).toBe(false);
    expect(report.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'CLASS_CAPACITY_EXCEEDED',
      'ROOM_CAPACITY_INSUFFICIENT',
    ]));
  });

  it('bloqueia matéria sem professor qualificado ou disponibilidade exigida', () => {
    const report = buildTimetablePreparationReport({
      ...baseInput,
      teacherSubjects: [],
    });

    expect(report.ready).toBe(false);
    expect(report.blockers.some((item) => item.code === 'TEACHER_COVERAGE_MISSING')).toBe(true);
  });

  it('bloqueia uma atribuição cujo professor não possui a habilitação da matéria', () => {
    const report = buildTimetablePreparationReport({
      ...baseInput,
      offerings: [{ ...baseInput.offerings[0], teacher_profile_id: 'teacher-without-subject' }],
    });

    expect(report.ready).toBe(false);
    expect(report.blockers.some((item) => item.code === 'TEACHER_SUBJECT_NOT_AUTHORIZED')).toBe(true);
  });

  it('trata matéria complementar sem professor como aviso e não como bloqueio', () => {
    const report = buildTimetablePreparationReport({
      ...baseInput,
      curriculumItems: [{ ...baseInput.curriculumItems[0], is_complementary: true }],
      offerings: [],
      teacherSubjects: [],
    });

    expect(report.ready).toBe(true);
    expect(report.blockers).toHaveLength(0);
    expect(report.warnings.some((item) => item.code === 'COMPLEMENTARY_TEACHER_MISSING')).toBe(true);
    expect(report.warnings.find((item) => item.code === 'COMPLEMENTARY_TEACHER_MISSING')?.message).toContain('Matemática');
    expect(report.warnings.find((item) => item.code === 'COMPLEMENTARY_TEACHER_MISSING')?.message).not.toContain('subject-1');
  });

  it('não exibe o identificador técnico quando a disciplina não está no catálogo', () => {
    const report = buildTimetablePreparationReport({
      ...baseInput,
      subjectNames: {},
      curriculumItems: [{ ...baseInput.curriculumItems[0], is_complementary: true }],
      offerings: [],
      teacherSubjects: [],
    });

    const warning = report.warnings.find((item) => item.code === 'COMPLEMENTARY_TEACHER_MISSING');
    expect(warning?.message).toContain('disciplina não identificada');
    expect(warning?.message).not.toContain('subject-1');
  });

  it('permite geração sem disponibilidade quando a política desliga essa exigência', () => {
    const report = buildTimetablePreparationReport({
      ...baseInput,
      teacherAvailability: [],
      policy: { requireTeacherAvailability: false },
    });

    expect(report.ready).toBe(true);
  });
});
