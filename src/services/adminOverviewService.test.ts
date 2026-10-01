import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

import {
  adminOverviewService,
  isMissingAdminOverviewRpcError,
} from './adminOverviewService';

const legacyOverview = {
  metrics: {
    activeStudents: 1,
    inactiveStudents: 0,
    activeTeachers: 1,
    activeGuardians: 1,
    activeClasses: 1,
    activeSubjects: 1,
    activeEnrollments: 1,
    activeAssignments: 1,
    activeCurriculumItems: 1,
    curriculumItemsNeedingReview: 0,
  },
  currentAcademicYear: null,
  currentTerm: null,
  warnings: [],
};

describe('adminOverviewService RPC fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconhece somente erros de função ausente como compatibilidade', () => {
    expect(isMissingAdminOverviewRpcError({ code: 'PGRST202' })).toBe(true);
    expect(isMissingAdminOverviewRpcError({ code: '42883' })).toBe(true);
    expect(isMissingAdminOverviewRpcError({ code: '57014' })).toBe(false);
    expect(isMissingAdminOverviewRpcError({ code: '42501' })).toBe(false);
  });

  it('não dispara fallback pesado em erro transitório da RPC', async () => {
    const error = { code: '57014', message: 'statement timeout' };
    mocks.rpc.mockResolvedValue({ data: null, error });
    const legacy = vi
      .spyOn(adminOverviewService, 'getOverviewLegacy')
      .mockResolvedValue(legacyOverview);

    await expect(
      adminOverviewService.getOverview('institution-a'),
    ).rejects.toBe(error);
    expect(legacy).not.toHaveBeenCalled();
  });

  it('mantém fallback somente quando a função ainda não existe', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'function not found' },
    });
    const legacy = vi
      .spyOn(adminOverviewService, 'getOverviewLegacy')
      .mockResolvedValue(legacyOverview);

    await expect(
      adminOverviewService.getOverview('institution-a'),
    ).resolves.toEqual(legacyOverview);
    expect(legacy).toHaveBeenCalledWith('institution-a');
  });
});
