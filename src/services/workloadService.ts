import { supabase } from '../lib/supabaseClient';

export interface SubjectOfferingWorkloadProgress {
  subjectOfferingId: string;
  termStartDate: string;
  termEndDate: string;
  referenceDate: string;
  plannedOccurrences: number;
  plannedOccurrencesToDate: number;
  suspendedOccurrences: number;
  deliveredSessions: number;
  plannedMinutes: number;
  plannedMinutesToDate: number;
  deliveredMinutes: number;
  completionPercent: number | null;
  deliveryVsPlanToDatePercent: number | null;
}

interface WorkloadProgressQueryRow {
  subject_offering_id: string;
  term_start_date: string;
  term_end_date: string;
  reference_date: string;
  planned_occurrences: number | string;
  planned_occurrences_to_date: number | string;
  suspended_occurrences: number | string;
  delivered_sessions: number | string;
  planned_minutes: number | string;
  planned_minutes_to_date: number | string;
  delivered_minutes: number | string;
  completion_percent: number | string | null;
  delivery_vs_plan_to_date_percent: number | string | null;
}

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function toNullableNumber(
  value: number | string | null,
): number | null {
  return value === null ? null : toNumber(value);
}

export function normalizeWorkloadProgress(
  row: WorkloadProgressQueryRow,
): SubjectOfferingWorkloadProgress {
  return {
    subjectOfferingId: row.subject_offering_id,
    termStartDate: row.term_start_date,
    termEndDate: row.term_end_date,
    referenceDate: row.reference_date,
    plannedOccurrences: toNumber(row.planned_occurrences),
    plannedOccurrencesToDate: toNumber(
      row.planned_occurrences_to_date,
    ),
    suspendedOccurrences: toNumber(row.suspended_occurrences),
    deliveredSessions: toNumber(row.delivered_sessions),
    plannedMinutes: toNumber(row.planned_minutes),
    plannedMinutesToDate: toNumber(
      row.planned_minutes_to_date,
    ),
    deliveredMinutes: toNumber(row.delivered_minutes),
    completionPercent: toNullableNumber(
      row.completion_percent,
    ),
    deliveryVsPlanToDatePercent: toNullableNumber(
      row.delivery_vs_plan_to_date_percent,
    ),
  };
}

export const workloadService = {
  async getSubjectOfferingProgress(
    institutionId: string,
    subjectOfferingId: string,
    referenceDate?: string,
  ): Promise<SubjectOfferingWorkloadProgress> {
    const { data, error } = await supabase.rpc(
      'get_subject_offering_workload_progress',
      {
        p_institution_id: institutionId,
        p_subject_offering_id: subjectOfferingId,
        ...(referenceDate
          ? { p_reference_date: referenceDate }
          : {}),
      },
    );

    if (error) {
      throw error;
    }

    const row = ((data ?? []) as unknown as WorkloadProgressQueryRow[])[0];

    if (!row) {
      throw new Error(
        'Não foi possível carregar o progresso da carga horária.',
      );
    }

    return normalizeWorkloadProgress(row);
  },
};
