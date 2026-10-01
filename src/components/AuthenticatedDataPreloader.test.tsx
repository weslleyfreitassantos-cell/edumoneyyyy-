// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { adminOverviewService } from '../services/adminOverviewService';
import { announcementService } from '../services/announcementService';
import { cameraService } from '../services/cameraService';
import { schoolEmailService } from '../services/schoolEmailService';
import AuthenticatedDataPreloader from './AuthenticatedDataPreloader';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/InstitutionContext', () => ({ useInstitution: vi.fn() }));
vi.mock('../services/adminOverviewService', () => ({
  adminOverviewService: { getOverview: vi.fn() },
}));
vi.mock('../services/announcementService', () => ({
  announcementService: { listForStaff: vi.fn() },
}));
vi.mock('../services/cameraService', () => ({
  cameraService: { list: vi.fn(), listGateways: vi.fn() },
}));
vi.mock('../services/schoolEmailService', () => ({
  schoolEmailService: {
    getCachedRecipients: vi.fn(),
    listRecipients: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution = vi.mocked(useInstitution);

function renderPreloader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthenticatedDataPreloader />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    profile: {
      id: 'profile-1',
      full_name: 'Usuário de teste',
      email: 'test@example.com',
      role: 'SECRETARY',
      platform_role: 'USER',
      avatar_url: null,
      phone: null,
    },
  } as never);
  mockedUseInstitution.mockReturnValue({
    currentInstitutionId: 'institution-1',
    currentRole: 'SECRETARY',
    isLoading: false,
  } as never);
  vi.mocked(adminOverviewService.getOverview).mockResolvedValue({} as never);
  vi.mocked(announcementService.listForStaff).mockResolvedValue([]);
  vi.mocked(cameraService.list).mockResolvedValue([]);
  vi.mocked(cameraService.listGateways).mockResolvedValue([]);
  vi.mocked(schoolEmailService.getCachedRecipients).mockReturnValue([]);
  vi.mocked(schoolEmailService.listRecipients).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('AuthenticatedDataPreloader', () => {
  it('does not prefetch director-only camera RPCs for SECRETARY', async () => {
    renderPreloader();

    await waitFor(() => {
      expect(announcementService.listForStaff).toHaveBeenCalledWith('institution-1');
    });

    expect(cameraService.list).not.toHaveBeenCalled();
    expect(cameraService.listGateways).not.toHaveBeenCalled();
  });

  it('prefetches camera data for an authorized DIRECTOR', async () => {
    mockedUseAuth.mockReturnValue({
      profile: {
        id: 'profile-1',
        full_name: 'Diretor de teste',
        email: 'director@example.com',
        role: 'DIRECTOR',
        platform_role: 'USER',
        avatar_url: null,
        phone: null,
      },
    } as never);
    mockedUseInstitution.mockReturnValue({
      currentInstitutionId: 'institution-1',
      currentRole: 'DIRECTOR',
      isLoading: false,
    } as never);

    renderPreloader();

    await waitFor(() => {
      expect(cameraService.list).toHaveBeenCalledWith('institution-1');
      expect(cameraService.listGateways).toHaveBeenCalledWith('institution-1');
    });
  });
});
