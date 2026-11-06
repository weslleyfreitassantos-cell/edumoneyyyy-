// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { printDocument } from './printDocument';

describe('printDocument', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('waits for document images to decode before opening print', async () => {
    document.body.innerHTML = '<section id="document"><img src="school-logo.png" /></section>';
    const image = document.querySelector('img')!;
    let finishDecode!: () => void;
    const decode = vi.fn(() => new Promise<void>((resolve) => { finishDecode = resolve; }));
    Object.defineProperty(image, 'decode', { configurable: true, value: decode });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    const printing = printDocument('#document');
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();

    finishDecode();
    await printing;

    expect(decode).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
  });
});
