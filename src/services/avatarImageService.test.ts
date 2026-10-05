// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AVATAR_OUTPUT_HEIGHT,
  AVATAR_OUTPUT_WIDTH,
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
  it('accepts supported input formats without an artificial size limit', () => {
    expect(() => validateAvatarFile(file('image/jpeg', 1024))).not.toThrow();
    expect(() => validateAvatarFile(file('image/png', 1024))).not.toThrow();
    expect(() => validateAvatarFile(file('image/webp', 6 * 1024 * 1024))).not.toThrow();
  });

  it('rejects unsupported files before processing', () => {
    expect(() => validateAvatarFile(file('image/svg+xml', 1024))).toThrowError(
      expect.objectContaining<Partial<AvatarFileError>>({
        code: 'INVALID_FILE_TYPE',
      }),
    );
  });

  it.each([
    { width: 128, height: 128 },
    { width: 400, height: 600 },
    { width: 2000, height: 3000 },
  ])(
    'fills the vertical WebP frame with an automatic cover crop for $width x $height',
    async ({ width, height }) => {
      const bitmap = {
        width,
        height,
        close: vi.fn(),
      };
      const canvasSizes: Array<{ width: number; height: number }> = [];
      const drawCalls: unknown[][] = [];

      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(bitmap),
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue({ drawImage: (...args: unknown[]) => drawCalls.push(args) } as never);
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
        { width: AVATAR_OUTPUT_WIDTH, height: AVATAR_OUTPUT_HEIGHT },
      ]);
      expect(drawCalls).toHaveLength(1);
      const [, x, y, drawnWidth, drawnHeight] = drawCalls[0] as [
        CanvasImageSource,
        number,
        number,
        number,
        number,
      ];
      expect(drawnWidth).toBeGreaterThanOrEqual(AVATAR_OUTPUT_WIDTH);
      expect(drawnHeight).toBeGreaterThanOrEqual(AVATAR_OUTPUT_HEIGHT);
      expect(x).toBeLessThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(0);
      expect(x + drawnWidth).toBeGreaterThanOrEqual(AVATAR_OUTPUT_WIDTH);
      expect(y + drawnHeight).toBeGreaterThanOrEqual(AVATAR_OUTPUT_HEIGHT);
      expect(bitmap.close).toHaveBeenCalledOnce();
    },
  );
});
