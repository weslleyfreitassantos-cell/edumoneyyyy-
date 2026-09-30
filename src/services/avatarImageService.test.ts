import { describe, expect, it } from 'vitest';

import {
  AVATAR_MAX_FILE_SIZE,
  AvatarFileError,
  validateAvatarFile,
} from './avatarImageService';

function file(type: string, size: number): File {
  return {
    type,
    size,
  } as File;
}

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
});
