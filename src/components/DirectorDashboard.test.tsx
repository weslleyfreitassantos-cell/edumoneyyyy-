// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useAdminOverview } from '../hooks/useAdminOverview';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import DirectorDashboard from './DirectorDashboard';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: vi.fn() }));
vi.mock('../hooks/useAdminOverview', () => ({ useAdminOverview: vi.fn() }));
vi.mock('./attendance/InstitutionAttendancePanel', () => ({
  default: ({ institutionId }: { institutionId: string }) => (
    <div data-testid="director-attendance-panel">{institutionId}</div>
  ),
}));
vi.mock('./grades/InstitutionGradesPanel', () => ({
  default: ({ institutionId }: { institutionId: string }) => (
    <div data-testid="director-grades-panel">{institutionId}</div>
  ),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseCurrentInstitution = vi.mocked(useCurrentInstitution);
const mockUseAdminOverview = vi.mocked(useAdminOverview);
const institutionId = 'institution-director-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    profile: {
      id: 'director-profile-1',
      full_name: 'Diretora Teste',
      email: 'diretora@example.com',
      avatar_url: null,
      role: 'DIRECTOR',
      platform_role: 'USER',
    },
  } as never);
  mockUseCurrentInstitution.mockReturnValue({
    data: institutionId,
    currentRole: 'DIRECTOR',
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    refetch: vi.fn(),
  } as never);
  mockUseAdminOverview.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
});

afterEach(() => cleanup());

describe('DirectorDashboard loading', () => {
  it('shows the dashboard shell and mounts independent panels while metrics load', () => {
    render(<DirectorDashboard />);

    expect(screen.getByRole('heading', { name: 'Painel da direção' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Carregando dados acadêmicos' })).toBeTruthy();
    expect(screen.getByTestId('director-attendance-panel').textContent).toBe(institutionId);
    expect(screen.getByTestId('director-grades-panel').textContent).toBe(institutionId);
  });

  it('shows the profile role title before institution resolution completes', () => {
    mockUseCurrentInstitution.mockReturnValue({
      data: null,
      currentRole: null,
      isLoading: true,
      isError: false,
      error: null,
      message: null,
      refetch: vi.fn(),
    } as never);

    render(<DirectorDashboard />);

    expect(screen.getByRole('heading', { name: 'Painel da direção' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Carregando dados acadêmicos' })).toBeTruthy();
    expect(screen.queryByTestId('director-attendance-panel')).toBeNull();
  });
});
