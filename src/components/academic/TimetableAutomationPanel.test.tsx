// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import {
  useGenerateTimetableDraft,
  useDeleteTimetableVersion,
  usePublishTimetableVersion,
  useTimetableVersionEntries,
  useTimetableVersions,
  useUpdateTimetableVersionEntry,
} from '../../hooks/useAcademicAutomation';

import TimetableAutomationPanel from './TimetableAutomationPanel';

vi.mock('../../hooks/useAcademicStructure', () => ({
  useAcademicYears: vi.fn(),
}));

vi.mock('../../hooks/useAcademicAutomation', () => ({
  useGenerateTimetableDraft: vi.fn(),
  useDeleteTimetableVersion: vi.fn(),
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
  vi.restoreAllMocks();
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

  it('permite excluir uma grade em rascunho após confirmação', async () => {
    vi.mocked(useTimetableVersions).mockReturnValue({
      data: [{ id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', name: 'Proposta', status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_at: '2026-01-01', published_at: null }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir grade Proposta' }));

    await waitFor(() => {
      expect(deleteMutation.mutateAsync).toHaveBeenCalledWith({
        versionId: 'version-1',
        institutionId: 'institution-1',
        academicYearId: 'year-1',
      });
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
      data: [{ id: 'entry-1', version_id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', term_id: 'term-1', class_id: 'class-1', class_name: '1A', term_name: '1º Bimestre', subject_offering_id: 'offering-1', subject_name: 'Português', teacher_profile_id: 'teacher-1', teacher_name: 'Professora Ana', room_id: null, day_of_week: 1, start_time: '07:00', end_time: '07:50', locked: false, active: true }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar grade' }));
    expect(screen.getByRole('columnheader', { name: 'Horário' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Segunda' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Sexta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Editar Português às 07:00/i }));

    expect(screen.getByText('Bloqueado/Fixo: preservar ao regenerar')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('separa a revisão por período quando os horários semanais se repetem', () => {
    vi.mocked(useTimetableVersions).mockReturnValue({
      data: [{ id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', name: 'Proposta', status: 'DRAFT', generation_source: 'DETERMINISTIC_GENERATOR', created_at: '2026-01-01', published_at: null }],
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useTimetableVersionEntries).mockReturnValue({
      data: [
        { id: 'entry-1', version_id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', term_id: 'term-1', class_id: 'class-1', class_name: '1A', term_name: '1º Bimestre', subject_offering_id: 'offering-1', subject_name: 'Português', teacher_profile_id: 'teacher-1', teacher_name: 'Professora Ana', room_id: null, day_of_week: 1, start_time: '07:00', end_time: '07:50', locked: false, active: true },
        { id: 'entry-2', version_id: 'version-1', institution_id: 'institution-1', academic_year_id: 'year-1', term_id: 'term-2', class_id: 'class-1', class_name: '1A', term_name: '2º Bimestre', subject_offering_id: 'offering-2', subject_name: 'Matemática', teacher_profile_id: 'teacher-2', teacher_name: 'Professor Bruno', room_id: null, day_of_week: 1, start_time: '07:00', end_time: '07:50', locked: false, active: true },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<TimetableAutomationPanel institutionId="institution-1" createdBy="profile-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar grade' }));

    expect(screen.getByRole('heading', { name: /1A.*1º Bimestre/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /1A.*2º Bimestre/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /07:00/ })).toHaveLength(2);
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
});
