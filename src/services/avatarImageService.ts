export const AVATAR_OUTPUT_WIDTH = 384;
export const AVATAR_OUTPUT_HEIGHT = 512;
export const AVATAR_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AvatarFileErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'IMAGE_PROCESSING_FAILED';

export class AvatarFileError extends Error {
  constructor(
    public readonly code: AvatarFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AvatarFileError';
  }
}

export function validateAvatarFile(file: File): void {
  if (
    !AVATAR_ACCEPTED_MIME_TYPES.includes(
      file.type as (typeof AVATAR_ACCEPTED_MIME_TYPES)[number],
    )
  ) {
    throw new AvatarFileError(
      'INVALID_FILE_TYPE',
      'Escolha uma imagem JPG, PNG ou WebP.',
    );
  }

}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_WIDTH;
  canvas.height = AVATAR_OUTPUT_HEIGHT;
  return canvas;
}

function drawContained(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): void {
  const scale = Math.min(
    AVATAR_OUTPUT_WIDTH / sourceWidth,
    AVATAR_OUTPUT_HEIGHT / sourceHeight,
  );
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;

  context.filter = 'none';
  context.globalAlpha = 1;
  context.drawImage(
    source,
    (AVATAR_OUTPUT_WIDTH - drawnWidth) / 2,
    (AVATAR_OUTPUT_HEIGHT - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
}

function drawFilledBackground(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): void {
  const scale = Math.max(
    AVATAR_OUTPUT_WIDTH / sourceWidth,
    AVATAR_OUTPUT_HEIGHT / sourceHeight,
  );
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;

  context.filter = 'blur(18px)';
  context.globalAlpha = 0.42;
  context.drawImage(
    source,
    (AVATAR_OUTPUT_WIDTH - drawnWidth) / 2,
    (AVATAR_OUTPUT_HEIGHT - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
  context.filter = 'none';
  context.globalAlpha = 1;
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== 'image/webp') {
          reject(
            new AvatarFileError(
              'IMAGE_PROCESSING_FAILED',
              'Não foi possível preparar a imagem para o upload.',
            ),
          );
          return;
        }

        resolve(blob);
      },
      'image/webp',
      0.86,
    );
  });
}

async function prepareWithImageBitmap(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });

  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    const canvas = createCanvas();
    const context = canvas.getContext('2d');

    if (!context) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    drawFilledBackground(
      context,
      bitmap,
      bitmap.width,
      bitmap.height,
    );
    drawContained(
      context,
      bitmap,
      bitmap.width,
      bitmap.height,
    );

    return await canvasToWebp(canvas);
  } finally {
    bitmap.close();
  }
}

async function prepareWithImageElement(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () =>
          reject(
            new AvatarFileError(
              'IMAGE_PROCESSING_FAILED',
              'Não foi possível ler a imagem selecionada.',
            ),
          );
        element.src = objectUrl;
      },
    );

    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    const canvas = createCanvas();
    const context = canvas.getContext('2d');

    if (!context) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    drawFilledBackground(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
    );
    drawContained(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
    );

    return await canvasToWebp(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareAvatarImage(file: File): Promise<Blob> {
  validateAvatarFile(file);

  try {
    if (typeof createImageBitmap === 'function') {
      return await prepareWithImageBitmap(file);
    }

    return await prepareWithImageElement(file);
  } catch (error) {
    if (error instanceof AvatarFileError) {
      throw error;
    }

    throw new AvatarFileError(
      'IMAGE_PROCESSING_FAILED',
      'Não foi possível preparar a imagem para o upload.',
    );
  }
}
