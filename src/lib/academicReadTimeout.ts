export const ACADEMIC_READ_TIMEOUT_MS = 10_000;

export const ACADEMIC_ATTENDANCE_SUMMARY_TIMEOUT_MS = 30_000;

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    name?: string;
    message?: string;
  };

  return (
    candidate.name === 'AbortError' ||
    candidate.message?.toLowerCase().includes('aborted') === true
  );
}

export async function withAcademicReadTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = ACADEMIC_READ_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const operationPromise = Promise.resolve().then(() =>
    operation(controller.signal),
  );
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      const error = new Error('A leitura excedeu o tempo limite configurado.');
      error.name = 'AbortError';
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
