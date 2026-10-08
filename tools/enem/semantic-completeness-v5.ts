import type { EnemProviderQuestion } from './structured-text.ts';
import { normalizeProviderLanguage } from './provider-text-v2.ts';

export type SemanticCompletenessState = 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN';

export type SemanticRejectionReason =
  | 'MISSING_CONTEXT'
  | 'MISSING_NUMERIC_DATA'
  | 'MISSING_VISUAL_INFORMATION'
  | 'TRUNCATED_STATEMENT'
  | 'UNRESOLVED_REFERENCE'
  | 'DUPLICATE_CONTENT'
  | 'UNKNOWN_COMPLETENESS'
  | 'SOURCE_CONFLICT';

export interface SemanticCompletenessAssessment {
  state: SemanticCompletenessState;
  statement: string;
  statementComplete: boolean;
  requiredContextAvailable: boolean;
  noUnresolvedReferences: boolean;
  noRequiredMedia: boolean;
  textIntegrity: 'COMPLETE' | 'INCOMPLETE';
  reasons: SemanticRejectionReason[];
}

export interface StructuredRecoverySource {
  provider: string;
  sourceUrl: string;
  question: EnemProviderQuestion;
}

export interface StructuredRecoveryResult {
  question: EnemProviderQuestion | null;
  source: StructuredRecoverySource | null;
  reason: 'RECOVERED' | 'NOT_FOUND' | 'SOURCE_CONFLICT' | 'NOT_NEEDED';
}

const ANAPHORIC_REFERENCE = /\b(?:dessa forma|dessa maneira|nessa forma|nessa maneira|nessas condi[cç][oõ]es|nessa situa[cç][aã]o|nessas informa[cç][oõ]es|de acordo com (?:essas|as) informa[cç][oõ]es|com base (?:nessas|nas) informa[cç][oõ]es|considerando (?:essa|a) situa[cç][aã]o|a partir disso|nesse caso|como (?:descrito|apresentado|mencionado)|efetuando o pagamento dessa forma)\b/iu;
const VISUAL_REFERENCE = /\b(?:observe|analise|analise-se|veja|considere)\s+(?:a|o|as|os)?\s*(?:figura|imagem|gr[aá]fico|tabela|mapa|esquema|fotografia|charge|tirinha)\b|\b(?:na|no|nas|nos|de acordo com|conforme)\s+(?:a|o|as|os)?\s*(?:figura|imagem|gr[aá]fico|tabela|mapa|esquema|fotografia|charge|tirinha)\b|\b(?:representado|apresentado|mostrado)\s+(?:abaixo|a seguir)\b/iu;
const QUANTITATIVE_DEPENDENCY = /\b(?:volume|área|area|per[ií]metro|escala|presta[cç][aã]o|juros|porcentagem|percentual|probabilidade|velocidade m[eé]dia|m[eé]dia|dist[aâ]ncia|comprimento|largura|altura|raio|di[aâ]metro|[aâ]ngulo|progress[aã]o|taxa|valor total|quantidade de|n[uú]mero de|raz[aã]o entre|express[aã]o que|entalpia|fluxo de|massa molar|temperatura)\b/iu;
const NUMERIC_DATA = /(?:\d|\b(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|cem|mil)\b|R\$|%)/iu;
const TRUNCATED_END = /(?:\.{3}|\b(?:e|ou|que|de|da|do|das|dos|em|no|na|nas|nos|para|por|com|considerando|de acordo com|a partir de|ser[aã]o?|ser[aá]|[eé] de|[eé] da|[eé] do|corresponde a|resulta em)\s*[.!?]?)$/iu;
const QUESTION_END = /[?!]\s*$/u;
const SENTENCE_END = /[.!?]\s*$/u;
const CONTEXT_DEPENDENCY = /\b(?:essa|esse|essas|esses|esta|este|estas|estes|tal|tais|referid[oa]s?|mencionad[oa]s?|descrita|descrito|apresentad[oa]s?|demonstrad[oa]s?|considerando (?:esse|essa|isso)|ap[oó]s a an[aá]lise|no caso apresentado|comparando-se|ap[oó]s as|nessa|nessas|neste|nesta|dessa|dessas|o professor|o arquiteto|o carpinteiro|o pedido)\b/iu;

function clean(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ').trim()
    : '';
}

function normalized(value: unknown) {
  return clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/gu, ' ')
    .trim();
}

function wordCount(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function hasDuplicateParagraphs(statement: string) {
  const paragraphs = statement
    .split(/\n\s*\n/u)
    .map(normalized)
    .filter((paragraph) => paragraph.length >= 80 && paragraph !== '\\[…\\]');
  return new Set(paragraphs).size !== paragraphs.length;
}

function hasEmbeddedPassage(prompt: string) {
  return /\n\s*\n/u.test(prompt)
    || /\b(?:dispon[ií]vel em|acesso em|adaptado|fragmento|in[ée]dito)\b/iu.test(prompt)
    || (prompt.length >= 250 && wordCount(prompt) >= 40);
}

function hasMissingAntecedent(statement: string, context: string, prompt: string) {
  const embeddedPassage = hasEmbeddedPassage(prompt);
  if (!context && !embeddedPassage && CONTEXT_DEPENDENCY.test(prompt)) return true;
  const match = statement.match(ANAPHORIC_REFERENCE);
  if (!match || match.index === undefined) return false;
  const prefix = statement.slice(0, match.index).trim();
  if (!prefix) return true;
  if (match.index >= context.length && wordCount(prefix) < 8) return true;
  return !SENTENCE_END.test(prefix) && wordCount(prefix) < 8 && Boolean(prompt);
}

function hasMissingNumericData(statement: string, context: string, prompt: string, discipline: string) {
  if (normalized(discipline) !== 'matematica') return false;
  if (!QUANTITATIVE_DEPENDENCY.test(statement) || NUMERIC_DATA.test(statement)) return false;
  if (context && wordCount(context) >= 8) return false;
  return !QUESTION_END.test(prompt) || /\b(?:ser[aá]|ser[aã]o|[eé] de|corresponde a|resulta em)\b/iu.test(prompt);
}

function hasTruncatedStatement(statement: string, context: string, prompt: string) {
  if (!statement) return true;
  // A stem may intentionally end with a preposition because the alternatives
  // complete it. Treat only short, context-free, single-block fragments as truncation.
  if (!context && TRUNCATED_END.test(prompt) && !QUESTION_END.test(prompt) && !/\n/u.test(prompt) && wordCount(prompt) < 40) return true;
  if (!context && !QUESTION_END.test(prompt) && wordCount(prompt) < 18) return true;
  return false;
}

export function assessSemanticCompleteness(question: Pick<EnemProviderQuestion, 'context' | 'alternativesIntroduction' | 'files' | 'title' | 'discipline'>): SemanticCompletenessAssessment {
  const context = clean(question.context);
  const prompt = clean(question.alternativesIntroduction);
  const title = clean(question.title);
  const statement = [context, prompt].filter(Boolean).join('\n\n').trim();
  const reasons = new Set<SemanticRejectionReason>();
  const hasContext = Boolean(context);
  const hasVisualDependency = VISUAL_REFERENCE.test(statement);
  const missingAntecedent = hasMissingAntecedent(statement, context, prompt);
  const missingNumeric = hasMissingNumericData(statement, context, prompt, question.discipline);
  const truncated = hasTruncatedStatement(statement, context, prompt);

  if (!statement) reasons.add('MISSING_CONTEXT');
  if (!hasContext) {
    if (missingNumeric) reasons.add('MISSING_NUMERIC_DATA');
    if (missingAntecedent || missingNumeric) reasons.add('MISSING_CONTEXT');
  }
  if (missingAntecedent) reasons.add('UNRESOLVED_REFERENCE');
  if (hasVisualDependency && (!Array.isArray(question.files) || question.files.length === 0)) {
    reasons.add('MISSING_VISUAL_INFORMATION');
  }
  if (truncated) reasons.add('TRUNCATED_STATEMENT');
  if (hasDuplicateParagraphs(statement)) reasons.add('DUPLICATE_CONTENT');

  // A metadata-only title cannot supply the missing facts in a question body.
  if (!context && !prompt && title) reasons.add('MISSING_CONTEXT');

  const orderedReasons = [...reasons];
  const state: SemanticCompletenessState = orderedReasons.length
    ? 'INCOMPLETE'
    : statement.length < 20 && !QUESTION_END.test(prompt)
      ? 'UNCERTAIN'
      : 'COMPLETE';

  if (state === 'UNCERTAIN') orderedReasons.push('UNKNOWN_COMPLETENESS');
  return {
    state,
    statement,
    statementComplete: Boolean(statement) && !orderedReasons.includes('TRUNCATED_STATEMENT'),
    requiredContextAvailable: !orderedReasons.includes('MISSING_CONTEXT') && !orderedReasons.includes('MISSING_NUMERIC_DATA'),
    noUnresolvedReferences: !orderedReasons.includes('UNRESOLVED_REFERENCE'),
    noRequiredMedia: !orderedReasons.includes('MISSING_VISUAL_INFORMATION'),
    textIntegrity: orderedReasons.length ? 'INCOMPLETE' : 'COMPLETE',
    reasons: orderedReasons,
  };
}

function providerKey(question: Pick<EnemProviderQuestion, 'year' | 'index' | 'discipline' | 'language'>) {
  return `${question.year}:${question.index}:${normalized(question.discipline)}:${normalizeProviderLanguage(question.language) ?? 'COMMON'}`;
}

function alternativesFingerprint(question: Pick<EnemProviderQuestion, 'alternatives'>) {
  return question.alternatives.map((alternative) => normalized(alternative.text));
}

function strongAlternativeMatch(left: EnemProviderQuestion, right: EnemProviderQuestion) {
  const a = alternativesFingerprint(left);
  const b = alternativesFingerprint(right);
  if (a.length !== 5 || b.length !== 5) return false;
  return a.every((value, index) => value && value === b[index]);
}

export function recoverCompleteStructuredQuestion(
  question: EnemProviderQuestion,
  sources: StructuredRecoverySource[],
): StructuredRecoveryResult {
  const current = assessSemanticCompleteness(question);
  if (current.state === 'COMPLETE') return { question, source: null, reason: 'NOT_NEEDED' };

  const candidates = sources.filter((source) => providerKey(source.question) === providerKey(question));
  if (candidates.some((source) => strongAlternativeMatch(question, source.question)
    && source.question.correctAlternative !== question.correctAlternative)) {
    return { question: null, source: null, reason: 'SOURCE_CONFLICT' };
  }
  const completeCandidates = candidates.filter((source) => (
    strongAlternativeMatch(question, source.question)
    && assessSemanticCompleteness(source.question).state === 'COMPLETE'
  ));
  if (!completeCandidates.length) {
    return { question: null, source: null, reason: 'NOT_FOUND' };
  }
  if (completeCandidates.length > 1) {
    const first = completeCandidates[0].question;
    if (completeCandidates.some((candidate) => normalized(candidate.question.context) !== normalized(first.context))) {
      return { question: null, source: null, reason: 'SOURCE_CONFLICT' };
    }
  }
  const selected = completeCandidates[0];
  return {
    question: { ...question, context: selected.question.context, title: selected.question.title, alternativesIntroduction: selected.question.alternativesIntroduction },
    source: selected,
    reason: 'RECOVERED',
  };
}
