import { describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabaseClient';
import { institutionService } from './institutionService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('institutionService', () => {
  it('combina ownership e memberships com deduplicacao, ignorando contas suspensas, e mantem limite e effectiveRole', async () => {
    const mockSelectAccount = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'acc-1',
            name: 'Conta 1',
            status: 'ACTIVE',
            institution_limit: 5,
            institutions: [
              {
                id: 'inst-1',
                name: 'Instituicao 1',
                active: true,
                account_id: 'acc-1',
              },
            ],
          },
          {
            id: 'acc-2',
            name: 'Conta Suspensa',
            status: 'SUSPENDED',
            institution_limit: 2,
            institutions: [
              {
                id: 'inst-2',
                name: 'Instituicao 2',
                active: true,
                account_id: 'acc-2',
              },
            ],
          },
        ],
        error: null,
      }),
    });

    const mockSelectMembership = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'mem-1',
                institution_id: 'inst-1', // deduplicacao esperada
                role: 'DIRECTOR',
                active: true,
                institutions: {
                  id: 'inst-1',
                  name: 'Instituicao 1',
                  active: true,
                  account_id: 'acc-1',
                },
              },
              {
                id: 'mem-2',
                institution_id: 'inst-3',
                role: 'SECRETARY',
                active: true,
                institutions: {
                  id: 'inst-3',
                  name: 'Instituicao 3',
                  active: true,
                  account_id: 'acc-1',
                },
              },
              {
                id: 'mem-3',
                institution_id: 'inst-4',
                role: 'ADMIN',
                active: true,
                institutions: {
                  id: 'inst-4',
                  name: 'Legacy Inst',
                  active: true,
                  account_id: null, // Legado aceito
                },
              },
              {
                id: 'mem-4',
                institution_id: 'inst-5',
                role: 'ADMIN',
                active: true,
                institutions: {
                  id: 'inst-5',
                  name: 'Invalid Legacy Inst',
                  active: true,
                  account_id: 'some-account', // Legado rejeitado
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'accounts') return { select: mockSelectAccount } as any;
      if (table === 'memberships') return { select: mockSelectMembership } as any;
      return {} as any;
    });

    const result = await institutionService.listForProfile('user-1');

    // Expected 3 institutions:
    // 1. inst-1 (from account_owner, deducts from membership since it's deduplicated and added first)
    // 2. inst-3 (from membership SECRETARY)
    // 3. inst-4 (from legacy ADMIN membership)
    // inst-2 is ignored because account is SUSPENDED
    // inst-5 is ignored because ADMIN membership with account_id is not allowed

    expect(result).toHaveLength(3);

    const inst1 = result.find((r) => r.institution.id === 'inst-1');
    expect(inst1?.accessSource).toBe('account_owner');
    expect(inst1?.effectiveRole).toBe('ADMIN');
    expect(inst1?.account?.institution_limit).toBe(5);

    const inst3 = result.find((r) => r.institution.id === 'inst-3');
    expect(inst3?.accessSource).toBe('membership');
    expect(inst3?.effectiveRole).toBe('SECRETARY');

    const inst4 = result.find((r) => r.institution.id === 'inst-4');
    expect(inst4?.accessSource).toBe('legacy_admin_membership');
    expect(inst4?.effectiveRole).toBe('ADMIN');
  });
});
