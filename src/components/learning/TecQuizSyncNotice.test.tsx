// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TecQuizSyncNotice from './TecQuizSyncNotice';

describe('TecQuizSyncNotice', () => {
  afterEach(cleanup);

  it('announces automatic retry while reconnecting', () => {
    render(
      <TecQuizSyncNotice
        failedAttempts={2}
        isRetrying
        maxAttempts={5}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('2/5');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers a manual sync retry after automatic attempts stop', () => {
    const onRetry = vi.fn();
    render(
      <TecQuizSyncNotice
        failedAttempts={5}
        isRetrying={false}
        maxAttempts={5}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Tentar sincronizar agora/i }));
    expect(screen.getByRole('alert').textContent).toContain('parou');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('explains that actions stay blocked until the official server clock is available', () => {
    const onRefresh = vi.fn();
    render(
      <TecQuizSyncNotice
        failedAttempts={0}
        isRetrying={false}
        maxAttempts={5}
        onRetry={vi.fn()}
        clockUnavailable
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('horário oficial do servidor');
    fireEvent.click(screen.getByRole('button', { name: /Atualizar horário/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('announces a missing server deadline recovery without offering client-side progression', () => {
    render(
      <TecQuizSyncNotice
        failedAttempts={0}
        isRetrying={false}
        maxAttempts={5}
        onRetry={vi.fn()}
        deadlineMissing
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('recuperando o prazo');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
