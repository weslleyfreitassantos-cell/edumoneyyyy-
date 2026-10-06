import { supabase } from '../lib/supabaseClient';

export interface DirectorPanoramaFilters {
  fromDate: string;
  toDate: string;
  classId?: string;
  termId?: string;
  academicYearId?: string;
}

export interface DirectorPanoramaAttendanceSummary {
  totalRecords: number;
  presentRecords: number;
  absentRecords: number;
  lateRecords: number;
  excusedRecords: number;
  attendanceRate: number;
}

export interface DirectorPanoramaAttendancePoint {
  key: string;
  label: string;
  attendanceRate: number;
  totalRecords: number;
}

export interface DirectorPanoramaGradeSummary {
  totalAssessments: number;
  gradedCount: number;
  pendingCount: number;
  excusedCount: number;
  averageScore: number | null;
  averagePercent: number | null;
  weightedAveragePercent: number | null;
}

export interface DirectorPanoramaActivityPerformance {
  totalActivities: number;
  aboveTarget: number;
  attention: number;
  critical: number;
  withoutAverage: number;
  launchedActivities: number;
  pendingGrades: number;
}

export type DirectorPanoramaStudentSituation =
  | 'REGULAR'
  | 'ATTENTION'
  | 'CRITICAL'
  | 'NO_DATA';

export interface DirectorPanoramaStudentSituationSummary {
  situation: DirectorPanoramaStudentSituation;
  count: number;
}

export interface DirectorPanoramaClassPerformance {
  classId: string;
  className: string;
  adequate: number;
  attention: number;
  critical: number;
  total: number;
  withoutPerformance: number;
}

export interface DirectorPanoramaResult {
  attendance: {
    summary: DirectorPanoramaAttendanceSummary;
    weekly: DirectorPanoramaAttendancePoint[];
  };
  performance: {
    summary: DirectorPanoramaGradeSummary;
    activities: DirectorPanoramaActivityPerformance;
  };
  students: {
    situations: DirectorPanoramaStudentSituationSummary[];
  };
  classes: DirectorPanoramaClassPerformance[];
  pending: {
    attendancePending: number;
    missingGrades: number;
    assessmentsWithoutLaunch: number;
  };
}

export class DirectorPanoramaServiceError extends Error {
  readonly originalError: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'DirectorPanoramaServiceError';
    this.originalError = originalError;
  }
}

function formatWeekLabel(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '');
}

function withWeekLabels(
  result: DirectorPanoramaResult,
): DirectorPanoramaResult {
  return {
    ...result,
    attendance: {
      ...result.attendance,
      weekly: result.attendance.weekly.map((point) => ({
        ...point,
        label: point.label || formatWeekLabel(point.key),
      })),
    },
  };
}

export const directorPanoramaService = {
  async get(
    institutionId: string,
    filters: DirectorPanoramaFilters,
  ): Promise<DirectorPanoramaResult> {
    if (!institutionId || !filters.fromDate || !filters.toDate) {
      throw new DirectorPanoramaServiceError(
        'Instituição e intervalo de datas são obrigatórios para carregar o panorama.',
      );
    }

    if (filters.fromDate > filters.toDate) {
      throw new DirectorPanoramaServiceError(
        'O início do período não pode ser posterior ao fim do período.',
      );
    }

    const { data, error } = await supabase.rpc(
      'get_director_academic_panorama_v1',
      {
        p_institution_id: institutionId,
        p_from_date: filters.fromDate,
        p_to_date: filters.toDate,
        p_class_id: filters.classId ?? null,
        p_term_id: filters.termId ?? null,
        p_academic_year_id: filters.academicYearId ?? null,
      },
    );

    if (error) {
      throw new DirectorPanoramaServiceError(
        'Não foi possível carregar o panorama acadêmico.',
        error,
      );
    }

    if (!data || typeof data !== 'object') {
      throw new DirectorPanoramaServiceError(
        'O panorama acadêmico retornou um formato inválido.',
      );
    }

    return withWeekLabels(data as unknown as DirectorPanoramaResult);
  },
};
