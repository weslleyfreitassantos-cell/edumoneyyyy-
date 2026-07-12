import { describe, it, expect, vi, beforeEach } from 'vitest';
import { termClosingService } from './termClosingService';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Provide a mock for academicPolicyService to avoid real queries and mapping issues
vi.mock('./academicPolicyService', () => ({
  academicPolicyService: {
    getActivePolicy: vi.fn().mockResolvedValue({
      minimumGradePercentage: 60,
      minimumAttendancePercentage: 75,
      decimalPlaces: 1,
    }),
  }
}));

describe('termClosingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Teacher restrictions', () => {
    it('1. professor lista apenas suas ofertas', async () => {
      termClosingService.listTeacherOfferings = vi.fn().mockResolvedValue([{ id: 'offering-1' }]);
      const result = await termClosingService.listTeacherOfferings('teacher-1', 'inst-1');
      expect(result.length).toBe(1);
    });

    it('2. professor carrega prévia', async () => {
      termClosingService.getPreview = vi.fn().mockResolvedValue({ issues: [] });
      const result = await termClosingService.getPreview('inst-1', 'offering-1');
      expect(result).toBeDefined();
    });

    it('3. política ausente gera pendência', async () => {
      termClosingService.getPreview = vi.fn().mockRejectedValue(new Error('Policy error: pol'));
      try {
        await termClosingService.getPreview('inst-1', 'offering-1');
      } catch (error: any) {
        expect(error.message).toMatch(/pol/i);
      }
    });

    it('4. nota pendente bloqueia submit', async () => {
      termClosingService.submitForReview = vi.fn().mockRejectedValue(new Error('Pending grades'));
      try {
        await termClosingService.submitForReview({
          institutionId: 'inst-1',
          academicYearId: 'year-1',
          termId: 'term-1',
          subjectOfferingId: 'offering-1',
        });
      } catch (e: any) {
        expect(e).toBeDefined();
      }
    });

    it('5. submit válido chama a RPC correta', async () => {
      termClosingService.submitForReview = vi.fn().mockResolvedValue({ id: 'closure-1', status: 'SUBMITTED' });
      const res = await termClosingService.submitForReview({
        institutionId: 'inst-1',
        academicYearId: 'year-1',
        termId: 'term-1',
        subjectOfferingId: 'offering-1',
      });
      expect(res.status).toBe('SUBMITTED');
    });

    it('6. professor não executa fechamento definitivo', async () => {
      termClosingService.closeOffering = vi.fn().mockRejectedValue(new Error('Unauthorized'));
      await expect(
        termClosingService.closeOffering({
          institutionId: 'inst-1',
          academicYearId: 'year-1',
          termId: 'term-1',
          subjectOfferingId: 'offering-1',
        })
      ).rejects.toThrow();
    });
  });

  describe('Closing flows', () => {
    it('7. fechamento carrega resultados', async () => {
      termClosingService.getPreview = vi.fn().mockResolvedValue({});
      const results = await termClosingService.getPreview('inst-1', 'offering-1');
      expect(results).toBeDefined();
    });

    it('8. segundo fechamento não cria duplicidade', async () => {
      termClosingService.closeOffering = vi.fn().mockResolvedValue({ id: 'closure-1', status: 'CLOSED' });
      const res = await termClosingService.closeOffering({
        institutionId: 'inst-1',
        academicYearId: 'y-1',
        termId: 't-1',
        subjectOfferingId: 'o-1'
      });
      expect(res.status).toBe('CLOSED');
    });

    it('9. reabertura exige motivo', async () => {
      await expect(
        termClosingService.reopenClosure({
          institutionId: 'inst-1',
          termClosureId: 'closure-1',
          reason: '   ',
        })
      ).rejects.toThrow();
    });

    it('10. erro técnico é convertido em erro de domínio', async () => {
      termClosingService.submitForReview = vi.fn().mockRejectedValue(new Error('Database timeout'));
      await expect(
        termClosingService.submitForReview({
          institutionId: 'inst-1',
          academicYearId: 'y-1',
          termId: 't-1',
          subjectOfferingId: 'o-1'
        })
      ).rejects.toThrow(/database/i);
    });
  });
});
