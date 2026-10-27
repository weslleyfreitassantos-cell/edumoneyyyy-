// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AppVersionRefreshGuard from './AppVersionRefreshGuard';

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('AppVersionRefreshGuard', () => {
  it('notifica quando a aba retoma com um bundle antigo sem recarregar sozinha', async () => {
    document.head.innerHTML =
      '<script type="module" src="/assets/index-old.js"></script>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<script type="module" src="/assets/index-new.js"></script>',
      }),
    );

    render(<AppVersionRefreshGuard />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Atualizar agora' })).toBeTruthy();
  });

});
