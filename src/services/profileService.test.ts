import { supabase } from '../lib/supabaseClient';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ProfileServiceError,
  removeCurrentProfileAvatar,
  resolveCurrentProfileAvatar,
  updateCurrentProfileAvatar,
  updateCurrentPassword,
  updateCurrentProfile,
} from './profileService';
import { prepareAvatarImage } from './avatarImageService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock('./avatarImageService', async () => {
  const actual = await vi.importActual<
    typeof import('./avatarImageService')
  >('./avatarImageService');

  return {
    ...actual,
    prepareAvatarImage: vi.fn(),
  };
});

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atualiza somente full_name do usuário autenticado e retorna o perfil', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: 'user-1' },
      },
      error: null,
    } as never);

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        full_name: 'Novo Nome',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });

    vi.mocked(supabase.from).mockReturnValue({
      update,
    } as never);

    const result = await updateCurrentProfile({
      fullName: '  Novo Nome  ',
    });

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({
      full_name: 'Novo Nome',
    });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(select).toHaveBeenCalledWith('id, full_name');
    expect(result).toEqual({
      id: 'user-1',
      full_name: 'Novo Nome',
    });
  });

  it('não aceita id, role, e-mail ou memberships no payload', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'auth-user' } },
      error: null,
    } as never);

    const single = vi.fn().mockResolvedValue({
      data: { id: 'auth-user', full_name: 'Ana Atualizada' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await updateCurrentProfile({ fullName: 'Ana Atualizada' });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toEqual({
      full_name: 'Ana Atualizada',
    });
    expect(eq).toHaveBeenCalledWith('id', 'auth-user');
  });

  it('rejeita nome inválido antes de consultar o Supabase', async () => {
    await expect(
      updateCurrentProfile({ fullName: ' A ' }),
    ).rejects.toMatchObject({
      code: 'INVALID_NAME',
    });

    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('trata sessão ausente sem tentar atualizar profiles', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { code: 'session_not_found' },
    } as never);

    await expect(
      updateCurrentProfile({ fullName: 'Novo Nome' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProfileServiceError>>({
        code: 'SESSION_EXPIRED',
      }),
    );

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('altera a senha somente pelo Supabase Auth', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);

    await updateCurrentPassword('SenhaSegura123!');

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'SenhaSegura123!',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('rejeita senha curta antes de chamar updateUser', async () => {
    await expect(
      updateCurrentPassword('curta'),
    ).rejects.toMatchObject({
      code: 'PASSWORD_TOO_SHORT',
    });

    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('informa quando o Auth rejeita a mesma senha atual', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: {
        code: 'same_password',
        status: 422,
        message: 'New password should be different from the old password.',
      },
    } as never);

    await expect(
      updateCurrentPassword('SenhaSegura123!'),
    ).rejects.toMatchObject({
      code: 'PASSWORD_REUSED',
      message: 'A nova senha deve ser diferente da senha atual.',
    });
  });

  it('informa quando o Auth rejeita a politica de senha em producao', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: {
        code: 'weak_password',
        status: 422,
        message: 'Password is too weak.',
      },
    } as never);

    await expect(
      updateCurrentPassword('SenhaSegura123!'),
    ).rejects.toMatchObject({
      code: 'PASSWORD_POLICY_FAILED',
      message: 'A nova senha não atende aos requisitos de segurança configurados.',
    });
  });

  it('não registra a senha nem expõe detalhes internos quando updateUser falha', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: {
        code: 'unexpected_failure',
        message: 'internal auth detail',
      },
    } as never);

    await expect(
      updateCurrentPassword('SenhaSegura123!'),
    ).rejects.toMatchObject({
      code: 'PASSWORD_UPDATE_FAILED',
      message: 'Não foi possível alterar a senha.',
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('faz upload no path canônico, atualiza pela RPC e retorna signed URL', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);
    vi.mocked(prepareAvatarImage).mockResolvedValue(
      new Blob(['webp'], { type: 'image/webp' }),
    );
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/avatar' },
      error: null,
    });
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      remove,
      createSignedUrl,
    } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 'user-1/avatar.webp',
      error: null,
    } as never);

    const result = await updateCurrentProfileAvatar(
      new File(['source'], 'avatar.png', { type: 'image/png' }),
    );

    expect(upload).toHaveBeenCalledWith(
      'user-1/avatar.webp',
      expect.any(Blob),
      expect.objectContaining({
        contentType: 'image/webp',
        upsert: true,
      }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'set_current_profile_avatar',
      { p_avatar_path: 'user-1/avatar.webp' },
    );
    expect(createSignedUrl).toHaveBeenCalledWith(
      'user-1/avatar.webp',
      3600,
    );
    expect(result).toEqual({
      path: 'user-1/avatar.webp',
      avatar_url: 'https://signed.example/avatar',
    });
  });

  it('remove o avatar pela RPC e pelo objeto privado', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);
    const remove = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({ remove } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    await removeCurrentProfileAvatar();

    expect(supabase.rpc).toHaveBeenCalledWith(
      'set_current_profile_avatar',
      { p_avatar_path: null },
    );
    expect(remove).toHaveBeenCalledWith(['user-1/avatar.webp']);
  });

  it('não assina path de outro usuário e mantém URL HTTPS legada', async () => {
    const createSignedUrl = vi.fn();
    vi.mocked(supabase.storage.from).mockReturnValue({ createSignedUrl } as never);

    await expect(
      resolveCurrentProfileAvatar('user-2/avatar.webp', 'user-1'),
    ).resolves.toBeNull();
    await expect(
      resolveCurrentProfileAvatar(
        'https://legacy.example/avatar.jpg',
        'user-1',
      ),
    ).resolves.toBe('https://legacy.example/avatar.jpg');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('limpa o objeto se a RPC de perfil falhar', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);
    vi.mocked(prepareAvatarImage).mockResolvedValue(
      new Blob(['webp'], { type: 'image/webp' }),
    );
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({ upload, remove } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: 'unexpected_failure' },
    } as never);

    await expect(
      updateCurrentProfileAvatar(
        new File(['source'], 'avatar.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({
      code: 'AVATAR_PROFILE_UPDATE_FAILED',
    });
    expect(remove).toHaveBeenCalledWith(['user-1/avatar.webp']);
  });
});
