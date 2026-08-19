import { describe, expect, it } from 'vitest';

import {
  buildSchoolSetupReadiness,
  type SchoolSetupReadiness,
} from './schoolSetupService';

const baseInput: Parameters<typeof buildSchoolSetupReadiness>[0] = {
  institutionId: 'institution-a',
  academicYear: {
    id: 'year-1',
    name: '2026',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    active: true,
  },
  terms: [{ id: 'term-1', academic_year_id: 'year-1', start_date: '2026-01-01', end_date: '2026-06-30', active: true }],
  subjects: [{ id: 'subject-math' }],
  policies: [{ id: 'policy-1' }],
  classes: [{ id: 'class-1', shift: 'MATUTINO', active: true }],
  curriculum: [{
    class_id: 'class-1',
    subject_id: 'subject-math',
    weekly_lessons: 2,
    active: true,
  }],
  timeSlots: [
    { shift: 'MATUTINO', day_of_week: 1, start_time: '07:00', end_time: '07:50', active: true },
    { shift: 'MATUTINO', day_of_week: 2, start_time: '07:00', end_time: '07:50', active: true },
  ],
  publishedVersion: { id: 'version-1', published_at: '2026-01-01T00:00:00Z' },
  publishedEntries: [
    { class_id: 'class-1', term_id: 'term-1', subject_offering_id: 'offering-1', day_of_week: 1, start_time: '07:00', end_time: '07:50', active: true },
    { class_id: 'class-1', term_id: 'term-1', subject_offering_id: 'offering-1', day_of_week: 2, start_time: '07:00', end_time: '07:50', active: true },
  ],
  offerings: [{
    id: 'offering-1',
    class_id: 'class-1',
    subject_id: 'subject-math',
    term_id: 'term-1',
    active: true,
  }],
};

function getStep(readiness: SchoolSetupReadiness, id: string) {
  return readiness.steps.find((step) => step.id === id);
}

describe('school setup readiness', () => {
  it('fica IN_PROGRESS sem grade publicada', () => {
    const readiness = buildSchoolSetupReadiness({
      ...baseInput,
      publishedVersion: null,
      publishedEntries: [],
    });

    expect(readiness.status).toBe('IN_PROGRESS');
    expect(readiness.configured).toBe(false);
    expect(readiness.nextStepId).toBe('timetable');
    expect(getStep(readiness, 'timetable')?.complete).toBe(false);
  });

  it('fica IN_PROGRESS quando há horários mas a turma ainda não possui grade', () => {
    const readiness = buildSchoolSetupReadiness({
      ...baseInput,
      publishedVersion: null,
      publishedEntries: [],
    });

    expect(readiness.status).toBe('IN_PROGRESS');
    expect(readiness.review.timetableClassCount).toBe(0);
  });

  it('fica CONFIGURED quando a carga da turma está integralmente publicada', () => {
    const readiness = buildSchoolSetupReadiness(baseInput);

    expect(readiness.status).toBe('CONFIGURED');
    expect(readiness.configured).toBe(true);
    expect(readiness.progress).toBe(100);
    expect(readiness.review.timetableClassCount).toBe(1);
    expect(getStep(readiness, 'timetable')?.complete).toBe(true);
  });

  it('fica CONFIGURED com rascunho estrutural completo mesmo sem gate de professor', () => {
    const readiness = buildSchoolSetupReadiness({
      ...baseInput,
      publishedVersion: null,
      publishedEntries: [],
      timetableCandidates: [{
        version: { id: 'draft-1', status: 'DRAFT', published_at: null, created_at: '2026-01-02T00:00:00Z' },
        entries: baseInput.publishedEntries,
      }],
    });

    expect(readiness.status).toBe('CONFIGURED');
    expect(readiness.configured).toBe(true);
    expect(readiness.publishedVersionId).toBeNull();
    expect(readiness.review.timetableClassCount).toBe(1);
  });

  it('não conclui o onboarding quando o rascunho possui conflito de turma', () => {
    const readiness = buildSchoolSetupReadiness({
      ...baseInput,
      publishedVersion: null,
      publishedEntries: [],
      timetableCandidates: [{
        version: { id: 'draft-1', status: 'DRAFT', published_at: null, created_at: '2026-01-02T00:00:00Z' },
        entries: [
          baseInput.publishedEntries[0],
          { ...baseInput.publishedEntries[1], day_of_week: 1 },
        ],
      }],
    });

    expect(readiness.configured).toBe(false);
    expect(getStep(readiness, 'timetable')?.complete).toBe(false);
  });

  it('não conclui a grade quando uma turma não possui turno', () => {
    const readiness = buildSchoolSetupReadiness({
      ...baseInput,
      classes: [{ id: 'class-1', shift: null, active: true }],
    });

    expect(readiness.configured).toBe(false);
    expect(getStep(readiness, 'classes')?.complete).toBe(false);
    expect(getStep(readiness, 'timetable')?.complete).toBe(false);
  });
});
