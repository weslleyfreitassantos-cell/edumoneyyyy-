const PRINT_ASSET_TIMEOUT_MS = 3000;

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

export async function printDocument(rootSelector?: string): Promise<void> {
  const root = rootSelector ? document.querySelector(rootSelector) : document;
  const images = root ? Array.from(root.querySelectorAll('img')) : [];

  await waitForAsset(Promise.all(images.map((image) =>
    typeof image.decode === 'function' ? image.decode() : Promise.resolve(),
  )));

  if (document.fonts?.ready) {
    await waitForAsset(document.fonts.ready);
  }

  window.print();
}
