// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';
import {
  useAddClassCouncilParticipant,
  useCancelClassCouncil,
  useClassCouncilContextOptions,
  useClassCouncilDetails,
  useClassCouncilEligibleParticipants,
  useClassCouncils,
  useCompleteClassCouncil,
  useCreateClassCouncil,
  useOpenClassCouncil,
  useReopenClassCouncil,
  useRemoveClassCouncilParticipant,
  useUpdateClassCouncil,
  useUpdateClassCouncilStudentNote,
} from '../../hooks/useClassCouncils';
import ClassCouncilPanel from './ClassCouncilPanel';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: vi.fn() }));
vi.mock('../../hooks/useClassCouncils', () => ({
  useAddClassCouncilParticipant: vi.fn(),
  useRemoveClassCouncilParticipant: vi.fn(),
  useCancelClassCouncil: vi.fn(),
  useClassCouncilContextOptions: vi.fn(),
  useClassCouncilDetails: vi.fn(),
  useClassCouncilEligibleParticipants: vi.fn(),
  useClassCouncils: vi.fn(),
  useCompleteClassCouncil: vi.fn(),
  useCreateClassCouncil: vi.fn(),
  useOpenClassCouncil: vi.fn(),
  useReopenClassCouncil: vi.fn(),
  useUpdateClassCouncil: vi.fn(),
  useUpdateClassCouncilStudentNote: vi.fn(),
}));

const institutionId = '11111111-1111-1111-1111-111111111111';
const council = {
  id: 'council-1',
  institutionId,
  academicYearId: 'year-1',
  academicYearName: '2026',
  termId: 'term-1',
  termName: '1º bimestre',
  termStartDate: '2026-01-01',
  termEndDate: '2026-04-30',
  classId: 'class-1',
  className: '1º ano A',
  gradeLevel: '1º ano',
  shift: 'MATUTINO',
  status: 'DRAFT' as const,
  scheduledAt: null,
  openedAt: null,
  completedAt: null,
  canceledAt: null,
  reopenedAt: null,
  generalNotes: null,
  createdBy: 'director-1',
  openedBy: null,
  completedBy: null,
  canceledBy: null,
  reopenedBy: null,
  reopenReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function mutation() {
  return { isPending: false, isError: false, error: null, mutateAsync: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ profile: { id: 'director-1', role: 'DIRECTOR', platform_role: 'USER', full_name: 'Diretor', email: 'director@example.com' } } as never);
  vi.mocked(useCurrentInstitution).mockReturnValue({ data: institutionId, currentRole: 'DIRECTOR', isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClassCouncils).mockReturnValue({ data: [council], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClassCouncilContextOptions).mockReturnValue({ data: { years: [{ id: 'year-1', institutionId, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, terms: [{ id: 'term-1', academicYearId: 'year-1', name: '1º bimestre', startDate: '2026-01-01', endDate: '2026-04-30', active: true }] }], classes: [{ id: 'class-1', academicYearId: 'year-1', name: '1º ano A', gradeLevel: '1º ano', shift: 'MATUTINO' }] }, isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClassCouncilEligibleParticipants).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClassCouncilDetails).mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
  vi.mocked(useAddClassCouncilParticipant).mockReturnValue(mutation() as never);
  vi.mocked(useRemoveClassCouncilParticipant).mockReturnValue(mutation() as never);
  vi.mocked(useCancelClassCouncil).mockReturnValue(mutation() as never);
  vi.mocked(useCompleteClassCouncil).mockReturnValue(mutation() as never);
  vi.mocked(useCreateClassCouncil).mockReturnValue(mutation() as never);
  vi.mocked(useOpenClassCouncil).mockReturnValue(mutation() as never);
  vi.mocked(useReopenClassCouncil).mockReturnValue(mutation() as never);
  vi.mocked(useUpdateClassCouncil).mockReturnValue(mutation() as never);
  vi.mocked(useUpdateClassCouncilStudentNote).mockReturnValue(mutation() as never);
});

afterEach(() => cleanup());

function renderPanel() {
  return render(<QueryClientProvider client={new QueryClient()}><ClassCouncilPanel /></QueryClientProvider>);
}

describe('ClassCouncilPanel', () => {
  it('shows the director workflow and filters councils by academic context', () => {
    renderPanel();
    expect(screen.getByText('Conselhos de classe')).toBeTruthy();
    expect(screen.getByRole('button', { name: /novo conselho/i })).toBeTruthy();
    expect(screen.getAllByText('1º ano A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rascunho').length).toBeGreaterThan(0);
  });

  it('does not expose lifecycle creation to the secretary', () => {
    vi.mocked(useAuth).mockReturnValue({ profile: { id: 'secretary-1', role: 'SECRETARY', platform_role: 'USER', full_name: 'Secretaria', email: 'secretary@example.com' } } as never);
    vi.mocked(useCurrentInstitution).mockReturnValue({ data: institutionId, currentRole: 'SECRETARY', isLoading: false, isError: false, error: null } as never);
    renderPanel();
    expect(screen.queryByRole('button', { name: /novo conselho/i })).toBeNull();
  });

  it('lets the secretary manage participants without exposing lifecycle actions', async () => {
    const addMutation = mutation();
    const removeMutation = mutation();
    const refetch = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ profile: { id: 'secretary-1', role: 'SECRETARY', platform_role: 'USER', full_name: 'Secretaria', email: 'secretary@example.com' } } as never);
    vi.mocked(useCurrentInstitution).mockReturnValue({ data: institutionId, currentRole: 'SECRETARY', isLoading: false, isError: false, error: null } as never);
    vi.mocked(useClassCouncilDetails).mockReturnValue({ data: { council, participants: [{ id: 'participant-1', institutionId, councilId: council.id, profileId: 'director-1', participantRole: 'DIRECTOR', profileName: 'Diretor', profileEmail: 'director@example.com', createdAt: '2026-01-01T00:00:00Z' }], studentNotes: [] }, isLoading: false, isError: false, error: null, refetch } as never);
    vi.mocked(useClassCouncilEligibleParticipants).mockReturnValue({ data: [{ profileId: 'teacher-1', profileName: 'Professor', profileEmail: 'teacher@example.com', role: 'TEACHER' }], isLoading: false, isError: false, error: null } as never);
    vi.mocked(useAddClassCouncilParticipant).mockReturnValue(addMutation as never);
    vi.mocked(useRemoveClassCouncilParticipant).mockReturnValue(removeMutation as never);

    renderPanel();

    expect(screen.queryByRole('button', { name: /novo conselho/i })).toBeNull();
    expect(screen.getByText('Participantes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover Diretor' })).toBeTruthy();
    expect(useClassCouncilEligibleParticipants).toHaveBeenCalledWith(institutionId, 'class-1', 'term-1');

    fireEvent.change(screen.getByRole('combobox', { name: 'Novo participante' }), { target: { value: 'teacher-1|TEACHER' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }));
    await waitFor(() => expect(addMutation.mutateAsync).toHaveBeenCalledWith({ councilId: council.id, profileId: 'teacher-1', role: 'TEACHER' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remover Diretor' }));
    await waitFor(() => expect(removeMutation.mutateAsync).toHaveBeenCalledWith({ participantId: 'participant-1', councilId: council.id }));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows participant management to the director and hides it after completion', () => {
    vi.mocked(useClassCouncilDetails).mockReturnValue({ data: { council, participants: [{ id: 'participant-1', institutionId, councilId: council.id, profileId: 'teacher-1', participantRole: 'TEACHER', profileName: 'Professor', profileEmail: 'teacher@example.com', createdAt: '2026-01-01T00:00:00Z' }], studentNotes: [] }, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderPanel();
    expect(screen.getByRole('button', { name: 'Remover Professor' })).toBeTruthy();

    const completedCouncil = { ...council, status: 'COMPLETED' as const };
    vi.mocked(useClassCouncilDetails).mockReturnValue({ data: { council: completedCouncil, participants: [{ id: 'participant-1', institutionId, councilId: council.id, profileId: 'teacher-1', participantRole: 'TEACHER', profileName: 'Professor', profileEmail: 'teacher@example.com', createdAt: '2026-01-01T00:00:00Z' }], studentNotes: [] }, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
    cleanup();
    renderPanel();
    expect(screen.queryByRole('button', { name: /remover/i })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Novo participante' })).toBeNull();
  });
});
