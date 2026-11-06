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
  useImportBrazilianNationalHolidays,
  usePublishReenrollmentCalendarEvent,
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
  useImportBrazilianNationalHolidays: vi.fn(),
  usePublishReenrollmentCalendarEvent: vi.fn(),
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

const legacyAllDayReenrollment = {
  ...event,
  id: 'legacy-reenrollment-event',
  title: 'Rematrícula da escola',
  event_type: 'RE_ENROLLMENT' as const,
  starts_at: '2026-09-15T00:00:00.000Z',
  ends_at: '2026-09-15T00:00:00.000Z',
  all_day: true,
  audience: 'ALL' as const,
  reenrollment_campaign: null,
};

const createEvent = vi.fn().mockResolvedValue(event);
const importHolidays = vi.fn().mockResolvedValue({
  year: 2026,
  total: 10,
  imported: 10,
  skipped: 0,
});
const publishReenrollment = vi.fn().mockResolvedValue({
  event: { ...event, event_type: 'RE_ENROLLMENT' },
  campaign: { id: 'campaign-1' },
  replayed: false,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
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
  vi.mocked(useAcademicYears).mockReturnValue({ data: [
    { id: 'year-1', institution_id: 'institution-1', name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', active: true, terms: [] },
    { id: 'year-2', institution_id: 'institution-1', name: '2027', start_date: '2027-01-01', end_date: '2027-12-31', active: true, terms: [] },
  ], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClasses).mockReturnValue({ data: [{ id: 'class-1', institution_id: 'institution-1', academic_year_id: 'year-1', name: '1º ano A', grade_level: '1º ano', active: true }], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useSubjects).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useAcademicCalendarEvents).mockReturnValue({ data: [event], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useCreateAcademicCalendarEvent).mockReturnValue({ mutateAsync: createEvent, isPending: false } as never);
  vi.mocked(useImportBrazilianNationalHolidays).mockReturnValue({ mutateAsync: importHolidays, isPending: false } as never);
  vi.mocked(usePublishReenrollmentCalendarEvent).mockReturnValue({ mutateAsync: publishReenrollment, isPending: false } as never);
  vi.mocked(useSetAcademicCalendarEventActive).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(useUpdateAcademicCalendarEvent).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

  it('publica rematrícula pelo fluxo atômico do calendário', async () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: /novo evento/i }));
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Rematrícula 2027' } });
    fireEvent.change(screen.getByLabelText('Tipo *'), { target: { value: 'RE_ENROLLMENT' } });
    fireEvent.change(screen.getByLabelText('Início das confirmações *'), { target: { value: '2026-09-15T08:00' } });
    fireEvent.change(screen.getByLabelText('Encerramento das confirmações *'), { target: { value: '2026-09-30T18:00' } });
    fireEvent.change(screen.getByLabelText('Ano letivo de destino *'), { target: { value: 'year-2' } });
    fireEvent.click(screen.getByLabelText('1º ano'));
    fireEvent.change(screen.getByLabelText('Texto do contrato *'), { target: { value: 'Termos completos de teste para confirmação de rematrícula escolar.' } });

    expect(screen.queryByLabelText('Público *')).toBeNull();
    expect(screen.queryByLabelText('Evento ativo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar rematrícula' }));

    await waitFor(() => expect(publishReenrollment).toHaveBeenCalledWith(expect.objectContaining({
      eventId: null,
      input: expect.objectContaining({
        event_type: 'RE_ENROLLMENT',
        institution_id: 'institution-1',
      }),
      settings: expect.objectContaining({
        source_academic_year_id: 'year-1',
        destination_academic_year_id: 'year-2',
        eligible_grade_levels: ['1º ano'],
      }),
    })));
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('converte evento legado all-day em campanha reutilizando o mesmo ID', async () => {
    vi.mocked(useAcademicCalendarEvents).mockReturnValue({ data: [legacyAllDayReenrollment], isLoading: false, isError: false, error: null } as never);
    renderCalendar();

    fireEvent.click(screen.getByRole('button', { name: 'Rematrícula da escola' }));
    expect(screen.getByText(/mantendo este mesmo evento, sem criar outro/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    expect((screen.getByLabelText('Início das confirmações *') as HTMLInputElement).value).toBe('2026-09-15T08:00');
    expect((screen.getByLabelText('Encerramento das confirmações *') as HTMLInputElement).value).toBe('2026-09-15T18:00');
    fireEvent.change(screen.getByLabelText('Ano letivo de destino *'), { target: { value: 'year-2' } });
    fireEvent.click(screen.getByLabelText('1º ano'));
    fireEvent.change(screen.getByLabelText('Texto do contrato *'), { target: { value: 'Termos completos para regularização do evento antigo em campanha de rematrícula.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar rematrícula' }));

    await waitFor(() => expect(publishReenrollment).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'legacy-reenrollment-event',
      input: expect.objectContaining({
        event_type: 'RE_ENROLLMENT',
        all_day: false,
        starts_at: '2026-09-15T08:00',
        ends_at: '2026-09-15T18:00',
      }),
      settings: expect.objectContaining({
        source_academic_year_id: 'year-1',
        destination_academic_year_id: 'year-2',
        eligible_grade_levels: ['1º ano'],
      }),
    })));
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('importa os feriados nacionais do ano letivo preferencial', async () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: /importar feriados nacionais/i }));

    await waitFor(() => expect(importHolidays).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      academicYearId: 'year-1',
      createdBy: 'profile-1',
      year: 2026,
    }));
  });
});
