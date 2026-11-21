export type EnemSimulationStartFailure = {
  message: string;
  diagnosticCode: string | null;
};

const KNOWN_START_ERRORS: Record<string, string> = {
  ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT:
    "Ainda não há questões oficiais aprovadas suficientes para esta prática e idioma.",
  LEARNING_STUDENT_SCOPE_DENIED:
    "Não foi possível confirmar sua matrícula ativa nesta instituição. Confira seu vínculo com a escola.",
  LEARNING_SIMULATION_NOT_FOUND:
    "Esta prática não está mais disponível. Volte à Central de Estudos e escolha outra.",
};

function errorCode(error: unknown) {
  const candidate = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown }
    : {};
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const safeCode = `${code} ${message}`.match(/\b(?:ENEM|LEARNING)_[A-Z0-9_]+\b/);
  return safeCode?.[0] ?? null;
}

export function describeEnemSimulationStartError(
  error: unknown,
): EnemSimulationStartFailure {
  const diagnosticCode = errorCode(error);
  if (diagnosticCode && KNOWN_START_ERRORS[diagnosticCode]) {
    return { message: KNOWN_START_ERRORS[diagnosticCode], diagnosticCode };
  }
  if (diagnosticCode) {
    return {
      message: `Não foi possível iniciar o simulado (${diagnosticCode}). Tente novamente; se persistir, informe este código à escola.`,
      diagnosticCode,
    };
  }
  return {
    message: "Não foi possível iniciar o simulado agora. Tente novamente; se o problema continuar, volte à Central de Estudos e tente mais tarde.",
    diagnosticCode: null,
  };
}
