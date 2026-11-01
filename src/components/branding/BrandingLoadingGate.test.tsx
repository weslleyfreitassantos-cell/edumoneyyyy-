// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useResolvedBranding } from '../../hooks/useBranding';
import { defaultFaviconHref } from '../../services/documentBranding';
import BrandingLoadingGate from './BrandingLoadingGate';

vi.mock('../../hooks/useBranding', () => ({
  useResolvedBranding: vi.fn(),
}));

const mockedUseResolvedBranding = vi.mocked(useResolvedBranding);

function renderGate(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BrandingLoadingGate>
        <div>Conteúdo da escola</div>
      </BrandingLoadingGate>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  document.querySelector('link[rel="icon"]')?.remove();
  vi.clearAllMocks();
});

describe('BrandingLoadingGate', () => {
  it('mantém as rotas utilizáveis enquanto a identidade inicial carrega', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: true,
      isInitialBrandingLoading: true,
      isError: false,
    } as never);

    renderGate('/login');

    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
    expect(screen.queryByRole('status', { name: /identidade visual/i })).toBeNull();
  });

  it('aplica o favicon em cache antes de terminar a preparação das imagens', () => {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = defaultFaviconHref;
    document.head.appendChild(favicon);
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: true,
      isInitialBrandingLoading: true,
      isError: false,
      data: {
        scope: 'INSTITUTION',
        faviconUrl: 'https://cdn.example.com/school-favicon.png',
      },
    } as never);

    renderGate('/login');

    expect(favicon.href).toBe('https://cdn.example.com/school-favicon.png');
    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
  });

  it('continua aguardando identidade nas rotas internas', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: true,
      isInitialBrandingLoading: true,
      isError: false,
    } as never);

    renderGate('/dashboard');

    expect(screen.getByRole('status', { name: /identidade visual/i })).toBeTruthy();
    expect(screen.queryByText('Conteúdo da escola')).toBeNull();
  });

  it('mostra as rotas quando o branding já está pronto', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: false,
      isInitialBrandingLoading: false,
      isError: false,
    } as never);

    renderGate('/dashboard');

    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
  });
  it('mantém as rotas visíveis durante uma revalidação em segundo plano', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: false,
      isFetching: true,
      isFetchedAfterMount: true,
      isError: false,
      data: { scope: 'INSTITUTION' },
    } as never);

    renderGate('/dashboard');

    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
    expect(screen.queryByRole('status', { name: /identidade visual/i })).toBeNull();
  });

  it('mantém as rotas durante uma falha de revalidação com branding anterior', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: false,
      isError: true,
      data: { scope: 'GLOBAL' },
    } as never);

    renderGate('/login');

    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mantém as rotas utilizáveis quando a primeira consulta falha', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    } as never);

    renderGate('/login');

    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
