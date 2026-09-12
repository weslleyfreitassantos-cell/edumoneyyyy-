import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {},
}));

import {
  classifyPedagogicalRisk,
} from './pedagogicalMonitoringService';

describe('pedagogicalMonitoringService', () => {
  it('classifica como normal quando não há sinais', () => {
    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 0,
        lowAttendanceSubjects: 0,
        pendingItems: 0,
        policyConfigured: true,
      }),
    ).toEqual({
      level: 'NORMAL',
      reasons: [],
    });
  });

  it('explica atenção por pendência e criticidade por sinais combinados', () => {
    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 0,
        lowAttendanceSubjects: 0,
        pendingItems: 1,
        policyConfigured: true,
      }),
    ).toMatchObject({
      level: 'ATTENTION',
      reasons: ['1 pendência(s) acadêmica(s).'],
    });

    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 1,
        lowAttendanceSubjects: 1,
        pendingItems: 0,
        policyConfigured: true,
      }),
    ).toMatchObject({
      level: 'CRITICAL',
      reasons: [
        '1 disciplina(s) abaixo da média.',
        '1 disciplina(s) com frequência baixa.',
      ],
    });
  });

  it('sinaliza política ausente sem inventar um limite acadêmico', () => {
    expect(
      classifyPedagogicalRisk({
        lowPerformanceSubjects: 0,
        lowAttendanceSubjects: 0,
        pendingItems: 0,
        policyConfigured: false,
      }),
    ).toEqual({
      level: 'ATTENTION',
      reasons: ['Política acadêmica ainda não configurada.'],
    });
  });
});
