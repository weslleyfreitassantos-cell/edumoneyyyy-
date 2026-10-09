// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpcomingAcademicCalendarEvents } from '../hooks/useAcademicCalendar';
import UpcomingAcademicEvents from './UpcomingAcademicEvents';

vi.mock('../hooks/useAcademicCalendar', () => ({
  useUpcomingAcademicCalendarEvents: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('UpcomingAcademicEvents', () => {
  it('mostra os próximos eventos compatíveis com o perfil', () => {
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({
      data: [{
        id: 'event-1',
        institution_id: 'institution-1',
        academic_year_id: null,
        title: 'Prova de Matemática',
        description: 'Revisão dos conteúdos de frações, porcentagem e resolução de problemas. Traga o material utilizado em aula.',
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
    expect(screen.getByText(/Revisão dos conteúdos de frações/)).toBeTruthy();
    const strip = screen.getByRole('region', { name: 'Lista de próximos eventos' });
    expect(strip.className).toContain('grid');
    expect(strip.className).not.toContain('overflow-x-auto');
    expect(strip.className).toContain('sm:grid-cols-2');
    expect(strip.getAttribute('tabindex')).toBe('0');
    expect(strip.querySelector('article')?.className).toContain('w-full');
    expect(useUpcomingAcademicCalendarEvents).toHaveBeenCalledWith('institution-1', 'ALL');
  });

  it('mantém os próximos cards na mesma coluna em telas menores', () => {
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({
      data: [
        { id: 'event-1', title: 'Prova de Matemática', description: null, starts_at: '2026-09-15T11:00:00.000Z', ends_at: null, all_day: false },
        { id: 'event-2', title: 'Reunião de responsáveis', description: null, starts_at: '2026-09-18T20:00:00.000Z', ends_at: null, all_day: false },
      ],
      isLoading: false,
      isError: false,
    } as never);

    render(<UpcomingAcademicEvents institutionId="institution-1" role="student" />);

    const strip = screen.getByRole('region', { name: 'Lista de próximos eventos' });
    expect(strip.querySelectorAll('article')).toHaveLength(2);
    expect(screen.getByText('Reunião de responsáveis')).toBeTruthy();
    expect(strip.querySelectorAll('article')[1]?.className).toContain('w-full');
  });

  it('mostra somente eventos do mês vigente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00.000Z'));
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({
      data: [
        { id: 'event-current-month', title: 'Mostra de projetos', description: null, starts_at: '2026-10-09T11:00:00.000Z', ends_at: null, all_day: false },
        { id: 'event-next-month', title: 'MÊS seguinte', description: null, starts_at: '2026-11-20T14:15:00.000Z', ends_at: null, all_day: false },
      ],
      isLoading: false,
      isError: false,
    } as never);

    render(<UpcomingAcademicEvents institutionId="institution-1" role="student" />);

    expect(screen.getByText('Mostra de projetos')).toBeTruthy();
    expect(screen.queryByText('MÊS seguinte')).toBeNull();
  });

  it('mostra estado vazio', () => {
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({ data: [], isLoading: false, isError: false } as never);

    render(<UpcomingAcademicEvents institutionId="institution-1" role="guardian" />);

    expect(screen.getByText('Nenhum evento próximo cadastrado.')).toBeTruthy();
  });
});
