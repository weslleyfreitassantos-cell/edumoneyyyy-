import { describe, expect, it, vi } from 'vitest';

import {
  invalidateSchoolSetupReadiness,
  schoolSetupKeys,
} from './useSchoolSetupReadiness';

describe('school setup readiness query', () => {
  it('invalida a configuração da instituição após um salvamento', async () => {
    const queryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    };

    await invalidateSchoolSetupReadiness(
      queryClient as never,
      'institution-1',
    );

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: schoolSetupKeys.detail('institution-1'),
    });
  });
});
