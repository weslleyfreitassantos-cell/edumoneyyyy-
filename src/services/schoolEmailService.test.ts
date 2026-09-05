import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import { schoolEmailService } from './schoolEmailService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('schoolEmailService', () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset();
  });

  it('resolve a lista de destinatarios pelo backend', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { recipients: [] },
      error: null,
    } as never);

    await schoolEmailService.listRecipients('institution-1');

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'send-school-email',
      { body: { action: 'list_recipients', institutionId: 'institution-1' } },
    );
  });

  it('envia somente IDs internos e conteúdo validado', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        recipientCount: 2,
        sentCount: 2,
        recipientsWithoutEmail: 0,
        failedCount: 0,
      },
      error: null,
    } as never);

    await schoolEmailService.send({
      institutionId: 'institution-1',
      audience: 'SELECTED',
      selectedRecipientIds: ['STUDENT:profile-1'],
      subject: 'Aviso',
      message: 'Olá {{nome}}',
    });

    const [, options] = vi.mocked(supabase.functions.invoke).mock.calls[0];
    expect(options).toEqual({
      body: expect.objectContaining({
        action: 'send',
        institutionId: 'institution-1',
        selectedRecipientIds: ['STUDENT:profile-1'],
      }),
    });
    expect(options.body).not.toHaveProperty('emails');
    expect(options.body).not.toHaveProperty('recipients');
  });

  it('preserva o código semântico retornado pela Edge Function', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({
          success: false,
          code: 'RESEND_FORBIDDEN',
          message: 'O serviço de e-mail recusou esta operação.',
        })),
      ),
    } as never);

    await expect(
      schoolEmailService.send({
        institutionId: 'institution-1',
        audience: 'TEACHERS',
        subject: 'Aviso',
        message: 'Mensagem',
      }),
    ).rejects.toMatchObject({
      code: 'RESEND_FORBIDDEN',
      message: 'O serviço de e-mail recusou esta operação.',
    });
  });
});
