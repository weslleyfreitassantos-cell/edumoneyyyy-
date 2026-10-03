// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  downloadPrivacyExport,
  exportCurrentUserData,
  PrivacyServiceError,
} from './privacyService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}));

describe('privacyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the authenticated user export through the scoped RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { schema_version: '1', profile: { id: 'user-1' } },
      error: null,
    } as never);

    await expect(exportCurrentUserData()).resolves.toEqual({
      schema_version: '1',
      profile: { id: 'user-1' },
    });
    expect(supabase.rpc).toHaveBeenCalledWith('export_current_user_data');
  });

  it('does not expose a malformed export as a successful download', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    } as never);

    await expect(exportCurrentUserData()).rejects.toBeInstanceOf(PrivacyServiceError);
  });

  it('downloads a dated JSON file without sending it to a third party', () => {
    const createObjectURL = vi.fn(() => 'blob:privacy-export');
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement);

    downloadPrivacyExport({ profile: { id: 'user-1' } }, new Date('2026-10-03T12:00:00Z'));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });
});
