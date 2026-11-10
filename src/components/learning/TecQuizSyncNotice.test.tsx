// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TecQuizSyncNotice from './TecQuizSyncNotice';

describe('TecQuizSyncNotice', () => {
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
});
