import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: mocks.rpc },
}));

import { adaptiveLearningService } from './adaptiveLearningService';

describe('adaptiveLearningService', () => {
  it('maps teacher insight RPC columns explicitly to the UI model', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        canonical_skill_id: 'skill-1',
        skill_code: 'LINEAR_FUNCTION',
        skill_title: 'Função afim',
        state: 'NEEDS_REVIEW',
        student_count: 4,
        diagnostic_needed_count: 3,
      }],
      error: null,
    });

    const result = await adaptiveLearningService.teacherInsights('institution-1');

    expect(result).toEqual([{
      canonicalSkillId: 'skill-1',
      skillCode: 'LINEAR_FUNCTION',
      skillTitle: 'Função afim',
      state: 'NEEDS_REVIEW',
      studentCount: 4,
      diagnosticNeededCount: 3,
    }]);
    expect(Object.values(result[0] ?? {}).every((value) => value !== undefined)).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('get_teacher_adaptive_insights', {
      p_institution_id: 'institution-1',
    });
  });
});
