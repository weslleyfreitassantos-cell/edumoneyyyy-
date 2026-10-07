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
});
