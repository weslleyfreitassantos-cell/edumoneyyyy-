export const ACADEMIC_READ_TIMEOUT_MS = 10_000;

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
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ACADEMIC_READ_TIMEOUT_MS,
  );

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}
