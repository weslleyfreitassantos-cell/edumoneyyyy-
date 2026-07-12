import { describe, it, expect, vi, beforeEach } from 'vitest';
import { academicPolicyService } from './academicPolicyService';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('academicPolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActivePolicy', () => {
    it('returns null if none exists', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await academicPolicyService.getActivePolicy('inst-1', 'year-1');
      expect(result).toBeNull();
    });

    it('returns saved policy if it exists', async () => {
      const dbPolicy = {
        id: '1',
        institution_id: 'inst-1',
        academic_year_id: 'year-1',
        minimum_grade_percentage: 70,
        minimum_attendance_percentage: 80,
        decimal_places: 2,
        active: true,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: dbPolicy, error: null }),
            }),
          }),
        }),
      });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await academicPolicyService.getActivePolicy('inst-1', 'year-1');
      expect(result).toEqual({
        id: '1',
        institutionId: 'inst-1',
        academicYearId: 'year-1',
        minimumGradePercentage: 70,
        minimumAttendancePercentage: 80,
        decimalPlaces: 2,
        active: true,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      });
    });
  });

  describe('savePolicy', () => {
    it('throws error if data is invalid', async () => {
      await expect(
        academicPolicyService.savePolicy({
          institutionId: 'inst-1',
          academicYearId: 'year-1',
          minimumGradePercentage: 150, // invalid
          minimumAttendancePercentage: 75,
          decimalPlaces: 1,
        })
      ).rejects.toThrow();
    });
  });
});
