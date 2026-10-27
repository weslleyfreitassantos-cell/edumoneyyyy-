// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  invalidateResolvedPublicBranding,
  brandingKeys,
  PUBLIC_BRANDING_STALE_TIME,
  preloadPublicBrandingAssets,
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
    expect(
      JSON.parse(
        localStorage.getItem('tecescola:public-branding:escola.example.com') ?? 'null',
      ),
    ).toMatchObject({ version: 1, branding: readyBranding });
    queryClient.clear();
  });
});

describe('useResolvedBranding', () => {
  it('reutiliza o branding do mesmo host sem forçar nova busca a cada montagem', async () => {
    const host = 'escola.example.com';
    const readyBranding: PublicBranding = {
      ...staleBranding,
      displayName: 'Escola atual',
      logoUrl: null,
      faviconUrl: null,
      loginBackgroundUrl: null,
    };
    const resolveSpy = vi
      .spyOn(brandingService, 'resolveForHostname')
      .mockResolvedValue(readyBranding);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const first = renderHook(
      () => useResolvedBranding(host),
      { wrapper },
    );

    await waitFor(() => expect(first.result.current.data).toEqual(readyBranding));

    const second = renderHook(
      () => useResolvedBranding(host),
      { wrapper },
    );

    expect(second.result.current.data).toEqual(readyBranding);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    first.unmount();
    second.unmount();
    queryClient.clear();
  });

  it('restaura o branding do mesmo host e só publica a resposta após pre-carregar os assets', async () => {
    const host = window.location.hostname;
    localStorage.setItem(
      `tecescola:public-branding:${host}`,
      JSON.stringify({
        version: 1,
        cachedAt: Date.now() - PUBLIC_BRANDING_STALE_TIME - 1,
        branding: staleBranding,
      }),
    );

    const currentBranding: PublicBranding = {
      ...staleBranding,
      displayName: 'Escola atual',
      documentTitle: 'Colégio atual',
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
      naturalHeight: number;
      src: string;
      decode: ReturnType<typeof vi.fn>;
    }> = [];
    class ControlledImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      complete = false;
      naturalWidth = 100;
      naturalHeight = 100;
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

    expect(result.current.data).toEqual(staleBranding);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isInitialBrandingLoading).toBe(true);
    expect(resolveSpy).not.toHaveBeenCalled();

    await waitFor(() => expect(images).toHaveLength(3));
    expect(new Set(images.map((image) => image.src))).toEqual(
      new Set([
        staleBranding.logoUrl,
        staleBranding.faviconUrl,
        staleBranding.loginBackgroundUrl,
      ]),
    );

    await act(async () => {
      images.forEach((image) => {
        image.complete = true;
        image.onload?.(new Event('load'));
      });
    });
    await waitFor(() => expect(resolveSpy).toHaveBeenCalledWith(host));

    await act(async () => {
      resolveBranding(currentBranding);
      await response;
    });
    await waitFor(() => expect(images).toHaveLength(6));
    expect(document.title).toBe('Colégio atual');
    expect(new Set(images.slice(3).map((image) => image.src))).toEqual(
      new Set([
        currentBranding.logoUrl,
        currentBranding.faviconUrl,
        currentBranding.loginBackgroundUrl,
      ]),
    );
    expect(result.current.data).toEqual(staleBranding);

    await act(async () => {
      images.slice(3).forEach((image) => {
        image.complete = true;
        image.onload?.(new Event('load'));
      });
    });

    await waitFor(() => expect(result.current.data).toEqual(currentBranding));
    expect(result.current.isInitialBrandingLoading).toBe(false);
    expect(resolveSpy).toHaveBeenCalledWith(host);
    expect(
      JSON.parse(
        localStorage.getItem(`tecescola:public-branding:${host}`) ?? 'null',
      ),
    ).toMatchObject({
      version: 1,
      branding: currentBranding,
    });

    unmount();
    queryClient.clear();
  });

  it('descarta branding generico antigo no subdominio de uma escola', async () => {
    const host = 'colegio-exemplo.grupotec.dev.br';
    const cacheKey = `tecescola:public-branding:${host}`;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        version: 1,
        cachedAt: Date.now(),
        branding: {
          ...staleBranding,
          scope: 'FALLBACK',
          displayName: 'Tec Escola',
          logoUrl: null,
          faviconUrl: null,
          loginBackgroundUrl: null,
        },
      }),
    );
    const institutionBranding: PublicBranding = {
      ...staleBranding,
      displayName: 'Colégio Exemplo',
      logoUrl: null,
      faviconUrl: null,
      loginBackgroundUrl: null,
    };
    const resolveSpy = vi
      .spyOn(brandingService, 'resolveForHostname')
      .mockResolvedValue(institutionBranding);
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
    expect(localStorage.getItem(cacheKey)).toBeNull();
    await waitFor(() => expect(result.current.data).toEqual(institutionBranding));
    expect(resolveSpy).toHaveBeenCalledWith(host);
    expect(
      JSON.parse(localStorage.getItem(cacheKey) ?? 'null').branding.scope,
    ).toBe('INSTITUTION');

    unmount();
    queryClient.clear();
  });

  it('nao confunde o cache inicial do primeiro leitor com assets prontos no segundo', async () => {
    const host = window.location.hostname;
    localStorage.setItem(
      `tecescola:public-branding:${host}`,
      JSON.stringify({
        version: 1,
        cachedAt: Date.now(),
        branding: staleBranding,
      }),
    );
    const images: Array<{
      onload: ((event: Event) => void) | null;
      complete: boolean;
      naturalWidth: number;
      naturalHeight: number;
      src: string;
      decode: ReturnType<typeof vi.fn>;
    }> = [];
    class ControlledImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      complete = false;
      naturalWidth = 100;
      naturalHeight = 100;
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

    const first = renderHook(() => useResolvedBranding(host), { wrapper });
    const second = renderHook(() => useResolvedBranding(host), { wrapper });

    expect(first.result.current.isInitialBrandingLoading).toBe(true);
    expect(second.result.current.isInitialBrandingLoading).toBe(true);
    await waitFor(() => expect(images).toHaveLength(3));

    await act(async () => {
      images.forEach((image) => {
        image.complete = true;
        image.onload?.(new Event('load'));
      });
    });

    await waitFor(() => {
      expect(first.result.current.isInitialBrandingLoading).toBe(false);
      expect(second.result.current.isInitialBrandingLoading).toBe(false);
    });
    expect(images).toHaveLength(3);

    first.unmount();
    second.unmount();
    queryClient.clear();
  });

  it('mantem o ultimo branding quando a revalidacao da aba falha', async () => {
    const host = 'escola.example.com';
    localStorage.setItem(
      `tecescola:public-branding:${host}`,
      JSON.stringify({
        version: 1,
        cachedAt: Date.now() - PUBLIC_BRANDING_STALE_TIME - 1,
        branding: staleBranding,
      }),
    );
    const resolveSpy = vi
      .spyOn(brandingService, 'resolveForHostname')
      .mockRejectedValue(new Error('network unavailable'));
    class CachedImage {
      complete = true;
      naturalWidth = 100;
      naturalHeight = 100;
      src = '';
    }
    vi.stubGlobal('Image', CachedImage);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result, unmount } = renderHook(
      () => useResolvedBranding(host),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toEqual(staleBranding);
    expect(result.current.isLoading).toBe(false);
    expect(resolveSpy).toHaveBeenCalledWith(host);

    unmount();
    queryClient.clear();
  });

  it('nao publica asset cujo preload falhou para evitar uma pintura atrasada', async () => {
    class FailedImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      complete = false;
      naturalWidth = 0;
      src = '';

      constructor() {
        queueMicrotask(() => this.onerror?.(new Event('error')));
      }
    }
    vi.stubGlobal('Image', FailedImage);

    const result = await preloadPublicBrandingAssets({
      ...staleBranding,
      loginBackgroundUrl:
        'https://cdn.example.com/current-background.png',
    });

    expect(result.logoUrl).toBeNull();
    expect(result.faviconUrl).toBeNull();
    expect(result.loginBackgroundUrl).toBeNull();
  });
  it('preserva assets anteriores quando o preload da revalidacao falha', async () => {
    class FailedImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      complete = false;
      naturalWidth = 0;
      src = '';

      constructor() {
        queueMicrotask(() => this.onerror?.(new Event('error')));
      }
    }
    vi.stubGlobal('Image', FailedImage);

    const refreshedBranding: PublicBranding = {
      ...staleBranding,
      logoUrl: 'https://cdn.example.com/new-logo.png',
      faviconUrl: 'https://cdn.example.com/new-favicon.png',
      loginBackgroundUrl: 'https://cdn.example.com/new-background.png',
    };
    const result = await preloadPublicBrandingAssets(
      refreshedBranding,
      staleBranding,
    );

    expect(result.logoUrl).toBe(staleBranding.logoUrl);
    expect(result.faviconUrl).toBe(staleBranding.faviconUrl);
    expect(result.loginBackgroundUrl).toBe(staleBranding.loginBackgroundUrl);
  });

  it('preserva o favicon institucional quando a imagem e retangular', async () => {
    class DimensionedImage {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      complete = false;
      naturalWidth = 100;
      naturalHeight = 100;
      src = '';

      constructor() {
        queueMicrotask(() => {
          if (this.src.includes('favicon')) {
            this.naturalWidth = 1774;
            this.naturalHeight = 887;
          }
          this.complete = true;
          this.onload?.(new Event('load'));
        });
      }
    }
    vi.stubGlobal('Image', DimensionedImage);

    const result = await preloadPublicBrandingAssets(staleBranding);

    expect(result.logoUrl).toBe(staleBranding.logoUrl);
    expect(result.faviconUrl).toBe(staleBranding.faviconUrl);
    expect(result.loginBackgroundUrl).toBe(staleBranding.loginBackgroundUrl);
  });
});
