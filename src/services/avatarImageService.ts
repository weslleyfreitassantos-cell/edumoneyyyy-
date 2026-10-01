export const AVATAR_MAX_DIMENSION = 512;
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

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function getOutputSize(cropSize: number): number {
  return Math.min(AVATAR_MAX_DIMENSION, cropSize);
}

function drawContained(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  outputSize: number,
): void {
  const scale = Math.min(
    outputSize / sourceWidth,
    outputSize / sourceHeight,
  );
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;

  context.drawImage(
    source,
    (outputSize - drawnWidth) / 2,
    (outputSize - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
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
    const cropSize = Math.min(bitmap.width, bitmap.height);

    if (cropSize <= 0) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    const outputSize = getOutputSize(cropSize);
    const canvas = createCanvas(outputSize);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    drawContained(
      context,
      bitmap,
      bitmap.width,
      bitmap.height,
      outputSize,
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

    const cropSize = Math.min(image.naturalWidth, image.naturalHeight);

    if (cropSize <= 0) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    const outputSize = getOutputSize(cropSize);
    const canvas = createCanvas(outputSize);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new AvatarFileError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    drawContained(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
      outputSize,
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
