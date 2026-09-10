import { describe, expect, it } from 'vitest';

import type { AcademicDateStatus } from '../academicCalendarStatus';
import {
  buildTimetableCalendarRequests,
  getDateForWeekDay,
  getTimetableBlockerLabel,
  getWeekStartDateKey,
  projectTimetableOccurrences,
  timetableCalendarRequestKey,
} from './timetableOccurrences';
import type { TimetableEntryRow } from '../../services/timetableService';

const entry: TimetableEntryRow = {
  id: 'entry-1',
  institution_id: 'institution-1',
  subject_offering_id: 'offering-exact-1',
  class_id: 'class-1',
  academic_year_id: 'year-1',
  term_id: 'term-1',
  subject_id: 'subject-1',
  teacher_profile_id: 'teacher-1',
  room_id: 'room-1',
  room_name: 'Sala 01',
  day_of_week: 1,
  day_label: 'Segunda',
  start_time: '07:00',
  end_time: '07:50',
  active: true,
  class_name: '1º A',
  subject_name: 'Matemática',
  teacher_name: 'Prof. Teste',
};

const openStatus: AcademicDateStatus = {
  date: '2026-09-07',
  state: 'OPEN',
  blocked: false,
  blockers: [],
};

const holidayStatus: AcademicDateStatus = {
  date: '2026-09-07',
  state: 'BLOCKED',
  blocked: true,
  blockers: [{ event_id: 'holiday-1', event_type: 'HOLIDAY' }],
};

describe('timetableOccurrences', () => {
  it('projeta uma aula aberta preservando data, período e oferta exata', () => {
    const occurrences = projectTimetableOccurrences(
      [entry],
      '2026-09-07',
      {
        [timetableCalendarRequestKey(
          {
            institutionId: entry.institution_id,
            academicYearId: entry.academic_year_id,
            classId: entry.class_id,
            subjectId: entry.subject_id,
          },
          '2026-09-07',
        )]: openStatus,
      },
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      date: '2026-09-07',
      state: 'SCHEDULED',
      entry: {
        id: 'entry-1',
        subject_offering_id: 'offering-exact-1',
        term_id: 'term-1',
      },
    });
  });

  it('mantém a aula visível e a marca como suspensa quando o calendário bloqueia o dia', () => {
    const occurrences = projectTimetableOccurrences(
      [entry],
      '2026-09-07',
      {
        [timetableCalendarRequestKey(
          {
            institutionId: entry.institution_id,
            academicYearId: entry.academic_year_id,
            classId: entry.class_id,
            subjectId: entry.subject_id,
          },
          '2026-09-07',
        )]: holidayStatus,
      },
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].state).toBe('SUSPENDED');
    expect(occurrences[0].calendarStatus.blockers).toEqual([
      { event_id: 'holiday-1', event_type: 'HOLIDAY' },
    ]);
  });

  it('resume bloqueios múltiplos com rótulos operacionais estáveis', () => {
    expect(getTimetableBlockerLabel({
      date: '2026-09-07',
      state: 'BLOCKED',
      blocked: true,
      blockers: [
        { event_id: 'suspension-1', event_type: 'CLASS_SUSPENSION' },
        { event_id: 'recess-1', event_type: 'RECESS' },
      ],
    })).toBe('Suspensão de aula • Recesso');
  });

  it('não elimina uma aula quando a consulta de calendário falha', () => {
    const occurrences = projectTimetableOccurrences([entry], '2026-09-07');

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].state).toBe('SCHEDULED');
    expect(occurrences[0].entry.subject_offering_id).toBe('offering-exact-1');
  });

  it('não cria ocorrências sem entradas e calcula a semana civil correta', () => {
    expect(projectTimetableOccurrences([], '2026-09-07')).toEqual([]);
    expect(getWeekStartDateKey('2026-09-10')).toBe('2026-09-07');
    expect(getDateForWeekDay('2026-09-07', 5)).toBe('2026-09-11');
  });

  it('deduplica consultas iguais sem perder os contextos de turma e disciplina', () => {
    const duplicate = { ...entry, id: 'entry-2', start_time: '08:00', end_time: '08:50' };
    const differentSubject = {
      ...entry,
      id: 'entry-3',
      subject_id: 'subject-2',
    };

    const requests = buildTimetableCalendarRequests(
      [entry, duplicate, differentSubject],
      '2026-09-07',
    );

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.context.subjectId)).toEqual([
      'subject-1',
      'subject-2',
    ]);
    expect(requests.every((request) => request.context.academicYearId === 'year-1')).toBe(true);
  });
});
