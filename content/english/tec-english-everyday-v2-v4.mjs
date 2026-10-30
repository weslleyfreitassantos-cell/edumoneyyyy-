import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { course as version3 } from './tec-english-everyday-v2.mjs';

const version3Path = new URL('./tec-english-everyday-v2.mjs', import.meta.url);
const version3Source = await readFile(version3Path, 'utf8');
const expectedVersion3Sha256 = '4c6861a4ac46c8c7161c70ebda3a39399743fe3753e28ae732007519a6ee8eac';
const actualVersion3Sha256 = createHash('sha256').update(version3Source.replace(/\r\n/g, '\n')).digest('hex');
if (actualVersion3Sha256 !== expectedVersion3Sha256) {
  throw new Error('Tec Inglês V2 V4 snapshot requires an explicit review when its V3 source changes.');
}

const exercise = (type, skillCode, difficulty, instruction, prompt, fields = {}) => ({
  type,
  skillCode,
  difficulty,
  instruction,
  prompt,
  options: [],
  wordBank: [],
  leftItems: [],
  rightItems: [],
  accepted: [],
  answerKey: {},
  explanation: '',
  dialogueSpeaker: null,
  dialogueContext: [],
  ...fields,
});

const fill = (skillCode, prompt, options, answer, explanation) => exercise(
  'FILL_BLANK', skillCode, 2, 'Escolha a palavra que completa a frase.', prompt,
  { options, accepted: [answer], answerKey: { accepted: [answer] }, explanation },
);

const matching = (skillCode, pairs, explanation) => exercise(
  'MATCHING', skillCode, 2, 'Associe cada expressão ao significado.', 'Encontre os pares correspondentes.',
  { leftItems: Object.keys(pairs), rightItems: Object.values(pairs), answerKey: { pairs }, explanation },
);

const listening = (skillCode, prompt, audioText, accepted, explanation) => exercise(
  'LISTENING', skillCode, 2, 'Ouça a fala e responda sem ver a transcrição.', prompt,
  { audioText, accepted, answerKey: { accepted }, explanation },
);

const translation = (skillCode, prompt, answer, explanation) => exercise(
  'TRANSLATION', skillCode, 2, 'Escreva uma tradução natural em inglês.', prompt,
  { accepted: [answer], answerKey: { accepted: [answer] }, explanation },
);

const wordOrder = (skillCode, prompt, answer, explanation) => exercise(
  'WORD_ORDER', skillCode, 2, 'Monte a frase na ordem correta.', prompt,
  { wordBank: answer.split(' ').reverse(), accepted: [answer], answerKey: { accepted: [answer] }, explanation },
);

const speaking = (skillCode, prompt, audioText, explanation) => exercise(
  'SPEAKING', skillCode, 2, 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', prompt,
  { audioText, accepted: [audioText], answerKey: { accepted: [audioText] }, explanation },
);

export const course = structuredClone(version3);
course.course.version = 4;

const replacements = new Map([
  ['english-v2-u4-l1', speaking(
    'routine_speaking', 'Repita: “I get dressed and leave at eight.”', 'I get dressed and leave at eight.',
    'A fala opcional ajuda a praticar a rotina; o sistema não atribui nota de pronúncia.',
  )],
  ['english-v2-u4-l2', fill(
    'homework_routine', 'I ___ my homework after class.', ['do', 'does', 'am'], 'do',
    'Com “I”, usamos “do”: “I do my homework”.',
  )],
  ['english-v2-u4-l3', matching(
    'days_and_plans', { Saturday: 'sábado', Sunday: 'domingo', Monday: 'segunda-feira' },
    'Reconheça os dias da semana e use “on” antes do dia em inglês.',
  )],
  ['english-v2-u4-l4', listening(
    'daily_habits_listening', 'O que ele faz depois de ler?', 'He reads and then plays music.', ['plays music'],
    'A expressão “then plays music” informa o que acontece depois da leitura.',
  )],
  ['english-v2-u5-l1', translation(
    'school_places', 'A sala de ciências fica ao lado da biblioteca.', 'The science room is next to the library.',
    '“Next to” indica que a sala de ciências fica ao lado da biblioteca.',
  )],
  ['english-v2-u5-l2', wordOrder(
    'family_living_arrangements', 'Monte: “Meu primo mora com a família dele.”', 'My cousin lives with his family.',
    'Use “lives” com “my cousin” e “with his family” para completar a ideia.',
  )],
  ['english-v2-u5-l3', matching(
    'directions', { 'go straight': 'siga em frente', 'turn left': 'vire à esquerda', 'turn right': 'vire à direita' },
    'As expressões indicam três instruções comuns para pedir ou dar direções.',
  )],
  ['english-v2-u5-l4', fill(
    'classroom_objects', 'The history book is on the ___ by the window.', ['shelf', 'turn', 'brother'], 'shelf',
    '“Shelf” significa prateleira: o livro está na prateleira perto da janela.',
  )],
]);

for (const unit of course.units) {
  for (const lesson of unit.lessons) {
    const replacement = replacements.get(lesson.id);
    if (replacement) lesson.exercises[1] = replacement;
  }
}

if (replacements.size !== 8 || course.units.flatMap((unit) => unit.lessons).some((lesson) => !replacements.has(lesson.id))) {
  throw new Error('Tec Inglês V2 V4 snapshot must replace exactly one exercise in each of its eight lessons.');
}
