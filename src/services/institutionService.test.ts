import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  updateInstitutionSubdomain,
  updateInstitutionBranding,
  resolveInstitutionBySubdomain,
} from './institutionService';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Institution Service Authorization & Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveInstitutionBySubdomain', () => {
    it('resolve via RPC publica quando disponivel', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            id: 'inst-rpc-1',
            name: 'Escola Luz Publica',
            subdomain: 'escolaluz',
            login_display_name: 'Login Luz',
            logo_url: 'https://cdn.example.com/logo.png',
            favicon_url: 'https://cdn.example.com/favicon.png',
            primary_color: '#005bbf',
            secondary_color: '#6ffbbe',
          },
        ],
        error: null,
      } as never);

      const res = await resolveInstitutionBySubdomain('escolaluz');
      expect(res.error).toBeNull();
      expect(res.institution).toEqual({
        id: 'inst-rpc-1',
        name: 'Escola Luz Publica',
        subdomain: 'escolaluz',
        login_display_name: 'Login Luz',
        logo_url: 'https://cdn.example.com/logo.png',
        favicon_url: 'https://cdn.example.com/favicon.png',
        primary_color: '#005bbf',
        secondary_color: '#6ffbbe',
        active: true,
        account_id: null,
      });
    });

    it('retorna null sem erro quando RPC retorna array vazio', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      const res = await resolveInstitutionBySubdomain('inexistente');
      expect(res.institution).toBeNull();
      expect(res.error).toBeNull();
    });
    it('retorna instituicao quando subdominio existe, instituicao ativa e conta ativa', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'inst-1',
                  name: 'Escola Luz',
                  subdomain: 'escolaluz',
                  active: true,
                  account_id: 'acc-1',
                  accounts: { id: 'acc-1', status: 'ACTIVE' },
                },
                error: null,
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const res = await resolveInstitutionBySubdomain('escolaluz');
      expect(res.error).toBeNull();
      expect(res.institution).toEqual({
        id: 'inst-1',
        name: 'Escola Luz',
        subdomain: 'escolaluz',
        login_display_name: null,
        logo_url: null,
        favicon_url: null,
        primary_color: null,
        secondary_color: null,
        active: true,
        account_id: 'acc-1',
      });
    });

    it('retorna null sem erro para subdominio inexistente', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const res = await resolveInstitutionBySubdomain('inexistente');
      expect(res.institution).toBeNull();
      expect(res.error).toBeNull();
    });

    it('retorna null sem erro quando a conta associada esta SUSPENDED ou CANCELED', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'inst-1',
                  name: 'Escola Suspensa',
                  subdomain: 'escolasuspensa',
                  active: true,
                  account_id: 'acc-1',
                  accounts: { id: 'acc-1', status: 'SUSPENDED' },
                },
                error: null,
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const res = await resolveInstitutionBySubdomain('escolasuspensa');
      expect(res.institution).toBeNull();
      expect(res.error).toBeNull();
    });

    it('retorna null sem erro para subdominios reservados sem consultar o banco', async () => {
      const mockFrom = vi.fn();
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const res = await resolveInstitutionBySubdomain('admin');
      expect(res.institution).toBeNull();
      expect(res.error).toBeNull();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('preserva erro do Supabase sem transformar em null', async () => {
      const dbError = new Error('Database error 500');
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: dbError,
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const res = await resolveInstitutionBySubdomain('escolaluz');
      expect(res.institution).toBeNull();
      expect(res.error).toBe(dbError);
    });
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

  describe('updateInstitutionBranding (Operacao 2 - DIRECTOR)', () => {
    it('salva branding via RPC server-side especifica usando institution.id', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            id: 'inst-1',
            name: 'Escola Modelo',
            subdomain: 'escola-modelo',
            login_display_name: 'Login Escola',
            logo_url: 'https://cdn.example.co/logo.png',
            favicon_url: 'https://cdn.example.co/favicon.png',
            primary_color: '#005bbf',
            secondary_color: '#ff9900',
            active: true,
            account_id: 'acc-1',
          },
        ],
        error: null,
      } as never);

      const result = await updateInstitutionBranding({
        institutionId: 'inst-1',
        profileId: 'director-profile-1',
        login_display_name: 'Login Escola',
        logo_url: 'https://cdn.example.co/logo.png',
        favicon_url: 'https://cdn.example.co/favicon.png',
        primary_color: '#005bbf',
        secondary_color: '#ff9900',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'update_institution_login_branding',
        expect.objectContaining({
          target_institution_id: 'inst-1',
          new_login_display_name: 'Login Escola',
          set_login_display_name: true,
          new_logo_url: 'https://cdn.example.co/logo.png',
          set_logo_url: true,
          new_favicon_url: 'https://cdn.example.co/favicon.png',
          set_favicon_url: true,
          new_primary_color: '#005bbf',
          set_primary_color: true,
          new_secondary_color: '#ff9900',
          set_secondary_color: true,
        }),
      );
      expect(supabase.from).not.toHaveBeenCalledWith('institutions');
      expect(result.logo_url).toBe('https://cdn.example.co/logo.png');
      expect(result.primary_color).toBe('#005bbf');
    });

    it('nao envia subdomain, active ou account_id para a RPC de branding', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [
          {
            id: 'inst-1',
            name: 'Escola Modelo',
            subdomain: 'escola-modelo',
            login_display_name: 'Login Escola',
            logo_url: null,
            favicon_url: null,
            primary_color: '#005bbf',
            secondary_color: '#ff9900',
            active: true,
            account_id: 'acc-1',
          },
        ],
        error: null,
      } as never);

      await updateInstitutionBranding({
        institutionId: 'inst-1',
        profileId: 'director-profile-1',
        login_display_name: 'Login Escola',
      });

      const payload = vi.mocked(supabase.rpc).mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('subdomain');
      expect(payload).not.toHaveProperty('active');
      expect(payload).not.toHaveProperty('account_id');
      expect(payload).not.toHaveProperty('id');
    });

    it('propaga erro de autorizacao server-side da RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: new Error('Apenas um Diretor com membership ativa pode alterar a identidade visual da instituicao.'),
      } as never);

      await expect(
        updateInstitutionBranding({
          institutionId: 'inst-outro',
          profileId: 'director-profile-1',
          logo_url: 'https://cdn.example.co/hack.png',
        }),
      ).rejects.toThrow(/Apenas um Diretor/i);
    });
  });
});
