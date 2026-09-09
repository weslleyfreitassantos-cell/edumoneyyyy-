// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';
import { useSubjects } from '../../../hooks/useSubjects';
import {
  useAcademicCalendarEvents,
  useCreateAcademicCalendarEvent,
  useSetAcademicCalendarEventActive,
  useUpdateAcademicCalendarEvent,
} from '../../../hooks/useAcademicCalendar';
import AcademicCalendarTab from './AcademicCalendarTab';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: vi.fn() }));
vi.mock('../../../hooks/useAcademicStructure', () => ({ useAcademicYears: vi.fn() }));
vi.mock('../../../hooks/useClasses', () => ({ useClasses: vi.fn() }));
vi.mock('../../../hooks/useSubjects', () => ({ useSubjects: vi.fn() }));
vi.mock('../../../hooks/useAcademicCalendar', () => ({
  useAcademicCalendarEvents: vi.fn(),
  useCreateAcademicCalendarEvent: vi.fn(),
  useSetAcademicCalendarEventActive: vi.fn(),
  useUpdateAcademicCalendarEvent: vi.fn(),
}));

const event = {
  id: 'event-1',
  institution_id: 'institution-1',
  academic_year_id: 'year-1',
  title: 'Reunião de responsáveis',
  description: 'Encontro no auditório.',
  event_type: 'MEETING' as const,
  starts_at: '2026-09-15T11:00:00.000Z',
  ends_at: '2026-09-15T12:00:00.000Z',
  all_day: false,
  audience: 'GUARDIANS' as const,
  class_id: null,
  class_name: null,
  subject_id: null,
  subject_name: null,
  active: true,
  created_by: 'profile-1',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

const createEvent = vi.fn().mockResolvedValue(event);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    profile: {
      id: 'profile-1',
      full_name: 'Diretor Teste',
      email: 'diretor@example.com',
      avatar_url: null,
      role: 'DIRECTOR',
      platform_role: 'USER',
    },
  } as never);
  vi.mocked(useCurrentInstitution).mockReturnValue({ data: 'institution-1', isLoading: false, isError: false, error: null } as never);
  vi.mocked(useAcademicYears).mockReturnValue({ data: [{ id: 'year-1', institution_id: 'institution-1', name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', active: true, terms: [] }], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClasses).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useSubjects).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useAcademicCalendarEvents).mockReturnValue({ data: [event], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useCreateAcademicCalendarEvent).mockReturnValue({ mutateAsync: createEvent, isPending: false } as never);
  vi.mocked(useSetAcademicCalendarEventActive).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(useUpdateAcademicCalendarEvent).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
});

afterEach(() => cleanup());

function renderCalendar() {
  return render(<MemoryRouter><AcademicCalendarTab /></MemoryRouter>);
}

describe('AcademicCalendarTab', () => {
  it('renderiza o calendário mensal e abre detalhes do evento', () => {
    renderCalendar();

    expect(screen.getByRole('heading', { name: 'Calendário escolar' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Reunião de responsáveis' })[0]);
    expect(screen.getByRole('heading', { name: 'Reunião de responsáveis' })).toBeTruthy();
    expect(screen.getByText('Encontro no auditório.')).toBeTruthy();
  });

  it('aplica filtro por tipo', () => {
    renderCalendar();

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'HOLIDAY' } });

    expect(vi.mocked(useAcademicCalendarEvents).mock.calls.at(-1)?.[1]).toEqual({
      eventType: 'HOLIDAY',
      audience: 'ALL',
      date: '',
    });
  });

  it('cria um evento pelo formulário administrativo', async () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: /novo evento/i }));
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Feriado escolar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }));

    await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Feriado escolar',
      institution_id: 'institution-1',
      audience: 'ALL',
    })));
  });
});
