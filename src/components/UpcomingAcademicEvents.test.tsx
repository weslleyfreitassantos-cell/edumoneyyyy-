// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useUpcomingAcademicCalendarEvents } from '../hooks/useAcademicCalendar';
import UpcomingAcademicEvents from './UpcomingAcademicEvents';

vi.mock('../hooks/useAcademicCalendar', () => ({
  useUpcomingAcademicCalendarEvents: vi.fn(),
}));

afterEach(() => cleanup());

describe('UpcomingAcademicEvents', () => {
  it('mostra os próximos eventos compatíveis com o perfil', () => {
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({
      data: [{
        id: 'event-1',
        institution_id: 'institution-1',
        academic_year_id: null,
        title: 'Prova de Matemática',
        description: null,
        event_type: 'ASSESSMENT',
        starts_at: '2026-09-15T11:00:00.000Z',
        ends_at: null,
        all_day: false,
        audience: 'ALL',
        class_id: null,
        class_name: null,
        subject_id: null,
        subject_name: 'Matemática',
        active: true,
        created_by: 'profile-1',
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
      }],
      isLoading: false,
      isError: false,
    } as never);

    render(<UpcomingAcademicEvents institutionId="institution-1" role="student" />);

    expect(screen.getByRole('heading', { name: 'Próximos eventos' })).toBeTruthy();
    expect(screen.getByText('Prova de Matemática')).toBeTruthy();
    expect(useUpcomingAcademicCalendarEvents).toHaveBeenCalledWith('institution-1', 'ALL');
  });

  it('mostra estado vazio', () => {
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({ data: [], isLoading: false, isError: false } as never);

    render(<UpcomingAcademicEvents institutionId="institution-1" role="guardian" />);

    expect(screen.getByText('Nenhum evento próximo cadastrado.')).toBeTruthy();
  });
});
