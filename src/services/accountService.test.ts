import { describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabaseClient';
import { accountService, AccountServiceError } from './accountService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('accountService', () => {
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
});
