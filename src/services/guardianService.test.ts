import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { guardianService } from './guardianService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function mockGuardianshipUpdate({
  institutionId = 'institution-1',
  updatedActive = false,
  updateResult = { id: 'link-1', active: updatedActive },
  updateError = null,
}: {
  institutionId?: string;
  updatedActive?: boolean;
  updateResult?: { id: string; active: boolean } | null;
  updateError?: Error | null;
} = {}) {
  const lookup = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { students: { institution_id: institutionId } },
      error: null,
    }),
  };
  lookup.select.mockReturnValue(lookup);
  lookup.eq.mockReturnValue(lookup);

  const update = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: updateResult,
      error: updateError,
    }),
  };
  update.update.mockReturnValue(update);
  update.eq.mockReturnValue(update);
  update.select.mockReturnValue(update);

  vi.mocked(supabase.from)
    .mockReturnValueOnce(lookup as never)
    .mockReturnValueOnce(update as never);

  return { lookup, update };
}

describe('guardianService.setLinkActive', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([false, true])('confirma persistência ao definir active=%s', async (active) => {
    const { update } = mockGuardianshipUpdate({ updatedActive: active });

    await expect(
      guardianService.setLinkActive('link-1', 'institution-1', active),
    ).resolves.toBeUndefined();

    expect(update.update).toHaveBeenCalledWith({ active });
    expect(update.select).toHaveBeenCalledWith('id, active');
    expect(update.maybeSingle).toHaveBeenCalledOnce();
  });

  it('não reporta sucesso quando RLS/UPDATE não retorna uma linha', async () => {
    mockGuardianshipUpdate({ updateResult: null });

    await expect(
      guardianService.setLinkActive('link-1', 'institution-1', false),
    ).rejects.toThrow('O vínculo não foi atualizado');
  });

  it('rejeita um estado diferente do solicitado', async () => {
    mockGuardianshipUpdate({ updatedActive: true, updateResult: { id: 'link-1', active: true } });

    await expect(
      guardianService.setLinkActive('link-1', 'institution-1', false),
    ).rejects.toThrow('O vínculo não foi atualizado');
  });
});
