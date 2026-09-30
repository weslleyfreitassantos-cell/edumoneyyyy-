// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AVATAR_MAX_FILE_SIZE,
  prepareAvatarImage,
  AvatarFileError,
  validateAvatarFile,
} from './avatarImageService';

function file(type: string, size: number): File {
  return {
    type,
    size,
  } as File;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('avatarImageService', () => {
  it('accepts the supported input formats under the size limit', () => {
    expect(() => validateAvatarFile(file('image/jpeg', 1024))).not.toThrow();
    expect(() => validateAvatarFile(file('image/png', 1024))).not.toThrow();
    expect(() => validateAvatarFile(file('image/webp', AVATAR_MAX_FILE_SIZE))).not.toThrow();
  });

  it('rejects unsupported files before processing', () => {
    expect(() => validateAvatarFile(file('image/svg+xml', 1024))).toThrowError(
      expect.objectContaining<Partial<AvatarFileError>>({
        code: 'INVALID_FILE_TYPE',
      }),
    );
  });

  it('rejects files larger than 5 MiB', () => {
    expect(() => validateAvatarFile(file('image/jpeg', AVATAR_MAX_FILE_SIZE + 1))).toThrowError(
      expect.objectContaining<Partial<AvatarFileError>>({
        code: 'FILE_TOO_LARGE',
      }),
    );
  });

  it.each([
    { width: 128, height: 128, outputSize: 128 },
    { width: 400, height: 600, outputSize: 400 },
    { width: 2000, height: 3000, outputSize: 512 },
  ])(
    'does not upscale and keeps a square WebP output for $width x $height',
    async ({ width, height, outputSize }) => {
      const bitmap = {
        width,
        height,
        close: vi.fn(),
      };
      const canvasSizes: Array<{ width: number; height: number }> = [];

      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(bitmap),
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue({ drawImage: vi.fn() } as never);
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
        .mockImplementation(function (callback) {
          canvasSizes.push({ width: this.width, height: this.height });
          callback(new Blob(['webp'], { type: 'image/webp' }));
        });

      const result = await prepareAvatarImage(
        new File(['source'], 'avatar.png', { type: 'image/png' }),
      );

      expect(result.type).toBe('image/webp');
      expect(canvasSizes).toEqual([
        { width: outputSize, height: outputSize },
      ]);
      expect(bitmap.close).toHaveBeenCalledOnce();
    },
  );
});
