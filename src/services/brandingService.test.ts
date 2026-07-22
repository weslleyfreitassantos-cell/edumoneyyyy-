// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  brandingService,
  type BrandingRecord,
} from './brandingService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

function pngFile(): File {
  const bytes = new Uint8Array(12);
  bytes.set([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);

  return new File([bytes], 'original-name.png', {
    type: 'image/png',
  });
}

function mockSelectMaybeSingle(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const query = {
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle,
  };
  const table = {
    select: vi.fn(() => query),
  };

  return { table, query, maybeSingle };
}

function mockUpdateMaybeSingle(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const afterEq = {
    select: vi.fn(() => ({
      maybeSingle,
    })),
  };
  const table = {
    update: vi.fn(() => ({
      eq: vi.fn(() => afterEq),
    })),
  };

  return { table, maybeSingle };
}

const currentAccountBranding: BrandingRecord = {
  id: 'branding-1',
  scope: 'ACCOUNT',
  accountId: 'account-1',
  displayName: 'Conta A',
  logoUrl: 'https://cdn.example.com/old.png?v=1',
  logoPath: 'branding/accounts/account-1/logo/old.png',
  faviconUrl: null,
  faviconPath: null,
  primaryColor: '#005bbf',
  secondaryColor: '#6ffbbe',
};

describe('brandingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(9876);
  });

  it('resolve branding publico por hostname e limita o payload visual', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          scope: 'ACCOUNT',
          display_name: 'Conta A',
          logo_url: 'https://cdn.example.com/logo.png',
          favicon_url: null,
          primary_color: '#112233',
          secondary_color: '#445566',
        },
      ],
      error: null,
    } as never);

    const result =
      await brandingService.resolveForHostname(
        'Conta.Exemplo.COM',
      );

    expect(supabase.rpc).toHaveBeenCalledWith(
      'resolve_public_branding',
      { hostname: 'conta.exemplo.com' },
    );
    expect(result).toEqual({
      scope: 'ACCOUNT',
      displayName: 'Conta A',
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: null,
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });
    expect('accountId' in result).toBe(false);
  });

  it('retorna fallback neutro quando a RPC publica falha', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: new Error('rpc unavailable'),
    } as never);

    await expect(
      brandingService.resolveForHostname('desconhecido.com'),
    ).resolves.toMatchObject({
      scope: 'FALLBACK',
      logoUrl: null,
      primaryColor: '#005bbf',
    });
  });

  it('normaliza e solicita dominio como PENDING', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'domain-1',
        account_id: 'account-1',
        hostname: 'escola.exemplo.com',
        status: 'PENDING',
        is_primary: false,
        created_at: '2026-07-22T00:00:00.000Z',
        accounts: { name: 'Conta A' },
      },
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const insert = vi.fn(() => ({ select }));

    vi.mocked(supabase.from).mockReturnValue({
      insert,
    } as never);

    const domain =
      await brandingService.requestAccountDomain(
        'account-1',
        'Escola.Exemplo.COM',
      );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'account-1',
        hostname: 'escola.exemplo.com',
        status: 'PENDING',
      }),
    );
    expect(domain.status).toBe('PENDING');
  });

  it('bloqueia hostname reservado antes de chamar o banco', async () => {
    await expect(
      brandingService.requestAccountDomain(
        'account-1',
        'localhost',
      ),
    ).rejects.toThrow(/reservado/i);

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('faz upload novo, persiste e so depois remove o arquivo anterior', async () => {
    const current = mockSelectMaybeSingle({
      data: {
        id: currentAccountBranding.id,
        scope_type: currentAccountBranding.scope,
        account_id: currentAccountBranding.accountId,
        display_name: currentAccountBranding.displayName,
        logo_url: currentAccountBranding.logoUrl,
        logo_path: currentAccountBranding.logoPath,
        favicon_url: null,
        favicon_path: null,
        primary_color: currentAccountBranding.primaryColor,
        secondary_color: currentAccountBranding.secondaryColor,
      },
      error: null,
    });
    const persisted = mockUpdateMaybeSingle({
      data: {
        id: 'branding-1',
        scope_type: 'ACCOUNT',
        account_id: 'account-1',
        display_name: 'Conta A',
        logo_url: 'https://cdn.example.com/new.png?v=9876',
        logo_path: 'branding/accounts/account-1/logo/new.png',
        favicon_url: null,
        favicon_path: null,
        primary_color: '#005bbf',
        secondary_color: '#6ffbbe',
      },
      error: null,
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl: 'https://cdn.example.com/new.png',
      },
    }));

    vi.mocked(supabase.from)
      .mockReturnValueOnce(current.table as never)
      .mockReturnValueOnce(persisted.table as never);
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      remove,
      getPublicUrl,
    } as never);

    const result =
      await brandingService.saveAccountBranding('account-1', {
        displayName: 'Conta A',
        primaryColor: '#005bbf',
        secondaryColor: '#6ffbbe',
        logoFile: pngFile(),
      });

    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(persisted.table.update).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([
      'branding/accounts/account-1/logo/old.png',
    ]);
    expect(result.logoUrl).toBe(
      'https://cdn.example.com/new.png?v=9876',
    );
    expect(
      upload.mock.calls[0][0],
    ).not.toContain('original-name');
  });

  it('limpa upload novo quando a persistencia falha', async () => {
    const current = mockSelectMaybeSingle({
      data: null,
      error: null,
    });
    const persisted = mockUpdateMaybeSingle({
      data: null,
      error: new Error('RLS blocked'),
    });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: persisted.maybeSingle,
      })),
    }));
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl: 'https://cdn.example.com/orphan.png',
      },
    }));

    vi.mocked(supabase.from)
      .mockReturnValueOnce(current.table as never)
      .mockReturnValueOnce({ insert } as never);
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      remove,
      getPublicUrl,
    } as never);

    await expect(
      brandingService.saveGlobalBranding({
        displayName: 'Global',
        primaryColor: '#005bbf',
        secondaryColor: '#6ffbbe',
        logoFile: pngFile(),
      }),
    ).rejects.toThrow(/RLS blocked/i);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0][0][0]).toContain(
      'branding/global/logo/',
    );
  });

  it('distingue retorno vazio em update do erro 406 antigo', async () => {
    const current = mockSelectMaybeSingle({
      data: {
        id: 'branding-1',
        scope_type: 'GLOBAL',
        account_id: null,
        display_name: 'Global',
        logo_url: null,
        logo_path: null,
        favicon_url: null,
        favicon_path: null,
        primary_color: '#005bbf',
        secondary_color: '#6ffbbe',
      },
      error: null,
    });
    const persisted = mockUpdateMaybeSingle({
      data: null,
      error: null,
    });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(current.table as never)
      .mockReturnValueOnce(persisted.table as never);

    await expect(
      brandingService.saveGlobalBranding({
        displayName: 'Global',
        primaryColor: '#005bbf',
        secondaryColor: '#6ffbbe',
      }),
    ).rejects.toMatchObject({
      code: 'BRANDING_UPDATE_EMPTY',
    });
  });
});
