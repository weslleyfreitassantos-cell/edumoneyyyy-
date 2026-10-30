import type { TecLanguageLocale } from './tecLanguage';

export type PlacementLocale = Extract<TecLanguageLocale, 'en-US' | 'es-ES' | 'ko-KR'>;

export function supportsPlacementAssessment(locale: TecLanguageLocale): locale is PlacementLocale {
  return locale === 'en-US' || locale === 'es-ES' || locale === 'ko-KR';
}

export type PlacementDifficulty = 1 | 2 | 3;

export interface PlacementQuestion {
  id: string;
  difficulty: PlacementDifficulty;
  prompt: string;
  support?: string;
  options: readonly string[];
  correctOption: number;
  explanation: string;
}

export interface PlacementAnswer {
  questionId: string;
  difficulty: PlacementDifficulty;
  isCorrect: boolean;
}

export interface PlacementRecord {
  version: 1;
  kind: 'START_FROM_ZERO' | 'ASSESSMENT';
  score: number;
  questionCount: number;
  highestDifficulty: PlacementDifficulty;
  recommendedUnitPosition: number;
  completedAt: string;
}

export function isPlacementRecord(value: unknown): value is PlacementRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PlacementRecord>;
  if (record.version !== 1 || (record.kind !== 'START_FROM_ZERO' && record.kind !== 'ASSESSMENT')) return false;
  if (!Number.isInteger(record.score) || record.score === undefined || record.score < 0
    || !Number.isInteger(record.questionCount) || record.questionCount === undefined || record.questionCount < 0 || record.questionCount > PLACEMENT_QUESTION_LIMIT
    || !Number.isInteger(record.highestDifficulty) || record.highestDifficulty === undefined || record.highestDifficulty < 1 || record.highestDifficulty > 3
    || !Number.isInteger(record.recommendedUnitPosition) || record.recommendedUnitPosition === undefined || record.recommendedUnitPosition < 1 || record.recommendedUnitPosition > 4
    || typeof record.completedAt !== 'string' || !Number.isFinite(Date.parse(record.completedAt))) return false;
  if (record.score > record.questionCount
    || (record.kind === 'START_FROM_ZERO' && (record.score !== 0 || record.questionCount !== 0 || record.highestDifficulty !== 1 || record.recommendedUnitPosition !== 1))
    || (record.kind === 'ASSESSMENT' && record.questionCount === 0)) return false;
  return true;
}

export const PLACEMENT_QUESTION_LIMIT = 5;

const placementQuestions: Record<PlacementLocale, readonly PlacementQuestion[]> = {
  'en-US': [
    { id: 'en-greeting-morning', difficulty: 1, prompt: 'O que significa “Good morning”?', options: ['Bom dia', 'Boa noite', 'Com licença'], correctOption: 0, explanation: '“Good morning” é uma saudação usada pela manhã.' },
    { id: 'en-thanks', difficulty: 1, prompt: 'Qual é o sentido de “Thank you”?', options: ['Até amanhã', 'Por favor', 'Obrigado(a)'], correctOption: 2, explanation: '“Thank you” é uma forma comum de agradecer.' },
    { id: 'en-brother-school', difficulty: 2, prompt: 'Como você entende “My brother lives near the school”?', options: ['Meu irmão mora perto da escola.', 'Meu irmão está dentro da escola.', 'Meu amigo trabalha na escola.'], correctOption: 0, explanation: '“Lives near” significa “mora perto”; “brother” significa “irmão”.' },
    { id: 'en-nearest-station', difficulty: 2, prompt: 'O que a pessoa quer saber em “Where is the nearest station?”', options: ['Quanto custa a passagem?', 'Onde fica a estação mais próxima?', 'A que horas a estação fecha?'], correctOption: 1, explanation: '“Where is” pergunta onde fica algo; “nearest” significa “mais próxima”.' },
    { id: 'en-if-it-rains', difficulty: 3, prompt: 'Qual é o sentido de “If it rains tomorrow, we’ll stay at home”?', options: ['Choveu ontem, então ficamos em casa.', 'Se chover amanhã, ficaremos em casa.', 'Vamos sair de casa antes da chuva.'], correctOption: 1, explanation: 'A frase apresenta uma condição futura: se chover amanhã, o grupo ficará em casa.' },
    { id: 'en-since-2022', difficulty: 3, prompt: 'Como você entende “She has worked at this school since 2022”?', options: ['Ela trabalhou em outra escola até 2022.', 'Ela começará a trabalhar nesta escola em 2022.', 'Ela trabalha nesta escola desde 2022.'], correctOption: 2, explanation: '“Since 2022” indica quando a situação começou e continua até o presente.' },
  ],
  'es-ES': [
    { id: 'es-buenos-dias', difficulty: 1, prompt: 'O que significa “Buenos días”?', options: ['Boa tarde', 'Bom dia', 'Boa noite'], correctOption: 1, explanation: '“Buenos días” é a saudação usada pela manhã.' },
    { id: 'es-gracias', difficulty: 1, prompt: 'Qual é o sentido de “Muchas gracias”?', options: ['Muito obrigado(a)', 'Com licença', 'Até logo'], correctOption: 0, explanation: '“Muchas gracias” é uma forma de agradecer.' },
    { id: 'es-station', difficulty: 2, prompt: 'O que a pessoa quer saber em “¿Dónde está la estación?”', options: ['Onde fica a estação?', 'Qual é o nome da estação?', 'Quando a estação abre?'], correctOption: 0, explanation: '“¿Dónde está…?” pergunta onde algo está.' },
    { id: 'es-yesterday-bread', difficulty: 2, prompt: 'Como você entende “Ayer compré pan para el desayuno”?', options: ['Amanhã comprarei pão para o almoço.', 'Ontem comprei pão para o café da manhã.', 'Ontem preparei o jantar.'], correctOption: 1, explanation: '“Ayer” significa “ontem”; “desayuno” é “café da manhã”.' },
    { id: 'es-aunque-project', difficulty: 3, prompt: 'Qual é o sentido de “Aunque estaba cansada, terminó el proyecto”?', options: ['Como estava cansada, deixou o projeto para depois.', 'Embora estivesse cansada, terminou o projeto.', 'O projeto a deixou cansada antes de começar.'], correctOption: 1, explanation: '“Aunque” significa “embora”; a frase indica contraste entre estar cansada e concluir o projeto.' },
    { id: 'es-when-meeting', difficulty: 3, prompt: 'Como você entende “Cuando termine la reunión, te llamaré”?', options: ['Quando a reunião terminar, vou ligar para você.', 'A reunião terminou depois que você ligou.', 'Vou ligar para cancelar a reunião.'], correctOption: 0, explanation: '“Cuando termine” situa a ligação depois do fim da reunião.' },
  ],
  'ko-KR': [
    { id: 'ko-greeting', difficulty: 1, prompt: 'O que significa “안녕하세요”?', support: 'annyeonghaseyo', options: ['Olá — uma saudação educada', 'Obrigado(a)', 'Até amanhã'], correctOption: 0, explanation: '“안녕하세요” é uma saudação educada usada para dizer olá.' },
    { id: 'ko-thanks', difficulty: 1, prompt: 'Qual é o sentido de “감사합니다”?', support: 'gamsahamnida', options: ['Com licença', 'Obrigado(a)', 'Boa noite'], correctOption: 1, explanation: '“감사합니다” é uma forma educada de agradecer.' },
    { id: 'ko-library', difficulty: 2, prompt: 'Como você entende “오늘은 친구와 도서관에 가요”?', options: ['Hoje vou à biblioteca com um amigo.', 'Meu amigo trabalha na biblioteca.', 'A biblioteca fica fechada hoje.'], correctOption: 0, explanation: 'A frase diz que a pessoa vai hoje à biblioteca com um amigo.' },
    { id: 'ko-food', difficulty: 2, prompt: 'O que significa “이 음식은 조금 맵지만 맛있어요”?', options: ['Esta comida está fria e sem sabor.', 'Esta comida é um pouco apimentada, mas gostosa.', 'Quero pedir outra comida.'], correctOption: 1, explanation: '“맵지만” expressa contraste: algo é apimentado, mas gostoso.' },
    { id: 'ko-weekend-study', difficulty: 3, prompt: 'Como você entende “시간이 있으면 주말에 같이 공부할까요?”', options: ['Você estudou durante todo o fim de semana.', 'Se tiver tempo, vamos estudar juntos no fim de semana?', 'Não tenho tempo para estudar hoje.'], correctOption: 1, explanation: 'A frase faz um convite para estudar juntos no fim de semana, caso a outra pessoa tenha tempo.' },
    { id: 'ko-after-rain', difficulty: 3, prompt: 'Qual é o sentido de “비가 그친 뒤에 공원에서 산책했어요”?', options: ['Depois que a chuva parou, caminhei no parque.', 'Caminhei até o parque para fugir da chuva.', 'A chuva começou enquanto eu estava no parque.'], correctOption: 0, explanation: 'A frase conta que a caminhada no parque aconteceu depois que a chuva parou.' },
  ],
};

export function getPlacementQuestion(locale: PlacementLocale, questionId: string): PlacementQuestion | null {
  return placementQuestions[locale].find((question) => question.id === questionId) ?? null;
}

export function getFirstPlacementQuestion(locale: PlacementLocale): PlacementQuestion {
  return placementQuestions[locale][0];
}

export function getNextPlacementQuestion(
  locale: PlacementLocale,
  answeredQuestionIds: readonly string[],
  currentDifficulty: PlacementDifficulty,
  wasCorrect: boolean,
): PlacementQuestion | null {
  if (answeredQuestionIds.length >= PLACEMENT_QUESTION_LIMIT) return null;
  const targetDifficulty = Math.max(1, Math.min(3, currentDifficulty + (wasCorrect ? 1 : -1))) as PlacementDifficulty;
  const available = placementQuestions[locale].filter((question) => !answeredQuestionIds.includes(question.id));
  return available.find((question) => question.difficulty === targetDifficulty)
    ?? [...available].sort((left, right) => Math.abs(left.difficulty - targetDifficulty) - Math.abs(right.difficulty - targetDifficulty))[0]
    ?? null;
}

export function getRecommendedUnitPosition(
  highestDifficulty: PlacementDifficulty,
  score: number,
  questionCount: number,
  availableUnits: number,
): number {
  const safeQuestionCount = Math.max(1, Math.floor(questionCount));
  const strongResult = score / safeQuestionCount >= 0.8;
  const steadyResult = score / safeQuestionCount >= 0.6;
  const suggested = highestDifficulty >= 3 && safeQuestionCount >= 4 && strongResult
    ? 3
    : highestDifficulty >= 2 && safeQuestionCount >= 3 && steadyResult
      ? 2
      : 1;
  return Math.max(1, Math.min(Math.max(1, availableUnits), suggested));
}
