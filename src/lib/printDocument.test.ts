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

  it('applies the requested page orientation only during printing', async () => {
    document.body.innerHTML = '<section id="report">Report</section>';
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    await printDocument('#report', { orientation: 'landscape' });

    const style = document.head.querySelector<HTMLStyleElement>('[data-print-page-style="true"]');
    expect(style?.media).toBe('print');
    expect(style?.textContent).toContain('@page { size: A4 landscape;');
    expect(print).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('afterprint'));
    expect(document.head.querySelector('[data-print-page-style="true"]')).toBeNull();
  });
});
