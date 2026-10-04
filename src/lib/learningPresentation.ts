const SUBJECT_LABELS: Record<string, string> = {
  ARTE: 'Arte',
  BIOLOGY: 'Biologia',
  BIOLOGIA: 'Biologia',
  COMPUTING: 'Computação',
  'EDUCACAO FISICA': 'Educação Física',
  ENGLISH: 'Língua Inglesa',
  FILOSOFIA: 'Filosofia',
  FISICA: 'Física',
  GEOGRAPHY: 'Geografia',
  GEOGRAFIA: 'Geografia',
  HISTORY: 'História',
  HISTORIA: 'História',
  MATEMATICA: 'Matemática',
  MATHEMATICS: 'Matemática',
  PORTUGUESE: 'Língua Portuguesa',
  'LINGUA INGLESA': 'Língua Inglesa',
  'LINGUA PORTUGUESA': 'Língua Portuguesa',
  QUIMICA: 'Química',
  SOCIOLOGIA: 'Sociologia',
};

const SKILL_LABELS: Record<string, string> = {
  ART_CONTEXT: 'Contextualização artística',
  ART_ELEMENTS: 'Elementos da linguagem visual',
  ART_INTERPRETATION: 'Interpretação de obras',
  MATH_PERCENT_OF_QUANTITY: 'Porcentagem de uma quantidade',
  PHYSICS_AVERAGE_SPEED: 'Velocidade média',
};

function key(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function humanizeSubjectArea(value: string | null | undefined): string {
  if (!value) return 'Matéria';
  return SUBJECT_LABELS[key(value)] ?? value
    .toLocaleLowerCase('pt-BR')
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

export function humanizeSkill(value: string | null | undefined, fallback?: string | null): string {
  if (fallback?.trim()) return fallback.trim();
  if (!value) return 'este conceito';
  if (SKILL_LABELS[value]) return SKILL_LABELS[value];
  return value
    .split('_')
    .filter(Boolean)
    .slice(1)
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('pt-BR')) || 'este conceito';
}

export function humanizeDecisionReason(value: string | null | undefined): string {
  if (!value) return 'precisa de uma decisão pedagógica';
  const labels: Record<string, string> = {
    DIAGNOSTIC_NEEDED: 'precisa de uma verificação inicial',
    PRIMARY_SKILL_LOW_EVIDENCE: 'ainda tem pouca evidência de aprendizagem',
    PREREQUISITE_CONFIRMED_GAP: 'precisa fortalecer um conhecimento anterior',
    RETURN_TO_ORIGINAL_TARGET: 'pode retomar o objetivo principal',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLocaleLowerCase('pt-BR');
}

export function humanizePackageTitle(title: string, subjectArea?: string | null): string {
  const normalized = title.replace(/^conteúdo padrão\s*[—-]\s*/i, '').trim();
  if (!normalized || normalized.toLocaleLowerCase('pt-BR') === 'mathematics' || normalized.toLocaleLowerCase('pt-BR') === 'matemática') {
    return `Conteúdo de ${humanizeSubjectArea(subjectArea)}`;
  }
  return normalized.replace(/\bMathematics\b/gi, 'Matemática').replace(/\bEnglish\b/gi, 'Língua Inglesa');
}

export function humanizePackageSource(source: string | null | undefined): string {
  const labels: Record<string, string> = {
    TECESCOLA: 'TecEscola',
    ENEM: 'ENEM',
    INSTITUTION: 'Escola',
    TEACHER: 'Professor',
  };
  const normalized = source?.trim().toUpperCase() ?? '';
  return labels[normalized] ?? humanizeSubjectArea(source);
}

export function humanizeDifficulty(value: string | null | undefined): string | null {
  if (!value) return null;
  const labels: Record<string, string> = { EASY: 'Fácil', MEDIUM: 'Média', HARD: 'Difícil' };
  return labels[value.toUpperCase()] ?? value.toLocaleLowerCase('pt-BR');
}

export function packagePresentationKey(title: string, subjectArea?: string | null): string {
  return `${humanizeSubjectArea(subjectArea)}:${humanizePackageTitle(title, subjectArea)}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}
