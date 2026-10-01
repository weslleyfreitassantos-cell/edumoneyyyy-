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
    const strip = screen.getByRole('region', { name: /No celular/ });
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.className).toContain('snap-x');
    expect(strip.className).toContain('sm:grid-cols-2');
    expect(strip.getAttribute('tabindex')).toBe('0');
    expect(strip.querySelector('article')?.className).toContain('w-[min(80vw,24rem)]');
    expect(useUpcomingAcademicCalendarEvents).toHaveBeenCalledWith('institution-1', 'ALL');
  });

  it('mantém os próximos cards visíveis como indicação de continuidade no mobile', () => {
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({
      data: [
        { id: 'event-1', title: 'Prova de Matemática', description: null, starts_at: '2026-09-15T11:00:00.000Z', ends_at: null, all_day: false },
        { id: 'event-2', title: 'Reunião de responsáveis', description: null, starts_at: '2026-09-18T20:00:00.000Z', ends_at: null, all_day: false },
      ],
      isLoading: false,
      isError: false,
    } as never);

    render(<UpcomingAcademicEvents institutionId="institution-1" role="student" />);

    const strip = screen.getByRole('region', { name: /No celular/ });
    expect(strip.querySelectorAll('article')).toHaveLength(2);
    expect(screen.getByText('Reunião de responsáveis')).toBeTruthy();
    expect(strip.querySelectorAll('article')[1]?.className).toContain('snap-start');
  });

  it('mostra estado vazio', () => {
    vi.mocked(useUpcomingAcademicCalendarEvents).mockReturnValue({ data: [], isLoading: false, isError: false } as never);

    render(<UpcomingAcademicEvents institutionId="institution-1" role="guardian" />);

    expect(screen.getByText('Nenhum evento próximo cadastrado.')).toBeTruthy();
  });
});
