export interface UserFacingError {
  code: string;
  title: string;
  message: string;
  retryable: boolean;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '';
}

function readErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return '';
}

function isTechnicalError(error: unknown, message: string): boolean {
  const normalized = `${readErrorCode(error)} ${message}`.toLowerCase();

  return [
    'pgrst',
    'postgrest',
    'postgres',
    'sql',
    'statement timeout',
    'canceling statement',
    'row-level security',
    'violates',
    'constraint',
    'foreign key',
    'duplicate key',
    'internal server error',
    'failed to fetch',
    'fetch failed',
    'network',
    'jwt',
    'authorization',
    'supabase',
  ].some((term) => normalized.includes(term));
}

export function toUserFacingError(error: unknown): UserFacingError {
  const raw = readErrorMessage(error);
  const normalized = raw.toLowerCase();

  if (normalized.includes('statement timeout') || normalized.includes('canceling statement')) {
    return {
      code: 'TIMEOUT',
      title: 'Operação demorada',
      message: 'Esta operação demorou mais que o esperado. Tente novamente.',
      retryable: true,
    };
  }

  if (normalized.includes('duplicate key') || normalized.includes('23505') || normalized.includes('unique constraint')) {
    return {
      code: 'CONFLICT',
      title: 'Conflito de dados',
      message: 'Os dados já foram cadastrados ou alterados por outra operação.',
      retryable: false,
    };
  }

  if (normalized.includes('foreign key') || normalized.includes('23503') || normalized.includes('violates constraint')) {
    return {
      code: 'INVALID_RELATION',
      title: 'Dados relacionados inválidos',
      message: 'Revise os dados relacionados e tente novamente.',
      retryable: false,
    };
  }

  if (normalized.includes('network') || normalized.includes('failed to fetch') || normalized.includes('fetch failed')) {
    return {
      code: 'NETWORK',
      title: 'Falha de conexão',
      message: 'Não foi possível conectar ao serviço. Tente novamente.',
      retryable: true,
    };
  }

  return {
    code: 'UNKNOWN',
    title: 'Não foi possível concluir',
    message: 'Não foi possível concluir a operação. Tente novamente.',
    retryable: true,
  };
}

export function getUserFacingErrorMessage(error: unknown, fallback?: string): string {
  const result = toUserFacingError(error);
  const raw = readErrorMessage(error).trim();

  // Services in the admin flow already throw translated business messages.
  // Keep those messages, but never let provider/database diagnostics reach the UI.
  if (result.code === 'UNKNOWN' && raw.length >= 25 && !isTechnicalError(error, raw)) {
    return raw;
  }

  return result.code === 'UNKNOWN' && fallback ? fallback : result.message;
}
