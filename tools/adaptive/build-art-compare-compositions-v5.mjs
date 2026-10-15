import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/art-compare-compositions.json');
const MIGRATION = resolve(ROOT, 'supabase/migrations/20261014000200_bncc_art_compare_compositions_question_first_v5.sql');
const sourceQuestions = JSON.parse(readFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v4/subjects/art/questions.json'), 'utf8'))
  .filter((question) => question.primarySkill === 'ART_COMPARE_COMPOSITIONS');

const rows = [
  ['probe-01', 'PROBE', 'EASY', 'IDENTIFY', 'MURAL_ESCOLAR', 'Em um mural escolar fictício, linhas diagonais partem dos cantos e convergem para uma janela iluminada. Que efeito compositivo essa organização tende a produzir?', 'As linhas conduzem o olhar em direção à janela.', ['As linhas provam a intenção pessoal de quem pintou o mural.', 'A janela deixa de fazer parte da composição.', 'As diagonais garantem que todas as pessoas sintam a mesma emoção.'], 'A direção das linhas pode orientar o percurso do olhar. O enunciado não permite afirmar a intenção ou a reação de todas as pessoas.', 'DIRECTIONAL_LINES', 'Observe para onde as linhas apontam antes de atribuir intenção ou emoção.', 'LINES_AS_PROOF_OF_INTENTION'],
  ['probe-02', 'PROBE', 'EASY', 'DISTINGUISH', 'FORMAS_ADJACENTES', 'Uma composição autoral coloca formas azuis e laranjas de tamanhos iguais lado a lado. Qual descrição se apoia diretamente no que foi informado?', 'As cores são diferentes e aparecem em formas de tamanho igual.', ['O azul representa tristeza para todas as pessoas.', 'O laranja é necessariamente a cor mais importante.', 'A composição foi criada para uma ocasião histórica específica.'], 'A descrição informa diferença de cor e igualdade de tamanho. Sentidos universais ou contexto histórico exigiriam outras evidências.', 'OBSERVATION_BEFORE_MEANING', 'Separe o que foi descrito de interpretações que dependeriam de contexto adicional.', 'COLOR_AS_UNIVERSAL_MEANING'],
  ['practice-01', 'PRACTICE', 'MEDIUM', 'ANALYZE', 'ENQUADRAMENTO_FOTOGRAFICO', 'Uma série fotográfica mostra uma praça primeiro em plano amplo, com pessoas e edifícios, e depois em enquadramento fechado nas mãos de duas pessoas trocando sementes. O que a mudança de enquadramento permite comparar?', 'O contexto coletivo da praça e o gesto específico da troca.', ['A intenção biográfica de quem fotografou.', 'A quantidade exata de pessoas presentes fora do enquadramento.', 'Que a segunda fotografia é mais verdadeira que a primeira.'], 'O plano amplo inclui relações com o espaço; o fechado destaca um gesto. O enquadramento muda quais elementos ficam visíveis, sem provar intenção ou totalidade.', 'FRAMING_AND_SCOPE', 'Compare quais informações entram e saem do campo em cada enquadramento.', 'CROP_AS_COMPLETE_SCENE'],
  ['practice-02', 'PRACTICE', 'MEDIUM', 'ANALYZE', 'RITMO_EM_PADRAO', 'Em uma gravura autoral, pequenos círculos se repetem em intervalos regulares; perto da borda, os intervalos diminuem. Qual leitura descreve melhor essa mudança?', 'A repetição cria ritmo, e a redução dos intervalos altera sua cadência perto da borda.', ['A repetição prova que a gravura foi feita por uma máquina.', 'Os círculos deixam de ter relação porque mudam de intervalo.', 'A borda indica necessariamente o início de uma narrativa.'], 'A repetição e a variação dos intervalos são evidências para descrever ritmo. A técnica e a narrativa não podem ser concluídas apenas por esses dados.', 'REPETITION_AND_VARIATION', 'Observe o padrão e a mudança dos intervalos sem deduzir uma técnica específica.', 'REPETITION_AS_PROOF_OF_MEDIUM'],
  ['transfer-contrast-05-v2', 'TRANSFER', 'MEDIUM', 'COMPARE', 'CARTAZES_AUTORAIS', 'Observe os dois cartazes autorais da mesma campanha. Qual comparação relaciona melhor contraste e hierarquia às diferenças visíveis?', 'O cartaz A separa melhor a chamada do fundo e a organiza como informação principal; no B, o baixo contraste e o peso semelhante dos elementos reduzem essa hierarquia.', ['O cartaz B destaca mais a chamada porque seus elementos secundários têm peso visual próximo.', 'Os cartazes têm a mesma composição porque anunciam o mesmo evento.', 'O cartaz A prova que cores amarelas sempre tornam uma mensagem mais importante.'], 'No cartaz A, a chamada escura sobre o bloco amarelo tem maior contraste e escala, enquanto os detalhes aparecem abaixo. No B, o texto claro sobre branco e os pesos próximos reduzem a separação. Isso sustenta a comparação sem transformar uma cor em significado universal.', 'CONTRAST_AND_HIERARCHY', 'Compare relação figura-fundo, tamanho da chamada e peso dos elementos secundários.', 'SAME_MESSAGE_AS_SAME_COMPOSITION', {
    layout: 'TWO_COLUMN',
    items: [
      { src: '/learning/art/poster-contrast-a.svg', alt: 'Cartaz A: chamada “Feira de trocas do bairro” em letras azul-marinho, grande, sobre um bloco amarelo; as informações de data e local aparecem menores abaixo.', caption: 'Cartaz A' },
      { src: '/learning/art/poster-contrast-b.svg', alt: 'Cartaz B: a mesma chamada em letras cinza-claro diretamente sobre fundo branco; os detalhes têm tamanho e peso visual próximos aos da chamada.', caption: 'Cartaz B' },
    ],
  }],
  ['transfer-02', 'TRANSFER', 'HARD', 'EVALUATE', 'SINALIZACAO_DE_EXPOSICAO', 'Em uma exposição fictícia, uma placa reúne título, horário e uma seta. A seta aponta para a sala seguinte, enquanto o título usa letras maiores que os demais textos. Qual avaliação usa evidências sem extrapolar?', 'O tamanho diferencia o título, e a direção da seta orienta o percurso indicado pela placa.', ['A placa prova que visitantes sempre seguirão a seta.', 'O título maior revela a intenção íntima de quem organizou a exposição.', 'A seta torna desnecessárias as informações de horário.'], 'A escala relativa e a direção da seta são características observáveis. Elas sugerem hierarquia e orientação, mas não comprovam a reação de todos os visitantes.', 'OBSERVABLE_FUNCTIONS_NOT_CERTAINTY', 'Descreva a função sugerida pelos elementos e limite a conclusão ao que foi mostrado.', 'DESIGN_AS_GUARANTEE_OF_BEHAVIOR'],
  ['lockin-01', 'LOCK_IN', 'HARD', 'EVALUATE', 'INTERPRETACAO_DA_COR', 'Uma pessoa diz que um cartaz azul “com certeza acalma qualquer público”. Qual evidência adicional ajudaria a avaliar essa afirmação?', 'Investigar o contexto, a combinação dos elementos e como diferentes públicos interpretam o cartaz.', ['Confirmar apenas que o cartaz contém azul.', 'Supor que todas as pessoas associam cores do mesmo modo.', 'Descobrir o tamanho do papel, sem observar o uso ou o público.'], 'Uma cor isolada não determina uma resposta universal. Contexto, combinação visual e interpretações de públicos diferentes ajudam a avaliar a afirmação.', 'COLOR_MEANING_NEEDS_CONTEXT', 'Pergunte que evidências sustentariam uma afirmação sobre efeito e para quem.', 'COLOR_AS_UNIVERSAL_EMOTION'],
  ['review-01', 'REVIEW', 'EASY', 'SYNTHESIZE', 'LINHAS_CURVAS', 'Dois desenhos autorais usam linhas curvas. No primeiro, elas se aproximam de um ponto central; no segundo, acompanham horizontalmente a borda. Que comparação evita tratar a mesma forma como se tivesse sempre o mesmo efeito?', 'Relacionar a direção e a posição das linhas ao restante de cada composição.', ['Concluir que toda linha curva produz movimento idêntico.', 'Ignorar a posição porque os dois desenhos usam curvas.', 'Afirmar que um desenho é melhor sem definir critérios.'], 'A forma das linhas é apenas parte da composição. Direção, posição e relação com outros elementos ajudam a explicar efeitos possíveis.', 'RELATION_TO_WHOLE', 'Compare a linha com sua posição e com os demais elementos em cada desenho.', 'ELEMENT_AS_FIXED_EFFECT'],
].map(([suffix, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, misconception, visualStimulus]) => {
  const options = [correctAnswer, ...distractors];
  const correctPosition = ({ 'probe-01': 0, 'probe-02': 1, 'practice-01': 2, 'practice-02': 3, 'transfer-contrast-05-v2': 0, 'transfer-02': 1, 'lockin-01': 2, 'review-01': 3 })[suffix];
  const orderedOptions = [...distractors];
  orderedOptions.splice(correctPosition, 0, correctAnswer);
  const row = {
    id: `v5-art-compare-compositions-${suffix}`,
    purpose,
    difficulty,
    cognitiveProcess,
    contextFamily,
    statement,
    options: orderedOptions,
    correctAnswer,
    explanation,
    hint,
    errorFocus,
    misconceptions: { [orderedOptions.find((option) => option !== correctAnswer && option === distractors[0]) ?? distractors[0]]: [misconception] },
  };
  if (visualStimulus) row.visualStimulus = visualStimulus;
  return row;
});

export function buildArtCompareCompositionsPack() {
  return {
    packVersion: 'tec-escola-core-v5-question-first',
    contentId: 'v5-art-compare-compositions-visual-evidence',
    subject: 'ART',
    domain: 'COMPOSICAO',
    topic: 'contraste_hierarquia_enquadramento_ritmo',
    canonicalSkillCode: 'ART_COMPARE_COMPOSITIONS',
    contentVersion: 6,
    lessonVersion: 6,
    expectedQuestionCount: 8,
    expectedContextCount: 8,
    expectedPurposeCounts: { PROBE: 2, PRACTICE: 2, TRANSFER: 2, LOCK_IN: 1, REVIEW: 1 },
    expectedAnswerPositionCounts: { A: 2, B: 2, C: 2, D: 2 },
    officialMappingStatus: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
    contentAuthoringStatus: 'AUTHORED',
    sourceQuestionFeedback: sourceQuestions.map((question) => ({
      questionId: question.id,
      hint: 'Localize no enunciado uma escolha formal descrita (cor, linha, forma, escala, ritmo ou enquadramento). Diferencie essa observação de uma hipótese sobre intenção, qualidade ou reação do público.',
      errorFocus: 'VISUAL_EVIDENCE_BEFORE_INFERENCE',
    })),
    lesson: {
      title: 'Comparar escolhas de composição com evidências',
      objective: 'Descrever relações entre elementos visuais e sustentar uma comparação sem atribuir significados universais ou intenções não demonstradas.',
      summary: 'Observe elementos, relações e efeitos possíveis. Uma boa leitura distingue o que está visível, o que pode ser interpretado e o que exigiria contexto adicional.',
      explanation: '## Comece pelo que está presente\nIdentifique linhas, formas, cores, texturas, luz, escala, posição e enquadramento. Nomear um elemento é uma observação; ainda não explica o papel que ele desempenha.\n\n## Observe relações\nCompare figura e fundo, proximidade, repetição, direção, tamanho e contraste. Hierarquia visual descreve como algumas partes ganham destaque em relação a outras. Ela não prova, sozinha, o que o público sentirá.\n\n## Sustente interpretações\nRelacione uma escolha formal a um efeito possível e aponte a evidência. Separe descrição, interpretação e contexto. Cor ou forma não possui significado universal independente da obra, da situação e de quem a lê.\n\n## Compare com critérios consistentes\nUse os mesmos critérios para as duas composições. Pergunte o que mudou, o que permaneceu e como essas relações alteram a leitura. Uma descrição acessível pode comunicar evidências visuais; quando a tarefa pede observação direta de uma obra, a imagem precisa estar disponível e ter texto alternativo.',
      workedExample: 'Em dois cartazes para o mesmo evento, a chamada do primeiro aparece em letras escuras sobre um bloco amarelo e ocupa mais espaço; no segundo, letras cinza-claro ficam diretamente sobre fundo branco e os detalhes têm tamanho semelhante. A comparação sustentada é que o primeiro separa mais a chamada do fundo e cria uma hierarquia mais nítida. Não se pode concluir que amarelo sempre significa urgência, nem que todas as pessoas reagirão da mesma maneira.',
      commonMistake: 'Inferir uma emoção, intenção ou qualidade universal a partir de uma cor isolada, sem considerar relações visuais e contexto.',
      tips: ['Anote primeiro o elemento visível e sua relação espacial.', 'Use critérios iguais ao comparar duas obras.', 'Qualifique efeitos como possibilidades e não como reações universais.'],
      estimatedMinutes: 12,
      priorKnowledge: ['Reconhecer cor, linha, forma e posição em uma composição.'],
      keyConcepts: ['Contraste', 'figura e fundo', 'hierarquia visual', 'ritmo', 'enquadramento', 'observação e interpretação'],
      microExplanations: [
        { id: 'art-elements', title: 'Elementos', content: 'Cor, linha, forma, escala e posição são elementos que podem ser descritos antes de interpretar.' },
        { id: 'art-relations', title: 'Relações', content: 'Contraste e hierarquia dependem da relação entre elementos, não de um item isolado.' },
        { id: 'art-evidence', title: 'Evidências', content: 'A interpretação fica mais clara quando aponta a característica visual que a sustenta.' },
      ],
      remediations: [
        { id: 'art-observe', trigger: 'Atribui significado universal à cor ou forma.', action: 'Reescreva a resposta como duas partes: “vejo...” e “isso pode produzir...”. Marque qual parte é observação e qual é interpretação.' },
        { id: 'art-compare', trigger: 'Compara obras usando critérios diferentes.', action: 'Monte uma tabela com os mesmos critérios para ambas: contraste, escala, posição e repetição. Só então descreva semelhanças e diferenças.' },
      ],
      authenticActivities: [{
        id: 'art-poster-evidence-annotation',
        title: 'Anotar evidências de composição',
        objective: 'Comparar escolhas formais e justificar uma leitura visual usando evidências dos dois cartazes.',
        instructions: 'Observe os dois cartazes autorais. Em uma folha ou arquivo acessível, identifique a chamada principal, compare contraste, escala e posição dos detalhes e justifique qual informação tende a ser percebida primeiro. Depois, proponha uma alteração em um dos cartazes e explique qual relação visual ela mudaria. É permitido responder por texto, áudio ou anotação ampliada.',
        evidence: 'Anotação que distingue descrição de interpretação, usa pelo menos duas evidências visuais e justifica uma alteração proposta.',
        privacyGuard: 'Use somente os cartazes fictícios deste pacote. Não envie imagens de estudantes, dados pessoais ou fotografias de pessoas identificáveis.',
        rubric: [
          { criterion: 'Evidência visual', emerging: 'Nomeia um elemento sem relacioná-lo ao efeito.', developing: 'Relaciona um elemento a um possível destaque.', proficient: 'Compara ao menos duas relações visuais e sustenta a leitura com evidências dos dois cartazes.' },
          { criterion: 'Revisão compositiva', emerging: 'Sugere mudança sem indicar o que ela altera.', developing: 'Indica um elemento a alterar e um efeito possível.', proficient: 'Propõe alteração coerente e explica como contraste, escala ou posição mudaria a hierarquia.' },
        ],
      }],
      sourceDossier: [
        { publisher: 'J. Paul Getty Museum, Education', title: 'Understanding Formal Analysis', url: 'https://www.getty.edu/education/teachers/classroom_resources/formal_analysis.html', license: 'Referência pedagógica consultada; conteúdo e cartazes deste pacote são autorais e não reproduzem obras do Getty.' },
        { publisher: 'Ministério da Educação, Brasil', title: 'Base Nacional Comum Curricular', url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf', license: 'Referência curricular consultada; vínculo oficial específico não reivindicado neste pacote.' },
      ],
      copyrightNote: 'Questões e dois cartazes foram criados para este pacote. Nenhuma imagem de terceiros foi incorporada. Revisão pedagógica pendente; sem reivindicação de alinhamento oficial.',
    },
    questions: rows,
  };
}

function main() {
  const pack = buildArtCompareCompositionsPack();
  const result = validateQuestionFirstPack(pack);
  if (!result.valid) throw new Error(`ART_PACK_INVALID:${result.errors.join(',')}`);
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(MIGRATION, buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, questions: result.questionCount, contexts: result.contextCount, counts: result.counts, answerPositions: result.answerPositionCounts, visualStimuli: rows.filter((question) => question.visualStimulus).length, sourceFeedback: pack.sourceQuestionFeedback.length }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
