// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstitution } from '../contexts/InstitutionContext';
import { useStudentAcademicCalendar } from '../hooks/useAcademicCalendar';
import StudentCalendarPage from './StudentCalendarPage';

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

vi.mock('../hooks/useAcademicCalendar', () => ({
  useStudentAcademicCalendar: vi.fn(),
}));

const events = [
  {
    id: 'event-current',
    institution_id: 'institution-1',
    academic_year_id: null,
    title: 'Mostra de projetos',
    description: 'Apresentação dos projetos da turma.',
    event_type: 'SCHOOL_EVENT' as const,
    starts_at: '2026-10-26T11:00:00.000Z',
    ends_at: null,
    all_day: false,
    audience: 'ALL' as const,
    class_id: null,
    class_name: null,
    subject_id: null,
    subject_name: null,
    active: true,
    created_by: 'profile-1',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'event-next',
    institution_id: 'institution-1',
    academic_year_id: null,
    title: 'Recesso escolar',
    description: null,
    event_type: 'RECESS' as const,
    starts_at: '2026-11-20T00:00:00.000Z',
    ends_at: null,
    all_day: true,
    audience: 'STUDENTS' as const,
    class_id: null,
    class_name: null,
    subject_id: null,
    subject_name: null,
    active: true,
    created_by: 'profile-1',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-08T12:00:00.000Z'));
  vi.mocked(useInstitution).mockReturnValue({ currentInstitutionId: 'institution-1' } as never);
  vi.mocked(useStudentAcademicCalendar).mockReturnValue({ data: events, isLoading: false, isError: false } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StudentCalendarPage', () => {
  it('mostra o mês atual e também eventos de outros meses', () => {
    render(<StudentCalendarPage />);

    expect(screen.getByRole('heading', { name: 'Calendário escolar' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Todos os eventos' })).toBeTruthy();
    expect(screen.getAllByText('Mostra de projetos').length).toBeGreaterThan(0);
    expect(screen.queryByText('Recesso escolar')).toBeNull();
    expect(screen.getByText('1 evento neste mês')).toBeTruthy();
  });

  it('inclui o próximo mês no carrossel durante a última semana', () => {
    vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
    render(<StudentCalendarPage />);

    expect(screen.getByText('Eventos restantes deste mês e do próximo.')).toBeTruthy();
    expect(screen.getByText('1 de 2')).toBeTruthy();
    expect(screen.queryByText('Recesso escolar')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo evento' }));

    expect(screen.getByText('Recesso escolar')).toBeTruthy();
  });

  it('permite navegar para outro mês', () => {
    render(<StudentCalendarPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(screen.getByRole('heading', { name: 'novembro de 2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('gridcell', { name: /20 de novembro de 2026/ }));
    expect(screen.getAllByRole('heading', { name: /sexta-feira, 20 de novembro/ })).toHaveLength(2);
  });
});
