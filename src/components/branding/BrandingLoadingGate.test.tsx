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
  it('mantém as rotas montadas sob o carregamento do branding', () => {
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
    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
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
  it('mantém a bolinha durante qualquer revalidação do branding', () => {
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

    expect(screen.getByRole('status', { name: /identidade visual/i })).toBeTruthy();
    expect(screen.getByText('Conteúdo da escola')).toBeTruthy();
  });

  it('mostra a ação de recuperação quando a consulta falha', () => {
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

    expect(screen.queryByText('Conteúdo da escola')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
