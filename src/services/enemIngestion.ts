export interface EnemManifestEntry {
  year: number;
  exam: string;
  application: string;
  day: string | null;
  sourceReference: string;
  artifactHash: string | null;
  downloadUrl: string | null;
}

export interface EnemQuestionRow {
  year: number;
  exam: string;
  application: string;
  day: string | null;
  questionNumber: number;
  area: string;
  statement: string;
  options: string[];
  correctAnswer: string | null;
  sourceReference: string;
  artifactHash: string | null;
  classification: {
    subject: string | null;
    topic: string | null;
    canonicalSkillCode: string | null;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;
  };
}

const OFFICIAL_HOSTS = new Set(['gov.br', 'inep.gov.br']);

function isOfficialHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return [...OFFICIAL_HOSTS].some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

export function assertOfficialEnemReference(reference: string) {
  let url: URL;
  try {
    url = new URL(reference);
  } catch {
    throw new Error('ENEM_SOURCE_REFERENCE_INVALID');
  }

  if (url.protocol !== 'https:' || !isOfficialHost(url.hostname)) {
    throw new Error('ENEM_SOURCE_REFERENCE_NOT_OFFICIAL');
  }

  return url.toString();
}

export function validateEnemManifest(entries: EnemManifestEntry[]) {
  const keys = new Set<string>();
  return entries.map((entry) => {
    const sourceReference = assertOfficialEnemReference(entry.sourceReference);
    const key = [entry.year, entry.exam, entry.application, entry.day ?? ''].join(':');
    if (keys.has(key)) throw new Error(`ENEM_MANIFEST_DUPLICATE:${key}`);
    keys.add(key);
    return { ...entry, sourceReference };
  });
}

export function parseEnemQuestionRows(
  rows: Array<{
    questionNumber: number;
    area: string;
    statement: string;
    options?: string[];
    correctAnswer?: string | null;
    subject?: string | null;
    topic?: string | null;
    canonicalSkillCode?: string | null;
    difficulty?: EnemQuestionRow['classification']['difficulty'];
  }>,
  exam: EnemManifestEntry,
) {
  const [validated] = validateEnemManifest([exam]);
  return rows.map<EnemQuestionRow>((row) => ({
    year: validated.year,
    exam: validated.exam,
    application: validated.application,
    day: validated.day,
    questionNumber: row.questionNumber,
    area: row.area,
    statement: row.statement,
    options: row.options ?? [],
    correctAnswer: row.correctAnswer ?? null,
    sourceReference: validated.sourceReference,
    artifactHash: validated.artifactHash,
    classification: {
      subject: row.subject ?? null,
      topic: row.topic ?? null,
      canonicalSkillCode: row.canonicalSkillCode ?? null,
      difficulty: row.difficulty ?? null,
    },
  }));
}
