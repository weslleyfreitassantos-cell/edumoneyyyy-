import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
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

  it('carrega o ano e o período letivos no caminho rápido da RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        active_students: 12,
        active_classes: 3,
      },
      error: null,
    });

    const year = {
      id: 'year-2026',
      name: '2026',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      active: true,
    };
    const term = {
      id: 'term-1',
      name: '1º Bimestre',
      academic_year_id: year.id,
      start_date: '2026-01-01',
      end_date: '2026-04-30',
      active: true,
    };

    const makeQuery = (data: unknown[]) => {
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order']) {
        query[method] = vi.fn(() => query);
      }
      query.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve);
      return query;
    };

    mocks.from
      .mockReturnValueOnce(makeQuery([year]))
      .mockReturnValueOnce(makeQuery([term]));

    const overview = await adminOverviewService.getOverview('institution-a');

    expect(overview.currentAcademicYear).toEqual(year);
    expect(overview.currentTerm).toEqual(term);
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'academic_years');
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'terms');
  });
});
