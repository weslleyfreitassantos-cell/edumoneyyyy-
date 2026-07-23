// @vitest-environment jsdom

import {
  afterEach,
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

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const generatedAssetId = '11111111-2222-4333-8444-555555555555';
const generatedLogoPath =
  `branding/accounts/${accountId}/logo/${generatedAssetId}.png`;
const previousLogoPath =
  `branding/accounts/${accountId}/logo/99999999-9999-4999-8999-999999999999.png`;
const generatedFaviconPath =
  `branding/accounts/${accountId}/favicon/${generatedAssetId}.png`;
const storageOrigin =
  'https://trusted-storage.example/storage/v1/object/public/institution-branding';

function derivedPublicUrl(path: string): string {
  return `${storageOrigin}/${path}`;
}

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
  accountId,
  displayName: 'Conta A',
  logoUrl: `${derivedPublicUrl(previousLogoPath)}?v=1`,
  logoPath: previousLogoPath,
  faviconUrl: null,
  faviconPath: null,
  primaryColor: '#005bbf',
  secondaryColor: '#6ffbbe',
};

describe('brandingService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(9876);
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => generatedAssetId),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolve branding publico por hostname e limita o payload visual', async () => {
    const getPublicUrl = vi.fn((path: string) => ({
      data: {
        publicUrl: derivedPublicUrl(path),
      },
    }));

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          scope: 'ACCOUNT',
          display_name: 'Conta A',
          logo_path: generatedLogoPath,
          favicon_path: generatedFaviconPath,
          primary_color: '#112233',
          secondary_color: '#445566',
        },
      ],
      error: null,
    } as never);
    vi.mocked(supabase.storage.from).mockReturnValue({
      getPublicUrl,
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
      logoUrl: `${derivedPublicUrl(generatedLogoPath)}?v=9876`,
      faviconUrl: `${derivedPublicUrl(generatedFaviconPath)}?v=9876`,
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });
    expect('accountId' in result).toBe(false);
    expect(getPublicUrl).toHaveBeenCalledWith(generatedLogoPath);
    expect(getPublicUrl).toHaveBeenCalledWith(generatedFaviconPath);
  });

  it('ignora paths invalidos retornados pela RPC publica', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          scope: 'GLOBAL',
          display_name: 'Global',
          logo_path: `branding/global/logo/${generatedAssetId}.svg`,
          favicon_path: `branding/global/favicon/sub/${generatedAssetId}.png`,
          primary_color: '#112233',
          secondary_color: '#445566',
        },
      ],
      error: null,
    } as never);

    const result =
      await brandingService.resolveForHostname(
        'global.exemplo.com',
      );

    expect(result.logoUrl).toBeNull();
    expect(result.faviconUrl).toBeNull();
    expect(supabase.storage.from).not.toHaveBeenCalled();
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
        account_id: accountId,
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
        accountId,
        'Escola.Exemplo.COM',
      );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: accountId,
        hostname: 'escola.exemplo.com',
        status: 'PENDING',
      }),
    );
    expect(domain.status).toBe('PENDING');
  });

  it('bloqueia hostname reservado antes de chamar o banco', async () => {
    await expect(
      brandingService.requestAccountDomain(
        accountId,
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
        logo_path: currentAccountBranding.logoPath,
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
        account_id: accountId,
        display_name: 'Conta A',
        logo_path: generatedLogoPath,
        favicon_path: null,
        primary_color: '#005bbf',
        secondary_color: '#6ffbbe',
      },
      error: null,
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn((path: string) => ({
      data: {
        publicUrl: derivedPublicUrl(path),
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
      await brandingService.saveAccountBranding(accountId, {
        displayName: 'Conta A',
        primaryColor: '#005bbf',
        secondaryColor: '#6ffbbe',
        logoFile: pngFile(),
      });

    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(persisted.table.update).toHaveBeenCalled();
    const updatePayload = (
      persisted.table.update.mock.calls as unknown as Array<
        [Record<string, unknown>]
      >
    )[0][0];

    expect(updatePayload).not.toHaveProperty('logo_url');
    expect(updatePayload).not.toHaveProperty('favicon_url');
    expect(remove).toHaveBeenCalledWith([
      previousLogoPath,
    ]);
    expect(result.logoUrl).toBe(
      `${derivedPublicUrl(generatedLogoPath)}?v=9876`,
    );
    expect(upload).toHaveBeenCalledWith(
      generatedLogoPath,
      expect.any(File),
      expect.objectContaining({
        contentType: 'image/png',
        upsert: false,
      }),
    );
    expect(upload.mock.calls[0][0]).not.toContain(
      'original-name',
    );
  });

  it('usa fallback UUID v4 com crypto.getRandomValues', async () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set([
        0x00,
        0x01,
        0x02,
        0x03,
        0x04,
        0x05,
        0x06,
        0x07,
        0x08,
        0x09,
        0x0a,
        0x0b,
        0x0c,
        0x0d,
        0x0e,
        0x0f,
      ]);

      return bytes;
    });
    const upload = vi.fn().mockResolvedValue({ error: null });

    vi.stubGlobal('crypto', { getRandomValues });
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      remove: vi.fn(),
    } as never);

    const result = await brandingService.uploadLogo({
      scope: 'GLOBAL',
      accountId: null,
      file: pngFile(),
    });

    expect(result.path).toBe(
      'branding/global/logo/00010203-0405-4607-8809-0a0b0c0d0e0f.png',
    );
    expect(result).not.toHaveProperty('publicUrl');
    expect(upload).toHaveBeenCalledWith(
      result.path,
      expect.any(File),
      expect.objectContaining({
        contentType: 'image/png',
      }),
    );
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

    vi.mocked(supabase.from)
      .mockReturnValueOnce(current.table as never)
      .mockReturnValueOnce({ insert } as never);
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      remove,
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
        logo_path: null,
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
