// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  invalidateResolvedPublicBranding,
  updateResolvedPublicBrandingCache,
  useResolvedBranding,
} from './useBranding';
import {
  brandingService,
  type PublicBranding,
} from '../services/brandingService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {},
}));

const staleBranding: PublicBranding = {
  scope: 'INSTITUTION',
  displayName: 'Escola antiga',
  logoUrl: 'https://cdn.example.com/old-logo.png',
  faviconUrl: 'https://cdn.example.com/old-favicon.png',
  loginBackgroundUrl: 'https://cdn.example.com/old-background.png',
  primaryColor: '#005bbf',
  secondaryColor: '#6ffbbe',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

describe('updateResolvedPublicBrandingCache', () => {
  it('publica a resposta canônica no cache de consulta após preparar os assets', async () => {
    const queryClient = new QueryClient();
    const branding = {
      ...staleBranding,
      displayName: 'Escola atualizada',
      logoUrl: 'https://cdn.example.com/logo-v2.png',
    };

    const readyBranding = {
      ...branding,
      logoUrl: null,
      faviconUrl: null,
      loginBackgroundUrl: null,
    };

    await updateResolvedPublicBrandingCache(
      queryClient,
      'escola.example.com',
      readyBranding,
    );

    expect(queryClient.getQueryData(['public-branding', 'escola.example.com'])).toEqual(readyBranding);
    expect(localStorage.getItem('tecescola:public-branding:escola.example.com')).toBeNull();
    queryClient.clear();
  });
});

describe('useResolvedBranding', () => {
  it('ignora branding persistido antigo e só publica a resposta após pre-carregar os assets', async () => {
    const host = 'escola.example.com';
    localStorage.setItem(
      `tecescola:public-branding:${host}`,
      JSON.stringify({
        version: 2,
        cachedAt: Date.now(),
        branding: staleBranding,
      }),
    );

    const currentBranding: PublicBranding = {
      ...staleBranding,
      displayName: 'Escola atual',
      logoUrl: 'https://cdn.example.com/new-logo.png',
      faviconUrl: 'https://cdn.example.com/new-favicon.png',
      loginBackgroundUrl: 'https://cdn.example.com/new-background.png',
    };
    let resolveBranding!: (branding: PublicBranding) => void;
    const response = new Promise<PublicBranding>((resolve) => {
      resolveBranding = resolve;
    });
    const resolveSpy = vi
      .spyOn(brandingService, 'resolveForHostname')
      .mockReturnValue(response);

    const images: Array<{
      onload: ((event: Event) => void) | null;
      onerror: ((event: Event) => void) | null;
      complete: boolean;
      naturalWidth: number;
      src: string;
      decode: ReturnType<typeof vi.fn>;
    }> = [];
    class ControlledImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      complete = false;
      naturalWidth = 100;
      src = '';
      decode = vi.fn().mockResolvedValue(undefined);

      constructor() {
        images.push(this);
      }
    }
    vi.stubGlobal('Image', ControlledImage);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result, unmount } = renderHook(
      () => useResolvedBranding(host),
      { wrapper },
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveBranding(currentBranding);
      await response;
    });
    await waitFor(() => expect(images).toHaveLength(3));
    expect(new Set(images.map((image) => image.src))).toEqual(
      new Set([
        currentBranding.logoUrl,
        currentBranding.faviconUrl,
        currentBranding.loginBackgroundUrl,
      ]),
    );
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      images.forEach((image) => {
        image.complete = true;
        image.onload?.(new Event('load'));
      });
    });

    await waitFor(() => expect(result.current.data).toEqual(currentBranding));
    expect(resolveSpy).toHaveBeenCalledWith(host);

    unmount();
    queryClient.clear();
  });
});
