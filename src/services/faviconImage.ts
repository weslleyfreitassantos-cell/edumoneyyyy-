const FAVICON_CANVAS_SIZE = 512;
const FAVICON_PADDING = 18;

export async function normalizeFaviconFile(file: File): Promise<File> {
  if (typeof document === 'undefined') return file;

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Não foi possível ler o favicon.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = FAVICON_CANVAS_SIZE;
    canvas.height = FAVICON_CANVAS_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(
      (canvas.width - FAVICON_PADDING * 2) / image.naturalWidth,
      (canvas.height - FAVICON_PADDING * 2) / image.naturalHeight,
    );
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    context.drawImage(
      image,
      Math.round((canvas.width - width) / 2),
      Math.round((canvas.height - height) / 2),
      width,
      height,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) return file;
    return new File([blob], 'favicon.png', { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
