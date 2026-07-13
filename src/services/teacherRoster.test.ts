import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabaseClient';
import { teacherDashboardService } from './teacherDashboardService';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Teacher Roster Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard Service using RPC', () => {
    it('should group offerings by effective date and make a single RPC call', async () => {
      // Mock subject_offerings response with two offerings in the same term
      const mockOfferings = {
        data: [
          {
            id: 'offering-1',
            class_id: 'class-1',
            subject_id: 'subject-1',
            teacher_profile_id: 'teacher-1',
            term_id: 'term-1',
            active: true,
            created_at: '2026-01-01',
            classes: { id: 'class-1', name: 'Class 1', institution_id: 'inst-1', active: true },
            subjects: { id: 'subject-1', name: 'Subject 1', institution_id: 'inst-1', active: true },
            terms: { id: 'term-1', start_date: '2026-07-17', end_date: '2026-12-30', active: true },
          },
          {
            id: 'offering-2',
            class_id: 'class-2',
            subject_id: 'subject-2',
            teacher_profile_id: 'teacher-1',
            term_id: 'term-1',
            active: true,
            created_at: '2026-01-01',
            classes: { id: 'class-2', name: 'Class 2', institution_id: 'inst-1', active: true },
            subjects: { id: 'subject-2', name: 'Subject 2', institution_id: 'inst-1', active: true },
            terms: { id: 'term-1', start_date: '2026-07-17', end_date: '2026-12-30', active: true },
          },
        ],
        error: null,
      };

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockOfferings),
      };
      (supabase.from as any).mockReturnValue(mockQueryBuilder);

      (supabase.rpc as any).mockResolvedValue({
        data: [
          { offering_id: 'offering-1', student_id: 'student-1' },
          { offering_id: 'offering-2', student_id: 'student-2' },
        ],
        error: null,
      });

      const result = await teacherDashboardService.getDashboard('teacher-1', 'inst-1');

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      const callArgs = (supabase.rpc as any).mock.calls[0];
      expect(callArgs[0]).toBe('get_teacher_offering_rosters');
      expect(callArgs[1].target_offering_ids).toEqual(['offering-1', 'offering-2']);
      expect(result.totals.students).toBe(2);
    });

    it('should handle offerings in different periods by grouping them properly', async () => {
      const mockOfferings = {
        data: [
          {
            id: 'offering-1',
            class_id: 'class-1',
            subject_id: 'subject-1',
            teacher_profile_id: 'teacher-1',
            term_id: 'term-1',
            active: true,
            created_at: '2026-01-01',
            classes: { id: 'class-1', name: 'Class 1', institution_id: 'inst-1', active: true },
            subjects: { id: 'subject-1', name: 'Subject 1', institution_id: 'inst-1', active: true },
            terms: { id: 'term-1', start_date: '2026-07-17', end_date: '2026-12-30', active: true },
          },
          {
            id: 'offering-3',
            class_id: 'class-3',
            subject_id: 'subject-3',
            teacher_profile_id: 'teacher-1',
            term_id: 'term-2',
            active: true,
            created_at: '2026-01-01',
            classes: { id: 'class-3', name: 'Class 3', institution_id: 'inst-1', active: true },
            subjects: { id: 'subject-3', name: 'Subject 3', institution_id: 'inst-1', active: true },
            terms: { id: 'term-2', start_date: '2027-01-01', end_date: '2027-06-30', active: true },
          },
        ],
        error: null,
      };

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockOfferings),
      };
      (supabase.from as any).mockReturnValue(mockQueryBuilder);

      (supabase.rpc as any).mockResolvedValue({
        data: [],
        error: null,
      });

      await teacherDashboardService.getDashboard('teacher-1', 'inst-1');
      
      // Should group by effective date. Since term-1 and term-2 have different dates, there should be 2 RPC calls.
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should not mask RPC errors as 0 students', async () => {
      const mockOfferings = {
        data: [
          {
            id: 'offering-1',
            class_id: 'class-1',
            subject_id: 'subject-1',
            teacher_profile_id: 'teacher-1',
            term_id: 'term-1',
            active: true,
            created_at: '2026-01-01',
            classes: { id: 'class-1', name: 'Class 1', institution_id: 'inst-1', active: true },
            subjects: { id: 'subject-1', name: 'Subject 1', institution_id: 'inst-1', active: true },
            terms: { id: 'term-1', start_date: '2026-07-17', end_date: '2026-12-30', active: true },
          },
        ],
        error: null,
      };

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockOfferings),
      };
      (supabase.from as any).mockReturnValue(mockQueryBuilder);

      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: new Error('Acesso negado'),
      });

      const result = await teacherDashboardService.getDashboard('teacher-1', 'inst-1');
      
      expect(result.enrollmentAccessAvailable).toBe(false);
      expect(result.totals.students).toBeNull();
      expect(result.offerings[0].studentCount).toBeNull();
    });
  });

  describe('Static Migration Analysis', () => {
    it('should contain all required security rules', () => {
      const migrationFile = path.resolve(__dirname, '../../supabase/migrations/20260713000100_teacher_roster_rpc.sql');
      const sql = fs.readFileSync(migrationFile, 'utf8');

      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain("SET search_path = ''");
      expect(sql).toContain('auth.uid()');
      
      // Objects qualified with public.
      expect(sql).toMatch(/public\.get_teacher_offering_rosters/);
      expect(sql).toMatch(/public\.subject_offerings/);
      expect(sql).toMatch(/public\.classes/);
      expect(sql).toMatch(/public\.enrollments/);
      expect(sql).toMatch(/public\.students/);
      
      // Email must not be in RETURNS TABLE
      const returnsTableMatch = sql.match(/RETURNS TABLE \([^)]+\)/);
      expect(returnsTableMatch).toBeTruthy();
      expect(returnsTableMatch![0]).not.toContain('email');
      
      // Membership TEACHER check
      expect(sql).toContain("role = 'TEACHER'");
      expect(sql).toContain("m.active = true");
      
      // Revoke and Grant
      expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.get_teacher_offering_rosters.* FROM public, anon;/);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_teacher_offering_rosters.* TO authenticated, service_role;/);
    });
  });
});
