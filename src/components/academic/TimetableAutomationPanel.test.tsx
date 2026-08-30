// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import {
  useAcademicShiftSettings,
  useSchoolScheduleBreaks,
} from '../../hooks/useAcademicTermClosing';
import {
  useDeleteTimetableVersion,
  useGenerateTimetableDraft,
  usePublishTimetableVersion,
  useTimetableVersionEntries,
  useTimetableVersions,
  useUpdateTimetableVersionEntry,
} from '../../hooks/useAcademicAutomation';

import TimetableAutomationPanel from './TimetableAutomationPanel';

vi.mock('../../hooks/useAcademicStructure', () => ({
  useAcademicYears: vi.fn(),
}));

vi.mock('../../hooks/useAcademicTermClosing', () => ({
  useAcademicShiftSettings: vi.fn(),
  useSchoolScheduleBreaks: vi.fn(),
}));

vi.mock('../../hooks/useAcademicAutomation', () => ({
  useDeleteTimetableVersion: vi.fn(),
  useGenerateTimetableDraft: vi.fn(),
  usePublishTimetableVersion: vi.fn(),
  useTimetableVersionEntries: vi.fn(),
  useTimetableVersions: vi.fn(),
  useUpdateTimetableVersionEntry: vi.fn(),
}));

const generateMutation = { mutateAsync: vi.fn(), isPending: false };
const deleteMutation = { mutateAsync: vi.fn(), isPending: false };
const publishMutation = { mutateAsync: vi.fn(), isPending: false };
const updateEntryMutation = { mutateAsync: vi.fn(), isPending: false };

function mockDefaults() {
  vi.mocked(useAcademicYears).mockReturnValue({
    data: [{ id: 'year-1', name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', active: true, terms: [] }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useAcademicShiftSettings).mockReturnValue({
    data: ['MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO'],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useSchoolScheduleBreaks).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useTimetableVersions).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useTimetableVersionEntries).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useGenerateTimetableDraft).mockReturnValue(generateMutation as never);
  vi.mocked(useDeleteTimetableVersion).mockReturnValue(deleteMutation as never);
  vi.mocked(usePublishTimetableVersion).mockReturnValue(publishMutation as never);
  vi.mocked(useUpdateTimetableVersionEntry).mockReturnValue(updateEntryMutation as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDefaults();
});

afterEach(() => {
  cleanup();
});

describe('TimetableAutomationPanel', () => {
  it('conecta o turno ao gerador sem exibir o editor manual de horários', async () => {
    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);

    expect(screen.getByText('Quais horários sua escola utiliza?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gerar grade automaticamente' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Turno do gerador' }) as HTMLSelectElement).value).toBe('TODOS');
    expect(screen.getByRole('option', { name: 'Integral' })).toBeTruthy();
    expect(screen.queryByText('Horários da escola')).toBeNull();

    generateMutation.mutateAsync.mockResolvedValue({
      valid: false,
      entries: [],
      diagnostics: [],
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Turno do gerador' }), { target: { value: 'MATUTINO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar grade automaticamente' }));

    await waitFor(() => {
      expect(generateMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        shift: 'MATUTINO',
      }));
    });
  });

  it('exibe o rascunho por turma e permite marcar uma aula como fixa', () => {
    vi.mocked(useTimetableVersions).mockReturnValue({
      data: [{ id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', name: 'Proposta', status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_at: '2026-01-01', published_at: null }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useTimetableVersionEntries).mockReturnValue({
      data: [{ id: 'entry-1', version_id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', term_id: 'term-1', class_id: 'class-1', class_name: '1A', subject_offering_id: 'offering-1', subject_name: 'Português', teacher_profile_id: 'teacher-1', teacher_name: 'Professora Ana', room_id: null, day_of_week: 1, start_time: '07:00', end_time: '07:50', locked: false, active: true }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar grade' }));
    fireEvent.click(screen.getByRole('button', { name: /Editar Português às 07:00/i }));

    expect(screen.getByText('Bloqueado/Fixo: preservar ao regenerar')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('mostra o bloqueio e os diagnósticos quando a geração é UNSAT', async () => {
    generateMutation.mutateAsync.mockResolvedValue({
      valid: false,
      entries: [],
      diagnostics: [{ message: '1A precisa de mais horários.', suggestions: [] }],
    });

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar grade automaticamente' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/não foi possível montar a grade/i);
    expect(alert.textContent).toMatch(/precisa de mais horários/i);
  });

  it('exibe intervalos configurados na revisão sem tratá-los como aulas', () => {
    vi.mocked(useTimetableVersions).mockReturnValue({
      data: [{ id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', name: 'Proposta', status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_at: '2026-01-01', published_at: null }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useTimetableVersionEntries).mockReturnValue({
      data: [{ id: 'entry-1', version_id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', term_id: 'term-1', term_name: '1º Bimestre', class_id: 'class-1', class_name: '1A', class_shift: 'MATUTINO', subject_offering_id: 'offering-1', subject_name: 'Português', teacher_profile_id: 'teacher-1', teacher_name: 'Professora Ana', room_id: null, day_of_week: 1, start_time: '07:00', end_time: '07:50', locked: false, active: true }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useSchoolScheduleBreaks).mockReturnValue({
      data: [{ id: 'break-1', institution_id: 'institution-1', shift: 'MATUTINO', day_of_week: 1, name: 'Intervalo', start_time: '10:30', end_time: '10:50', active: true }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar grade' }));

    expect(screen.getByTestId('timetable-break')).toBeTruthy();
    expect(screen.getByText('Intervalo')).toBeTruthy();
    expect(screen.getByText('Pausa escolar')).toBeTruthy();
  });

  it('explica quando a publicação é bloqueada por falta de disponibilidade docente', async () => {
    vi.mocked(useTimetableVersions).mockReturnValue({
      data: [{ id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', name: 'Proposta', status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_at: '2026-01-01', published_at: null }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    publishMutation.mutateAsync.mockRejectedValue({
      code: 'P0001',
      message: 'TEACHER_NOT_AVAILABLE',
    });

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar grade' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/disponibilidade semanal cadastrada/i);
    expect(alert.textContent).toMatch(/Usuários > Professores/i);
  });

  it('permite excluir uma proposta em rascunho', async () => {
    vi.mocked(useTimetableVersions).mockReturnValue({
      data: [{ id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', name: 'Proposta', status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_at: '2026-01-01', published_at: null }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteMutation.mutateAsync.mockResolvedValue(undefined);

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir proposta' }));

    await waitFor(() => {
      expect(deleteMutation.mutateAsync).toHaveBeenCalledWith({
        versionId: 'version-1',
        institutionId: 'institution-1',
        academicYearId: 'year-1',
      });
    });
    expect((await screen.findByRole('status')).textContent).toContain('Proposta excluída.');
    confirmSpy.mockRestore();
  });
});
