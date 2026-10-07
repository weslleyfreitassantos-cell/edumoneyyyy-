import { createHash } from 'node:crypto';

import type { CanonicalEnemQuestion } from './canonicalize.ts';

export const ENEM_SUBJECTS = [
  'MATEMATICA',
  'LINGUA_PORTUGUESA',
  'HISTORIA',
  'GEOGRAFIA',
  'FILOSOFIA',
  'SOCIOLOGIA',
  'BIOLOGIA',
  'QUIMICA',
  'FISICA',
  'INGLES',
  'ESPANHOL',
] as const;

export const ENEM_AREAS = [
  'LINGUAGENS',
  'CIENCIAS_HUMANAS',
  'CIENCIAS_NATUREZA',
  'MATEMATICA',
] as const;

export type EnemSubject = typeof ENEM_SUBJECTS[number];
export type EnemArea = typeof ENEM_AREAS[number];
export type ReviewState = 'VERIFIED' | 'CANDIDATE' | 'REVIEW_REQUIRED' | 'REJECTED';

export interface SubjectClassificationRecord {
  canonical_id: string;
  area: EnemArea | null;
  subject: EnemSubject | null;
  area_verified: boolean;
  subject_verified: boolean;
  review_state: ReviewState;
  reason_code: string;
  source_fingerprint: string;
}

const signals: Record<Exclude<EnemSubject, 'MATEMATICA' | 'INGLES' | 'ESPANHOL'>, string[][]> = {
  LINGUA_PORTUGUESA: [
    ['poema', 'poesia', 'romance', 'conto', 'crônica', 'cronica', 'literári', 'literari', 'eu lírico', 'eu lirico', 'canção', 'cancao', 'letra'],
    ['gramática', 'gramatica', 'sintaxe', 'semântica', 'semantica', 'verbo', 'oração', 'oracao', 'gênero textual', 'genero textual', 'variação linguística', 'variacao linguistica'],
    ['leitura', 'interpretação', 'interpretacao', 'língua portuguesa', 'lingua portuguesa', 'texto verbal', 'narrador', 'metáfora', 'metafora', 'discurso', 'linguagem'],
  ],
  HISTORIA: [
    ['história', 'historia', 'histórico', 'historico', 'historiador', 'passado', 'período', 'periodo', 'século', 'seculo', 'década', 'decada'],
    ['império', 'imperio', 'colonial', 'escrav', 'revolução', 'revolucao', 'ditadura', 'república', 'republica', 'independência', 'independencia', 'guerra fria', 'muro de berlim', 'soviét', 'soviet', 'revolta'],
    ['guerra', 'constituição', 'constituicao', 'monarquia', 'renascimento', 'feudal', 'roma antiga', 'grécia', 'grecia', 'antiguidade', 'medieval', 'cuba', 'mali', 'macedônia', 'macedonia', 'cruzado', 'tombuctu'],
  ],
  GEOGRAFIA: [
    ['geografia', 'geográfico', 'geografico', 'cartografia', 'território', 'territorio', 'mapa', 'espacial'],
    ['urban', 'rural', 'migra', 'população', 'populacao', 'agricultur', 'industrialização', 'industrializacao', 'cidade', 'urbano'],
    ['clima', 'relevo', 'solo', 'bacia hidrográfica', 'bacia hidrografica', 'placas tectônicas', 'placas tectonicas', 'paisagem', 'rio', 'geomorfol'],
  ],
  FILOSOFIA: [
    ['filosofia', 'filosófico', 'filosofico', 'ética', 'etica', 'moral', 'filósofo', 'filosofo'],
    ['platão', 'platao', 'aristóteles', 'aristoteles', 'sócrates', 'socrates', 'kant', 'nietzsche', 'marx', 'foucault'],
    ['justiça', 'justica', 'razão', 'razao', 'conhecimento', 'virtude', 'cidadania', 'contrato social', 'verdade', 'pensamento'],
  ],
  SOCIOLOGIA: [
    ['sociologia', 'sociológico', 'sociologico', 'sociedade', 'socialização', 'socializacao', 'social'],
    ['cultura', 'identidade', 'classe social', 'desigualdade', 'movimento social', 'instituição social', 'instituicao social', 'participação social', 'participacao social'],
    ['durkheim', 'weber', 'bourdieu', 'fato social', 'trabalho', 'poder', 'dominação', 'dominacao', 'capital', 'cidadania'],
  ],
  BIOLOGIA: [
    ['biologia', 'biológico', 'biologico', 'célula', 'celula', 'organismo', 'espécie', 'especie', 'enzima', 'gene', 'dna'],
    ['ecologia', 'ecossistema', 'cadeia alimentar', 'biodiversidade', 'evolução', 'evolucao', 'genética', 'genetica', 'seleção natural', 'selecao natural', 'cladograma'],
    ['vírus', 'virus', 'bactéria', 'bacteria', 'metabolismo', 'fotossíntese', 'fotossintese', 'hormônio', 'hormonio', 'fungo', 'reprodução', 'reproducao'],
  ],
  QUIMICA: [
    ['química', 'quimica', 'químico', 'quimico', 'átomo', 'atomo', 'molécula', 'molecula', 'íon', 'ion', 'molar'],
    ['reação química', 'reacao quimica', 'substância', 'substancia', 'solução', 'solucao', 'estequiometria', 'pH', 'solvente', 'catalase'],
    ['orgânico', 'organico', 'inorgânico', 'inorganico', 'oxidação', 'oxidacao', 'catalisador', 'ligação química', 'ligacao quimica', 'metal', 'combustível', 'combustivel'],
  ],
  FISICA: [
    ['física', 'fisica', 'físico', 'fisico', 'mecânica', 'mecanica', 'cinemática', 'cinematica', 'dinâmica', 'dinamica'],
    ['velocidade', 'aceleração', 'aceleracao', 'força', 'forca', 'energia', 'potência', 'potencia', 'movimento', 'pressão', 'pressao'],
    ['elétrica', 'eletrica', 'circuito', 'resistência', 'resistencia', 'onda', 'óptica', 'optica', 'calor', 'temperatura', 'radiação', 'radiacao', 'frequência', 'frequencia', 'luz', 'som'],
  ],
};

const subjectsByArea: Record<EnemArea, EnemSubject[]> = {
  MATEMATICA: ['MATEMATICA'],
  LINGUAGENS: ['LINGUA_PORTUGUESA', 'INGLES', 'ESPANHOL'],
  CIENCIAS_HUMANAS: ['HISTORIA', 'GEOGRAFIA', 'FILOSOFIA', 'SOCIOLOGIA'],
  CIENCIAS_NATUREZA: ['BIOLOGIA', 'QUIMICA', 'FISICA'],
};

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function sourceFingerprint(question: Pick<CanonicalEnemQuestion, 'statement' | 'options'>) {
  return createHash('sha256')
    .update(normalized(`${question.statement}\n${question.options.join('\n')}`))
    .digest('hex');
}

function matchesSignalGroups(text: string, groups: string[][]) {
  const matchedGroups = groups
    .map((group) => group.some((term) => text.includes(normalized(term))))
    .filter(Boolean).length;
  return matchedGroups;
}

function classifySubject(question: CanonicalEnemQuestion): {
  subject: EnemSubject | null;
  reasonCode: string;
  deterministic: boolean;
} {
  if (question.area === 'MATEMATICA') return { subject: 'MATEMATICA', reasonCode: 'OFFICIAL_MATH_AREA_EQUIVALENT', deterministic: true };
  if (question.language === 'ENGLISH') return { subject: 'INGLES', reasonCode: 'OFFICIAL_LANGUAGE_ENGLISH', deterministic: true };
  if (question.language === 'SPANISH') return { subject: 'ESPANHOL', reasonCode: 'OFFICIAL_LANGUAGE_SPANISH', deterministic: true };
  if (!question.area) return { subject: null, reasonCode: 'AREA_UNKNOWN', deterministic: false };

  const text = normalized(`${question.statement}\n${question.options.join('\n')}`);
  const allowedSubjects = subjectsByArea[question.area as EnemArea] ?? [];
  const candidates = Object.entries(signals)
    .filter(([subject]) => allowedSubjects.includes(subject as EnemSubject))
    .map(([subject, groups]) => ({ subject: subject as EnemSubject, score: matchesSignalGroups(text, groups) }))
    .sort((left, right) => right.score - left.score);
  const [best, second] = candidates;
  if (best && best.score >= 2 && best.score > (second?.score ?? 0)) {
    return { subject: best.subject, reasonCode: `CLASSIFICATION_CANDIDATE_${best.subject}`, deterministic: false };
  }
  return { subject: null, reasonCode: best?.score ? 'AMBIGUOUS_SUBJECT_SIGNALS' : 'NO_REPRODUCIBLE_SUBJECT_SIGNAL', deterministic: false };
}

export function classifyCanonicalQuestion(question: CanonicalEnemQuestion): SubjectClassificationRecord {
  const area = ENEM_AREAS.includes(question.area as EnemArea) ? question.area as EnemArea : null;
  const areaVerified = area !== null;
  const classified = classifySubject(question);
  const subject = areaVerified && classified.subject ? classified.subject : null;
  const subjectVerified = subject !== null && classified.deterministic;
  return {
    canonical_id: question.canonicalId,
    area,
    subject,
    area_verified: areaVerified,
    subject_verified: subjectVerified,
    review_state: subjectVerified ? 'VERIFIED' : subject ? 'CANDIDATE' : 'REVIEW_REQUIRED',
    reason_code: areaVerified ? classified.reasonCode : 'AREA_UNKNOWN',
    source_fingerprint: sourceFingerprint(question),
  };
}

export function buildSubjectClassificationRegistry(questions: CanonicalEnemQuestion[]) {
  return questions.map(classifyCanonicalQuestion);
}

export function validateSubjectClassificationRegistry(
  registry: SubjectClassificationRecord[],
  questions: CanonicalEnemQuestion[],
) {
  const expectedFields = ['canonical_id', 'source_fingerprint', 'area', 'subject', 'area_verified', 'subject_verified', 'review_state', 'reason_code'];
  const questionById = new Map(questions.map((question) => [question.canonicalId, question]));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const record of registry) {
    if (Object.keys(record).sort().join('|') !== expectedFields.slice().sort().join('|')) errors.push(`INVALID_REGISTRY_FIELDS:${record.canonical_id}`);
    if (seen.has(record.canonical_id)) errors.push(`DUPLICATE_CANONICAL_ID:${record.canonical_id}`);
    seen.add(record.canonical_id);
    const question = questionById.get(record.canonical_id);
    if (!question) {
      errors.push(`UNKNOWN_CANONICAL_ID:${record.canonical_id}`);
      continue;
    }
    if (record.area && !ENEM_AREAS.includes(record.area)) errors.push(`INVALID_AREA:${record.canonical_id}`);
    if (record.subject && !ENEM_SUBJECTS.includes(record.subject)) errors.push(`INVALID_SUBJECT:${record.canonical_id}`);
    if (record.source_fingerprint !== sourceFingerprint(question)) errors.push(`FINGERPRINT_MISMATCH:${record.canonical_id}`);
    if (record.subject_verified && (!record.subject || record.review_state !== 'VERIFIED')) {
      errors.push(`VERIFIED_SUBJECT_INCONSISTENT:${record.canonical_id}`);
    }
    if (record.subject_verified && !['OFFICIAL_MATH_AREA_EQUIVALENT', 'OFFICIAL_LANGUAGE_ENGLISH', 'OFFICIAL_LANGUAGE_SPANISH', 'VERIFIED_MANUAL_REVIEW'].includes(record.reason_code)) {
      errors.push(`VERIFIED_SUBJECT_REASON_NOT_ALLOWED:${record.canonical_id}`);
    }
    if (!record.subject_verified && record.review_state === 'VERIFIED') {
      errors.push(`UNVERIFIED_SUBJECT_MARKED_VERIFIED:${record.canonical_id}`);
    }
    if (record.subject === 'MATEMATICA' && question.area !== 'MATEMATICA') errors.push(`MATH_AREA_MISMATCH:${record.canonical_id}`);
    if (question.area === 'MATEMATICA' && record.subject !== 'MATEMATICA') errors.push(`MATH_SUBJECT_MISMATCH:${record.canonical_id}`);
    if (question.language === 'ENGLISH' && record.subject !== 'INGLES') errors.push(`ENGLISH_SUBJECT_MISMATCH:${record.canonical_id}`);
    if (question.language === 'SPANISH' && record.subject !== 'ESPANHOL') errors.push(`SPANISH_SUBJECT_MISMATCH:${record.canonical_id}`);
    if (question.language === null && ['INGLES', 'ESPANHOL'].includes(record.subject ?? '')) errors.push(`COMMON_LANGUAGE_SUBJECT_MISMATCH:${record.canonical_id}`);
    if (record.area === 'CIENCIAS_HUMANAS' && record.subject && !['HISTORIA', 'GEOGRAFIA', 'FILOSOFIA', 'SOCIOLOGIA'].includes(record.subject)) errors.push(`HUMANAS_SUBJECT_MISMATCH:${record.canonical_id}`);
    if (record.area === 'CIENCIAS_NATUREZA' && record.subject && !['BIOLOGIA', 'QUIMICA', 'FISICA'].includes(record.subject)) errors.push(`NATUREZA_SUBJECT_MISMATCH:${record.canonical_id}`);
    if (record.area === 'LINGUAGENS' && record.subject && !['LINGUA_PORTUGUESA', 'INGLES', 'ESPANHOL'].includes(record.subject)) errors.push(`LINGUAGENS_SUBJECT_MISMATCH:${record.canonical_id}`);
  }
  return [...new Set(errors)];
}
