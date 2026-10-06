import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

import { directorPanoramaService } from './directorPanoramaService';

const panorama = {
  attendance: {
    summary: {
      totalRecords: 10,
      presentRecords: 9,
      absentRecords: 1,
      lateRecords: 1,
      excusedRecords: 0,
      attendanceRate: 90,
    },
    weekly: [{ key: '2026-08-03', label: '', attendanceRate: 90, totalRecords: 10 }],
  },
  performance: {
    summary: {
      totalAssessments: 1,
      gradedCount: 1,
      pendingCount: 0,
      excusedCount: 0,
      averageScore: 8,
      averagePercent: 80,
      weightedAveragePercent: 80,
    },
    activities: {
      totalActivities: 1,
      aboveTarget: 1,
      attention: 0,
      critical: 0,
      withoutAverage: 0,
      launchedActivities: 1,
      pendingGrades: 0,
    },
  },
  students: {
    situations: [
      { situation: 'REGULAR', count: 1 },
      { situation: 'ATTENTION', count: 0 },
      { situation: 'CRITICAL', count: 0 },
      { situation: 'NO_DATA', count: 0 },
    ],
  },
  classes: [],
  pending: {
    attendancePending: 0,
    missingGrades: 0,
    assessmentsWithoutLaunch: 0,
  },
};

describe('directorPanoramaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta a agregação única com todos os filtros do panorama', async () => {
    mocks.rpc.mockResolvedValue({ data: panorama, error: null });

    const result = await directorPanoramaService.get('institution-1', {
      fromDate: '2026-08-03',
      toDate: '2026-10-02',
      classId: 'class-1',
      termId: 'term-3',
      academicYearId: 'year-2026',
    });

    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('get_director_academic_panorama_v1', {
      p_institution_id: 'institution-1',
      p_from_date: '2026-08-03',
      p_to_date: '2026-10-02',
      p_class_id: 'class-1',
      p_term_id: 'term-3',
      p_academic_year_id: 'year-2026',
    });
    expect(result.attendance.weekly[0]?.label).toBe('03 de ago');
  });

  it('não permite intervalo invertido e não dispara uma consulta ampla', async () => {
    await expect(directorPanoramaService.get('institution-1', {
      fromDate: '2026-10-02',
      toDate: '2026-08-03',
    })).rejects.toThrow('posterior');

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('propaga falha da agregação como erro do serviço', async () => {
    const error = { code: '57014', message: 'statement timeout' };
    mocks.rpc.mockResolvedValue({ data: null, error });

    await expect(directorPanoramaService.get('institution-1', {
      fromDate: '2026-08-03',
      toDate: '2026-10-02',
    })).rejects.toMatchObject({
      name: 'DirectorPanoramaServiceError',
      originalError: error,
    });
  });
});
