import { describe, expect, it } from 'vitest';

import {
  resolveAcademicDateStatus,
  type AcademicDateStatusContext,
} from './academicCalendarStatus';

const context: AcademicDateStatusContext = {
  institutionId: 'institution-1',
  academicYearId: 'year-1',
  classId: 'class-1',
  subjectId: 'subject-1',
};

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    institution_id: 'institution-1',
    academic_year_id: null,
    event_type: 'HOLIDAY' as const,
    starts_at: '2026-09-15T00:00:00.000Z',
    ends_at: null,
    all_day: true,
    class_id: null,
    subject_id: null,
    active: true,
    ...overrides,
  };
}

describe('academicCalendarStatus', () => {
  it('retorna OPEN sem eventos', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [], context).state).toBe('OPEN');
  });

  it.each(['HOLIDAY', 'RECESS', 'CLASS_SUSPENSION'] as const)(
    'bloqueia para o tipo %s',
    (eventType) => {
      const status = resolveAcademicDateStatus('2026-09-15', [event({ event_type: eventType })], context);
      expect(status.blocked).toBe(true);
      expect(status.blockers).toHaveLength(1);
    },
  );

  it.each(['SCHOOL_EVENT', 'MEETING', 'ASSESSMENT', 'OTHER'] as const)(
    'não bloqueia para o tipo não operacional %s',
    (eventType) => {
      expect(resolveAcademicDateStatus('2026-09-15', [event({ event_type: eventType })], context).state).toBe('OPEN');
    },
  );

  it('ignora evento inativo', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ active: false })], context).state).toBe('OPEN');
  });

  it('ignora evento com horário mesmo que seja de tipo bloqueante', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ all_day: false })], context).state).toBe('OPEN');
  });

  it('inclui todas as datas civis de um intervalo, inclusive os limites', () => {
    const range = event({
      starts_at: '2026-09-15T00:00:00.000Z',
      ends_at: '2026-09-17T00:00:00.000Z',
    });

    expect(resolveAcademicDateStatus('2026-09-15', [range], context).blocked).toBe(true);
    expect(resolveAcademicDateStatus('2026-09-16', [range], context).blocked).toBe(true);
    expect(resolveAcademicDateStatus('2026-09-17', [range], context).blocked).toBe(true);
    expect(resolveAcademicDateStatus('2026-09-18', [range], context).blocked).toBe(false);
  });

  it('isola instituições diferentes', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ institution_id: 'institution-2' })], context).state).toBe('OPEN');
  });

  it('trata evento sem ano letivo como global na instituição', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ academic_year_id: null })], context).blocked).toBe(true);
  });

  it('aceita evento do ano letivo informado', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ academic_year_id: 'year-1' })], context).blocked).toBe(true);
  });

  it('não aceita evento de outro ano letivo', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ academic_year_id: 'year-2' })], context).blocked).toBe(false);
  });

  it('não aplica evento específico de ano quando o contexto não informa ano', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ academic_year_id: 'year-1' })], { institutionId: 'institution-1' }).blocked).toBe(false);
  });

  it('trata evento sem turma como institucional', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ class_id: null })], context).blocked).toBe(true);
  });

  it('aceita evento da turma informada', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ class_id: 'class-1' })], context).blocked).toBe(true);
  });

  it('não aceita evento de outra turma', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ class_id: 'class-2' })], context).blocked).toBe(false);
  });

  it('não aplica evento específico de turma sem turma no contexto', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ class_id: 'class-1' })], { institutionId: 'institution-1' }).blocked).toBe(false);
  });

  it('trata evento sem disciplina como escopo amplo', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ subject_id: null })], context).blocked).toBe(true);
  });

  it('aceita evento da disciplina informada', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ subject_id: 'subject-1' })], context).blocked).toBe(true);
  });

  it('não aceita evento de outra disciplina', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ subject_id: 'subject-2' })], context).blocked).toBe(false);
  });

  it('não aplica evento específico de disciplina sem disciplina no contexto', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [event({ subject_id: 'subject-1' })], { institutionId: 'institution-1' }).blocked).toBe(false);
  });

  it('ordena bloqueadores de forma determinística', () => {
    const status = resolveAcademicDateStatus('2026-09-15', [
      event({ id: 'z-event', event_type: 'CLASS_SUSPENSION' }),
      event({ id: 'b-event', event_type: 'HOLIDAY' }),
      event({ id: 'a-event', event_type: 'HOLIDAY' }),
    ], context);

    expect(status.blockers.map((blocker) => blocker.event_id)).toEqual([
      'a-event',
      'b-event',
      'z-event',
    ]);
  });

  it('não bloqueia fins de semana por regra implícita', () => {
    expect(resolveAcademicDateStatus('2026-09-19', [], context).state).toBe('OPEN');
  });

  it('preserva a data civil consultada no status', () => {
    expect(resolveAcademicDateStatus('2026-09-15', [], context).date).toBe('2026-09-15');
  });
});
