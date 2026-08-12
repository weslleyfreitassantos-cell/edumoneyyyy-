import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabaseClient';
import { accountService, AccountServiceError } from './accountService';

const queryBuilder = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(() => queryBuilder),
  },
}));

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryBuilder.update.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.select.mockReturnValue(queryBuilder);
  });

  it('normalizando respostas validas', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        accountId: 'acc-1',
        ownerProfileId: 'prof-1',
        ownerEmail: 'test@test.com',
        institutionLimit: 1,
        invitationSent: true,
        reusedExistingUser: false,
      },
      error: null,
    });

    const response = await accountService.createAccount({
      accountName: 'Test',
      adminFullName: 'Test Admin',
      adminEmail: 'test@test.com',
      institutionLimit: 1,
    });

    expect(response.accountId).toBe('acc-1');
  });

  it('rejeitando success false', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: false,
        code: 'ERR',
        message: 'Error message',
      },
      error: null,
    });

    await expect(accountService.createAccount({
      accountName: 'Test',
      adminFullName: 'Test Admin',
      adminEmail: 'test@test.com',
      institutionLimit: 1,
    })).rejects.toThrow(AccountServiceError);
  });

  it('rejeitando campos ausentes', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        accountId: 'acc-1',
        // missing other required fields
      },
      error: null,
    });

    await expect(accountService.createAccount({
      accountName: 'Test',
      adminFullName: 'Test Admin',
      adminEmail: 'test@test.com',
      institutionLimit: 1,
    })).rejects.toThrow(AccountServiceError);
  });

  it('normaliza resposta de encerramento seguro', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        accountId: 'acc-1',
        institutionLimit: 2,
        previousStatus: 'ACTIVE',
        status: 'CANCELED',
        auditEventId: 'event-1',
        statusChanged: true,
      },
      error: null,
    });

    const response = await accountService.closeAccount({
      accountId: 'acc-1',
      reason: 'Encerramento comercial solicitado.',
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'update-client-account',
      {
        body: {
          accountId: 'acc-1',
          status: 'CANCELED',
          reason: 'Encerramento comercial solicitado.',
        },
      },
    );
    expect(response.previousStatus).toBe('ACTIVE');
    expect(response.status).toBe('CANCELED');
    expect(response.auditEventId).toBe('event-1');
    expect(response.statusChanged).toBe(true);
  });

  it('atualiza somente o nome da instituicao usando a RPC e o id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ id: 'institution-1', name: 'Colegio Luz' }],
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    });

    const response =
      await accountService.updateInstitutionName({
        institutionId: 'institution-1',
        name: '  Colegio Luz  ',
      });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'update_admin_institution_name',
      {
        target_institution_id: 'institution-1',
        new_name: 'Colegio Luz',
      },
    );
    expect(response).toEqual({
      success: true,
      institutionId: 'institution-1',
      name: 'Colegio Luz',
    });
  });

  it('rejeita nome vazio antes de chamar o banco', async () => {
    await expect(
      accountService.updateInstitutionName({
        institutionId: 'institution-1',
        name: '    ',
      }),
    ).rejects.toThrow(AccountServiceError);

    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
