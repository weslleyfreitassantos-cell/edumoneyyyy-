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
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock('./brandingValidation', () => ({
  validateInstitutionLogoFile: vi.fn(async () => null),
  getStorageExtension: vi.fn(() => 'png'),
}));

describe('brandingMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(123456);
  });

  it('salva URL versionada para atualizar a logo sem cache antigo', async () => {
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

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'institution-1',
        name: 'Escola Centro',
        logo_url:
          'https://storage.example.com/institution-1/logo.png?v=123456',
        public_slug: 'escola-centro',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });

    vi.mocked(supabase.from).mockReturnValue({ update } as never);

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
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_url:
          'https://storage.example.com/institution-1/logo.png?v=123456',
        public_slug: 'escola-centro',
      }),
    );
    expect(result.logoUrl).toContain('?v=123456');
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

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });

    vi.mocked(supabase.from).mockReturnValue({ update } as never);

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
