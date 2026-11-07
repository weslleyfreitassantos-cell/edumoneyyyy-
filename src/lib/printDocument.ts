const PRINT_ASSET_TIMEOUT_MS = 3000;
const PRINT_STYLE_TIMEOUT_MS = 60_000;

export interface PrintDocumentOptions {
  orientation?: 'portrait' | 'landscape';
}

let cleanupPendingPageStyle: (() => void) | undefined;

async function waitForAsset(promise: Promise<unknown>): Promise<void> {
  let timeoutId: number | undefined;
  await Promise.race([
    promise.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => {
      timeoutId = window.setTimeout(resolve, PRINT_ASSET_TIMEOUT_MS);
    }),
  ]);
  if (timeoutId !== undefined) window.clearTimeout(timeoutId);
}

export async function printDocument(
  rootSelector?: string,
  options: PrintDocumentOptions = {},
): Promise<void> {
  cleanupPendingPageStyle?.();

  const root = rootSelector ? document.querySelector(rootSelector) : document;
  const images = root ? Array.from(root.querySelectorAll('img')) : [];

  await waitForAsset(Promise.all(images.map((image) =>
    typeof image.decode === 'function' ? image.decode() : Promise.resolve(),
  )));

  if (document.fonts?.ready) {
    await waitForAsset(document.fonts.ready);
  }

  if (options.orientation) {
    const style = document.createElement('style');
    style.media = 'print';
    style.dataset.printPageStyle = 'true';
    style.textContent = `@page { size: A4 ${options.orientation}; margin: 10mm; }`;
    document.head.append(style);

    let timeoutId: number;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('afterprint', cleanup);
      style.remove();
      if (cleanupPendingPageStyle === cleanup) cleanupPendingPageStyle = undefined;
    };

    cleanupPendingPageStyle = cleanup;
    window.addEventListener('afterprint', cleanup, { once: true });
    timeoutId = window.setTimeout(cleanup, PRINT_STYLE_TIMEOUT_MS);
  }

  window.print();
}
