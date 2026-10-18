import { describe, expect, it } from 'vitest';

import { withAcademicReadTimeout } from './academicReadTimeout';

describe('withAcademicReadTimeout', () => {
  it('rejeita uma operação que ignora o AbortSignal', async () => {
    await expect(
      withAcademicReadTimeout(
        () => new Promise<never>(() => undefined),
        5,
      ),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('aborta a operação quando o prazo termina', async () => {
    let aborted = false;

    await expect(
      withAcademicReadTimeout(
        (signal) => new Promise<never>(() => {
          signal.addEventListener('abort', () => {
            aborted = true;
          });
        }),
        5,
      ),
    ).rejects.toMatchObject({ name: 'TimeoutError' });

    expect(aborted).toBe(true);
  });
});
