import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { brandingMutationService } from './brandingMutationService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock('./brandingValidation', () => ({
  validateInstitutionBackgroundFile: vi.fn(async () => null),
  validateInstitutionLogoFile: vi.fn(async () => null),
  getStorageExtension: vi.fn(() => 'png'),
}));

describe('brandingMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(123456);
  });

  it('salva a logo com cacheNonce para evitar resposta antiga da CDN', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl:
          'https://storage.example.com/institution-1/logo.png',
      },
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      getPublicUrl,
    } as never);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        id: 'institution-1',
        name: 'Escola Centro',
        logo_url:
          'https://storage.example.com/institution-1/logo.png?cacheNonce=123456',
      },
      error: null,
    } as never);

    const result = await brandingMutationService.saveLogo({
      institutionId: 'institution-1',
      institutionName: 'Escola Centro',
      currentPublicSlug: null,
      file: new File(['logo'], 'logo.png', {
        type: 'image/png',
      }),
    });

    expect(upload).toHaveBeenCalledWith(
      'institution-1/logo.png',
      expect.any(File),
      expect.objectContaining({ upsert: true }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'update_institution_login_branding',
      expect.objectContaining({
        target_institution_id: 'institution-1',
        new_logo_url:
          'https://storage.example.com/institution-1/logo.png?cacheNonce=123456',
        set_logo_url: true,
        set_favicon_url: false,
      }),
    );
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result.logoUrl).toContain('?cacheNonce=123456');
  });

  it('salva o background com cacheNonce e atualiza a RPC', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl:
          'https://storage.example.com/institution-1/background.png',
      },
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      getPublicUrl,
    } as never);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        id: 'institution-1',
        name: 'Escola Centro',
        login_background_url:
          'https://storage.example.com/institution-1/background.png?cacheNonce=123456',
      },
      error: null,
    } as never);

    const result = await brandingMutationService.saveBackground({
      institutionId: 'institution-1',
      institutionName: 'Escola Centro',
      currentPublicSlug: null,
      file: new File(['background'], 'background.png', {
        type: 'image/png',
      }),
    });

    expect(upload).toHaveBeenCalledWith(
      'institution-1/background.png',
      expect.any(File),
      expect.objectContaining({ upsert: true }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'update_institution_login_branding',
      expect.objectContaining({
        new_login_background_url:
          'https://storage.example.com/institution-1/background.png?cacheNonce=123456',
        set_login_background_url: true,
      }),
    );
    expect(result.loginBackgroundUrl).toContain('?cacheNonce=123456');
  });

  it('retorna erro controlado quando o update nao retorna linha', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl:
          'https://storage.example.com/institution-1/logo.png',
      },
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      getPublicUrl,
    } as never);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    await expect(
      brandingMutationService.saveLogo({
        institutionId: 'institution-1',
        institutionName: 'Escola Centro',
        currentPublicSlug: null,
        file: new File(['logo'], 'logo.png', {
          type: 'image/png',
        }),
      }),
    ).rejects.toThrow(/Nenhum registro/i);
  });

  it('remove somente a logo da instituição alvo e não apaga os outros arquivos', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({ remove } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ id: 'institution-2', name: 'Escola Horizonte', logo_url: null }],
      error: null,
    } as never);

    await brandingMutationService.removeLogo({
      institutionId: 'institution-2',
      institutionName: 'Escola Horizonte',
      currentPublicSlug: 'escola-horizonte',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'update_institution_login_branding',
      expect.objectContaining({
        target_institution_id: 'institution-2',
        new_logo_url: null,
        set_logo_url: true,
        set_favicon_url: false,
        set_login_background_url: false,
        set_primary_color: false,
        set_secondary_color: false,
      }),
    );
    expect(remove).toHaveBeenCalledWith([
      'institution-2/logo.png',
      'institution-2/logo.jpg',
      'institution-2/logo.jpeg',
      'institution-2/logo.webp',
    ]);
    expect(remove.mock.calls.flat().join(' ')).not.toMatch(/favicon|background/);
  });

  it.each([
    {
      asset: 'favicon',
      method: 'removeFavicon' as const,
      flag: 'set_favicon_url',
      paths: ['institution-3/favicon.png', 'institution-3/favicon.jpg', 'institution-3/favicon.jpeg', 'institution-3/favicon.webp'],
    },
    {
      asset: 'background',
      method: 'removeBackground' as const,
      flag: 'set_login_background_url',
      paths: ['institution-3/background.png', 'institution-3/background.jpg', 'institution-3/background.jpeg', 'institution-3/background.webp'],
    },
  ])('mantém a remoção de $asset independente', async ({ asset, method, flag, paths }) => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({ remove } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ id: 'institution-3', name: 'Escola Centro', logo_url: 'logo', favicon_url: 'favicon', login_background_url: 'background' }],
      error: null,
    } as never);

    await brandingMutationService[method]({
      institutionId: 'institution-3',
      institutionName: 'Escola Centro',
      currentPublicSlug: 'escola-centro',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'update_institution_login_branding',
      expect.objectContaining({
        target_institution_id: 'institution-3',
        [flag]: true,
        ...(asset === 'favicon'
          ? { set_logo_url: false, set_login_background_url: false }
          : { set_logo_url: false, set_favicon_url: false }),
      }),
    );
    expect(remove).toHaveBeenCalledWith(paths);
  });
});
