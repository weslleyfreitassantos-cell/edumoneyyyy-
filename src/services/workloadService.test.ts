import { describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  normalizeWorkloadProgress,
  workloadService,
} from './workloadService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const row = {
  subject_offering_id: 'offering-1',
  term_start_date: '2026-02-01',
  term_end_date: '2026-04-30',
  reference_date: '2026-03-01',
  planned_occurrences: '10',
  planned_occurrences_to_date: '5',
  suspended_occurrences: '1',
  delivered_sessions: '7',
  planned_minutes: '450',
  planned_minutes_to_date: '250',
  delivered_minutes: '350',
  completion_percent: '77.78',
  delivery_vs_plan_to_date_percent: '140',
};

describe('workloadService', () => {
  it('normaliza o read model server-side sem usar subjects.workload', () => {
    expect(normalizeWorkloadProgress(row)).toEqual({
      subjectOfferingId: 'offering-1',
      termStartDate: '2026-02-01',
      termEndDate: '2026-04-30',
      referenceDate: '2026-03-01',
      plannedOccurrences: 10,
      plannedOccurrencesToDate: 5,
      suspendedOccurrences: 1,
      deliveredSessions: 7,
      plannedMinutes: 450,
      plannedMinutesToDate: 250,
      deliveredMinutes: 350,
      completionPercent: 77.78,
      deliveryVsPlanToDatePercent: 140,
    });
  });

  it('preserva percentuais nulos quando não há denominador', () => {
    expect(normalizeWorkloadProgress({
      ...row,
      planned_minutes: 0,
      planned_minutes_to_date: 0,
      completion_percent: null,
      delivery_vs_plan_to_date_percent: null,
    })).toMatchObject({
      plannedMinutes: 0,
      plannedMinutesToDate: 0,
      completionPercent: null,
      deliveryVsPlanToDatePercent: null,
    });
  });

  it('consulta a offering exata com a data de referência civil', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [row],
      error: null,
    } as never);

    const progress = await workloadService.getSubjectOfferingProgress(
      'institution-1',
      'offering-1',
      '2026-03-01',
    );

    expect(progress.subjectOfferingId).toBe('offering-1');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_subject_offering_workload_progress',
      {
        p_institution_id: 'institution-1',
        p_subject_offering_id: 'offering-1',
        p_reference_date: '2026-03-01',
      },
    );
  });
});
