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
  updateCurrentPassword,
  updateCurrentProfile,
} from './profileService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

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
});
