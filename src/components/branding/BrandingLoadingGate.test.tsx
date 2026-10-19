// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useResolvedBranding } from '../../hooks/useBranding';
import BrandingLoadingGate from './BrandingLoadingGate';

vi.mock('../../hooks/useBranding', () => ({
  useResolvedBranding: vi.fn(),
}));

const mockedUseResolvedBranding = vi.mocked(useResolvedBranding);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BrandingLoadingGate', () => {
  it('aguarda a identidade inicial antes de montar as rotas', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: true,
      isError: false,
    } as never);

    render(
      <BrandingLoadingGate>
        <div>Conteúdo da escola</div>
      </BrandingLoadingGate>,
    );

    expect(screen.getByRole('status', { name: /identidade visual/i })).toBeTruthy();
    expect(screen.queryByText('Conteúdo da escola')).toBeNull();
  });

  it('mostra as rotas quando o branding já está pronto', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: false,
      isError: false,
    } as never);

    render(
      <BrandingLoadingGate>
        <div>Conteúdo da escola</div>
      </BrandingLoadingGate>,
    );

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

    render(
      <BrandingLoadingGate>
        <div>Conteúdo da escola</div>
      </BrandingLoadingGate>,
    );

    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
    expect(screen.queryByRole('status', { name: /identidade visual/i })).toBeNull();
  });

  it('mantém as rotas durante uma falha de revalidação com branding anterior', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: false,
      isError: true,
      data: { scope: 'GLOBAL' },
    } as never);

    render(
      <BrandingLoadingGate>
        <div>Conteúdo da escola</div>
      </BrandingLoadingGate>,
    );

    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mostra ação de recuperação quando a primeira consulta falha', () => {
    mockedUseResolvedBranding.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    } as never);

    render(
      <BrandingLoadingGate>
        <div>Conteúdo da escola</div>
      </BrandingLoadingGate>,
    );

    expect(screen.queryByText('Conteúdo da escola')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeTruthy();
  });
});
