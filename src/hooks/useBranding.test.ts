// @vitest-environment jsdom

import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { invalidateResolvedPublicBranding } from './useBranding';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {},
}));

const staleBranding = {
  scope: 'INSTITUTION',
  displayName: 'Escola antiga',
  logoUrl: 'https://cdn.example.com/old-logo.png',
  faviconUrl: 'https://cdn.example.com/old-favicon.png',
  loginBackgroundUrl: 'https://cdn.example.com/old-background.png',
  primaryColor: '#005bbf',
  secondaryColor: '#6ffbbe',
};

afterEach(() => {
  localStorage.clear();
});

describe('invalidateResolvedPublicBranding', () => {
  it('remove o cache persistido do hostname e invalida sua consulta', async () => {
    const queryClient = new QueryClient();
    const queryKey = ['public-branding', 'escola.example.com'];
    const cacheKey = 'tecescola:public-branding:escola.example.com';

    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        version: 1,
        cachedAt: Date.now(),
        branding: staleBranding,
      }),
    );
    queryClient.setQueryData(queryKey, staleBranding);

    await invalidateResolvedPublicBranding(
      queryClient,
      'escola.example.com',
    );

    expect(localStorage.getItem(cacheKey)).toBeNull();
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
    queryClient.clear();
  });

  it('limpa caches de todos os hostnames ao mudar branding compartilhado', async () => {
    const queryClient = new QueryClient();
    localStorage.setItem('tecescola:public-branding:escola-a.example.com', '{}');
    localStorage.setItem('tecescola:public-branding:escola-b.example.com', '{}');
    localStorage.setItem('unrelated-key', 'preservar');

    await invalidateResolvedPublicBranding(queryClient, null);

    expect(localStorage.getItem('tecescola:public-branding:escola-a.example.com')).toBeNull();
    expect(localStorage.getItem('tecescola:public-branding:escola-b.example.com')).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('preservar');
    queryClient.clear();
  });
});
