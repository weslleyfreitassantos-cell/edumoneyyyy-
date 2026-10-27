// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { psychologyService } from '../services/psychologyService';
import { publishPsychologyModuleStatusChanged, usePsychologyModuleStatus } from './usePsychologyModuleStatus';

vi.mock('../services/psychologyService', () => ({
  psychologyService: {
    moduleEnabled: vi.fn(),
    canManageModule: vi.fn(),
  },
}));

const mockService = vi.mocked(psychologyService);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('usePsychologyModuleStatus', () => {
  it('loads the server status and keeps manager configuration available while disabled', async () => {
    mockService.moduleEnabled.mockResolvedValue(false);
    mockService.canManageModule.mockResolvedValue(true);

    const { result } = renderHook(() => usePsychologyModuleStatus('school-a', 'director-a', 'DIRECTOR'));
    await waitFor(() => expect(result.current).toEqual({ state: 'disabled', canManage: true }));
  });

  it('fails closed when the server cannot confirm status', async () => {
    mockService.moduleEnabled.mockRejectedValue(new Error('network unavailable'));
    mockService.canManageModule.mockResolvedValue(false);

    const { result } = renderHook(() => usePsychologyModuleStatus('school-b', 'student-b', 'STUDENT'));
    await waitFor(() => expect(result.current.state).toBe('unknown'));
    expect(result.current.canManage).toBe(false);
  });

  it('updates active tabs immediately when the manager changes module status', async () => {
    mockService.moduleEnabled.mockResolvedValue(false);
    mockService.canManageModule.mockResolvedValue(true);

    const { result } = renderHook(() => usePsychologyModuleStatus('school-c', 'director-c', 'DIRECTOR'));
    await waitFor(() => expect(result.current.state).toBe('disabled'));
    act(() => publishPsychologyModuleStatusChanged('school-c', true));
    expect(result.current.state).toBe('enabled');
  });
});
