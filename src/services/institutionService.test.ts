import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  updateInstitutionSubdomain,
  updateInstitutionBranding,
} from './institutionService';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Institution Service Authorization & Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateInstitutionSubdomain (Operação 1 - ADMIN)', () => {
    it('permite que o ADMIN altere o subdomínio de uma instituição de sua própria conta', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'institutions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'inst-1', name: 'Escola Modelo', account_id: 'acc-1', active: true },
                  error: null,
                }),
                neq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'inst-1',
                      name: 'Escola Modelo',
                      subdomain: 'escolamodelo',
                      account_id: 'acc-1',
                      active: true,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'acc-1' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await updateInstitutionSubdomain({
        institutionId: 'inst-1',
        subdomain: 'escolamodelo',
        profileId: 'admin-profile-1',
        userRole: 'ADMIN',
      });

      expect(result.subdomain).toBe('escolamodelo');
    });

    it('bloqueia o ADMIN de alterar o subdomínio de uma instituição pertencente a outra conta', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'institutions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'inst-other', name: 'Outra Escola', account_id: 'acc-other', active: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // Outra conta que não pertence a admin-profile-1
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(
        updateInstitutionSubdomain({
          institutionId: 'inst-other',
          subdomain: 'outraescola',
          profileId: 'admin-profile-1',
          userRole: 'ADMIN',
        })
      ).rejects.toThrow(/não possui permissão/i);
    });

    it('bloqueia o DIRECTOR de alterar o subdomínio', async () => {
      await expect(
        updateInstitutionSubdomain({
          institutionId: 'inst-1',
          subdomain: 'tentativadiretor',
          profileId: 'director-profile-1',
          userRole: 'DIRECTOR',
        })
      ).rejects.toThrow(/Apenas o administrador da conta/i);
    });
  });

  describe('updateInstitutionBranding (Operação 2 - DIRECTOR)', () => {
    it('permite que o DIRETOR ativo altere logo e cores da sua própria instituição', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { id: 'mem-1', role: 'DIRECTOR', active: true, institution_id: 'inst-1' },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'institutions') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'inst-1',
                      name: 'Escola Modelo',
                      logo_url: 'https://cdn.example.co/logo.png',
                      primary_color: '#005bbf',
                      secondary_color: '#ff9900',
                      active: true,
                      account_id: 'acc-1',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await updateInstitutionBranding({
        institutionId: 'inst-1',
        profileId: 'director-profile-1',
        logo_url: 'https://cdn.example.co/logo.png',
        primary_color: '#005bbf',
        secondary_color: '#ff9900',
      });

      expect(result.logo_url).toBe('https://cdn.example.co/logo.png');
      expect(result.primary_color).toBe('#005bbf');
    });

    it('bloqueia o DIRETOR de alterar a identidade visual de outra instituição sem membership ativa', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: null, // Sem membership nessa escola
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(
        updateInstitutionBranding({
          institutionId: 'inst-outro',
          profileId: 'director-profile-1',
          logo_url: 'https://cdn.example.co/hack.png',
        })
      ).rejects.toThrow(/Apenas um Diretor com membership ativa/i);
    });
  });
});
