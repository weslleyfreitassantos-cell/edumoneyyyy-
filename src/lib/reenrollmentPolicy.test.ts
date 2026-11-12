import { describe, expect, it } from 'vitest';

import {
  formatReenrollmentStatusLabel,
  isReenrollmentGradeEligible,
  resolveReenrollmentDestination,
  resolveReenrollmentAcademicDecision,
  selectReenrollmentDestinationClass,
  formatReenrollmentPendingReason,
} from './reenrollmentPolicy';

describe('reenrollmentPolicy', () => {
  it('uses the student sex only for the final enrollment label', () => {
    expect(formatReenrollmentStatusLabel('ENROLLED', 'M')).toBe('Matriculado');
    expect(formatReenrollmentStatusLabel('ENROLLED', 'Masculino')).toBe('Matriculado');
    expect(formatReenrollmentStatusLabel('ENROLLED', 'F')).toBe('Matriculada');
    expect(formatReenrollmentStatusLabel('ENROLLED', 'Feminino')).toBe('Matriculada');
    expect(formatReenrollmentStatusLabel('ENROLLED', 'O')).toBe('Matrícula efetivada');
    expect(formatReenrollmentStatusLabel('ENROLLED')).toBe('Matrícula efetivada');
    expect(formatReenrollmentStatusLabel('APPROVED', 'F')).toBe('Aprovado');
  });

  it('keeps a pending annual result pending', () => {
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'PENDING' })).toBe('PENDING');
  });

  it('does not promote a student while recovery is pending', () => {
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'FAILED', recoveryPending: true })).toBe('RECOVERY');
  });

  it('retains failed students unless an actual recovery is pending', () => {
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'FAILED' })).toBe('RETAINED');
  });

  it('honors a class council decision over the calculated result', () => {
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'APPROVED', councilDecision: 'RETAIN' })).toBe('RETAINED');
    expect(resolveReenrollmentAcademicDecision({ finalResult: 'FAILED', councilDecision: 'TRANSFER' })).toBe('TRANSFERRED');
  });

  it('matches grade eligibility without depending on casing', () => {
    expect(isReenrollmentGradeEligible('  8º ano ', ['8º ANO'])).toBe(true);
    expect(isReenrollmentGradeEligible('9º ano', ['8º ano'])).toBe(false);
    expect(isReenrollmentGradeEligible('9º ano', [])).toBe(true);
  });

  it('advances recognized grades through the destination institution structure', () => {
    expect(resolveReenrollmentDestination({
      resultStatus: 'APPROVED',
      sourceGradeLevel: '1º ano',
      availableDestinationGrades: ['2º ano', '3º ano'],
    })).toMatchObject({ state: 'READY', destinationGradeLevel: '2º ano' });
  });

  it('keeps unresolved outcomes pending and never invents a missing destination', () => {
    expect(resolveReenrollmentDestination({
      resultStatus: 'RECOVERY',
      sourceGradeLevel: '1º ano',
      availableDestinationGrades: ['2º ano'],
    })).toMatchObject({ state: 'PENDING_RESULT', destinationGradeLevel: null });
    expect(resolveReenrollmentDestination({
      resultStatus: 'APPROVED',
      sourceGradeLevel: '1º ano',
      availableDestinationGrades: ['3º ano'],
    })).toMatchObject({ state: 'DESTINATION_GRADE_UNAVAILABLE', destinationGradeLevel: null });
  });

  it('treats the final high-school grade as graduation and retention as same-grade', () => {
    expect(resolveReenrollmentDestination({
      resultStatus: 'APPROVED',
      sourceGradeLevel: '3ª série do Ensino Médio',
      availableDestinationGrades: [],
    })).toMatchObject({ state: 'GRADUATING', destinationGradeLevel: null });
    expect(resolveReenrollmentDestination({
      resultStatus: 'RETAINED',
      sourceGradeLevel: '2ª série do Ensino Médio',
      availableDestinationGrades: ['2ª série do Ensino Médio'],
    })).toMatchObject({ state: 'READY', destinationGradeLevel: '2ª série do Ensino Médio' });
  });

  it('selects a destination class only when exactly one active, matching class has capacity', () => {
    const classes = [
      { id: 'full', gradeLevel: '2º ano', active: true, capacity: 20, activeEnrollments: 20 },
      { id: 'unique', gradeLevel: '2º ano', active: true, capacity: 20, activeEnrollments: 19 },
      { id: 'inactive', gradeLevel: '2º ano', active: false, capacity: 20, activeEnrollments: 0 },
      { id: 'other-grade', gradeLevel: '3º ano', active: true, capacity: 20, activeEnrollments: 0 },
    ];
    expect(selectReenrollmentDestinationClass('2º ano', classes)).toEqual({
      state: 'SELECTED',
      classId: 'unique',
    });
    expect(selectReenrollmentDestinationClass('4º ano', classes)).toEqual({
      state: 'NO_AVAILABLE_CLASS',
      classId: null,
    });
    expect(selectReenrollmentDestinationClass('2º ano', [
      classes[1],
      { ...classes[1], id: 'second-available' },
    ])).toEqual({ state: 'AMBIGUOUS', classId: null });
  });

  it('translates internal pending codes and never exposes unknown database codes', () => {
    expect(formatReenrollmentPendingReason(
      'RESULTADO_NAO_HOMOLOGADO; TURMA_DESTINO_NAO_DEFINIDA; SEGREDO_INTERNO',
    )).toEqual([
      'Aguardando resultado acadêmico oficial.',
      'Aguardando definição da turma do próximo ano.',
      'Há uma pendência que precisa de revisão pela secretaria.',
    ]);
  });
});
