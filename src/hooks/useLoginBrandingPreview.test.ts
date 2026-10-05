// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLoginBrandingPreview } from './useLoginBrandingPreview';

describe('useLoginBrandingPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restaura a posição da página ao voltar da pré-visualização', async () => {
    Object.defineProperty(window, 'scrollX', {
      configurable: true,
      value: 18,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 642,
    });

    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const { result } = renderHook(() => useLoginBrandingPreview());

    act(() => {
      result.current.openPreview('mobile');
    });
    expect(result.current.previewMode).toBe('mobile');

    act(() => {
      result.current.closePreview();
    });

    expect(scrollTo).toHaveBeenCalledWith({
      left: 18,
      top: 642,
      behavior: 'auto',
    });
  });
});
