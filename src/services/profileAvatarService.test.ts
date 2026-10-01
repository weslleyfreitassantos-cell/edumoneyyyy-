import { describe, expect, it, vi } from 'vitest';

import {
  getProfileAvatarPath,
  profileAvatarPath,
  validateProfileAvatarFile,
} from './profileAvatarService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

describe('profileAvatarService', () => {
  it('aceita imagens maiores que o antigo limite de 5 MB', () => {
    const file = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      'foto.png',
      { type: 'image/png' },
    );

    expect(() => validateProfileAvatarFile(file)).not.toThrow();
  });

  it('mantém somente os formatos de imagem suportados', () => {
    const file = new File(['texto'], 'arquivo.pdf', {
      type: 'application/pdf',
    });

    expect(() => validateProfileAvatarFile(file)).toThrow(
      'Escolha uma imagem JPG, PNG ou WebP.',
    );
  });

  it('reconhece apenas o caminho de avatar do próprio perfil', () => {
    const profileId = 'profile-1';
    const path = profileAvatarPath(profileId);

    expect(getProfileAvatarPath(path, profileId)).toBe(path);
    expect(getProfileAvatarPath('profile-2/avatar.webp', profileId)).toBeNull();
  });
});
