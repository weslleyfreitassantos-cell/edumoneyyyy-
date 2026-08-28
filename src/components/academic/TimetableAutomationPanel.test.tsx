// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import {
  useDeleteTimetableVersion,
  useGenerateTimetableDraft,
  usePublishTimetableVersion,
  useSaveSchoolTimeSlots,
  useSchoolTimeSlots,
  useTimetableVersionEntries,
  useTimetableVersions,
  useUpdateTimetableVersionEntry,
} from '../../hooks/useAcademicAutomation';

import TimetableAutomationPanel from './TimetableAutomationPanel';

vi.mock('../../hooks/useAcademicStructure', () => ({
  useAcademicYears: vi.fn(),
}));

vi.mock('../../hooks/useAcademicAutomation', () => ({
  useDeleteTimetableVersion: vi.fn(),
  useGenerateTimetableDraft: vi.fn(),
  usePublishTimetableVersion: vi.fn(),
  useSaveSchoolTimeSlots: vi.fn(),
  useSchoolTimeSlots: vi.fn(),
  useTimetableVersionEntries: vi.fn(),
  useTimetableVersions: vi.fn(),
  useUpdateTimetableVersionEntry: vi.fn(),
}));

const slotMutation = { mutateAsync: vi.fn(), isPending: false };
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
  vi.mocked(useSchoolTimeSlots).mockReturnValue({
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
  vi.mocked(useSaveSchoolTimeSlots).mockReturnValue(slotMutation as never);
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
  it('configura os horários e oferece a geração automática', async () => {
    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);

    expect(screen.getByText('Quais horários sua escola utiliza?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gerar grade automaticamente' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Integral' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /adicionar horário/i }));
    expect(screen.getByLabelText('Dia do horário 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar horários' }));
    await waitFor(() => {
      expect(slotMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        institution_id: 'institution-1',
        shift: 'MATUTINO',
        slots: [expect.objectContaining({ day_of_week: 1 })],
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
    fireEvent.click(screen.getByRole('button', { name: /07:00 Português/i }));

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
