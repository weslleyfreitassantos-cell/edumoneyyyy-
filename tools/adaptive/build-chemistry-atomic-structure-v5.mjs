import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/chemistry-atomic-structure.json');

const rows = [
  ['practice-01', 'PRACTICE', 'MEDIUM', 'APPLY', 'PHOSPHORUS_ION_PARTICLE_TABLE', 'Um modelo de uma espécie de fósforo informa número de massa A=31, número atômico Z=15 e carga 3−. Quantos prótons, nêutrons e elétrons ela possui?', '15 prótons, 16 nêutrons e 18 elétrons.', ['31 prótons, 15 nêutrons e 18 elétrons.', '15 prótons, 16 nêutrons e 12 elétrons.', '15 prótons, 31 nêutrons e 18 elétrons.'], 'Z fornece 15 prótons. N=A−Z=31−15=16. A carga −3 indica três elétrons a mais que prótons, portanto E=18. A identidade do fósforo permanece ligada aos 15 prótons.', 'Confundir A com prótons ou inverter o efeito do sinal da carga na contagem de elétrons.', 'Calcule primeiro P=Z e N=A−Z; depois use carga=P−E para encontrar E.', 0],
  ['transfer-01', 'TRANSFER', 'HARD', 'CALCULATE', 'BORON_ISOTOPE_ABUNDANCE', 'Uma amostra de boro contém 20% de átomos com A=10 e 80% com A=11. Qual massa atômica média aproximada descreve a amostra e como interpretá-la?', '10,8 u; é uma média ponderada, não o número de massa de cada átomo.', ['10,5 u; cada átomo contém exatamente 10,5 núcleons.', '10,8 u; todos os átomos têm número de massa 10,8.', '11 u; a média deve ser sempre o número de massa do isótopo mais abundante.'], 'A média ponderada é 0,20×10 + 0,80×11 = 10,8 u. Núcleos individuais têm números de massa inteiros; a média representa a composição da amostra.', 'Tratar uma média de abundâncias como se fosse o número de massa de um núcleo individual.', 'Multiplique cada número de massa por sua fração e some os produtos; depois distinga média de A.', 1],
  ['transfer-02', 'TRANSFER', 'HARD', 'INTERPRET', 'ZINC_MASS_SPECTRUM_COUNTS', 'Um registro de espectrometria descreve uma espécie com 30 prótons, 34 nêutrons e 28 elétrons. Qual identificação é compatível com os dados?', 'É o íon ⁶⁴Zn²⁺: A=64 e há duas cargas positivas líquidas.', ['É o átomo neutro ⁶⁴Zn, pois prótons e nêutrons somam 64.', 'É o íon ⁶²Zn²⁻, pois os elétrons determinam o número de massa.', 'É o íon ⁶⁴Cu²⁺, pois a carga define o elemento.'], 'Z=30 identifica zinco. A=30+34=64; como P−E=30−28=+2, a espécie tem carga 2+. O número de massa não inclui elétrons.', 'Usar elétrons para identificar o elemento ou incluí-los no número de massa.', 'Use separadamente Z=P, A=P+N e carga=P−E.', 2],
  ['transfer-03', 'TRANSFER', 'HARD', 'COMPARE', 'HYDROGEN_ISOTOPES_AFTER_IONIZATION', 'Um laboratório remove um elétron de cada átomo neutro de hidrogênio-1 e hidrogênio-2. Após a ionização, qual diferença entre os núcleos permanece?', 'O hidrogênio-1 não tem nêutron e o hidrogênio-2 tem um; ambos ficam com carga +1.', ['Os dois passam a ter o mesmo núcleo, pois perderam o elétron.', 'O hidrogênio-1 fica com um próton a mais que o hidrogênio-2.', 'A ionização aumenta o número de massa de cada núcleo em uma unidade.'], 'Os dois isótopos continuam com um próton, mas têm números diferentes de nêutrons. Remover elétron altera a carga, não o núcleo; cada espécie fica com carga +1.', 'Confundir mudança na nuvem eletrônica com alteração do núcleo ou da identidade isotópica.', 'Separe núcleo (P e N) de eletrosfera (E) e recalcule cada parte após a ionização.', 3],
  ['transfer-04', 'TRANSFER', 'HARD', 'EVALUATE', 'MASS_TO_CHARGE_TWO_STATES', 'Um espectrômetro separa o mesmo nuclídeo em sinais de íons 1+ e 2+. Supondo que nenhuma reação nuclear ocorreu, que conclusão é sustentada?', 'O núcleo conserva prótons e nêutrons; os íons diferem por um elétron e pela carga.', ['O íon 2+ tem um próton a menos, por isso o elemento muda.', 'O número de massa aumenta em uma unidade quando a carga passa a 2+.', 'Os sinais precisam corresponder a isótopos diferentes, pois toda carga altera nêutrons.'], 'Ionização retira elétrons sem modificar o núcleo. As duas espécies mantêm Z e A; a espécie 2+ perdeu um elétron a mais que a 1+.', 'Interpretar a mudança de carga como mudança do elemento ou do número de massa.', 'Compare P e N para a parte nuclear e só depois compare a quantidade de elétrons.', 0],
  ['lock-01', 'LOCK_IN', 'HARD', 'ANALYZE', 'CHLORINE_ISOTOPE_IONS_TABLE', 'Uma tabela traz I: 17 prótons, 18 nêutrons e 18 elétrons; II: 17 prótons, 20 nêutrons e 18 elétrons. Qual comparação reúne corretamente elemento, isótopo e carga?', 'Ambas são íons Cl⁻; são isótopos com A=35 e A=37, respectivamente.', ['I é Cl neutro e II é Ar⁻, pois o número de massa mudou.', 'Ambas são o mesmo nuclídeo porque têm o mesmo número de elétrons.', 'I é Cl⁺ e II é Cl²⁺, pois há mais nêutrons do que prótons.'], 'As duas têm Z=17, então são cloro. Seus números de massa são 35 e 37, logo diferem em nêutrons; 18 elétrons para 17 prótons dá carga −1 em ambas.', 'Deixar nêutrons ou elétrons substituírem o número de prótons na identificação do elemento.', 'Calcule Z, A e P−E em colunas distintas para cada linha.', 1],
  ['lock-02', 'LOCK_IN', 'HARD', 'DEBUG', 'CALCIUM_ION_MODEL_AUDIT', 'Um relatório para ⁴⁰Ca²⁺ registra 20 prótons, 20 nêutrons e 22 elétrons. Qual revisão corrige a inconsistência sem alterar o núcleo?', 'A espécie deve ter 18 elétrons; Ca²⁺ perdeu dois elétrons do átomo neutro.', ['Deve ter 22 prótons, pois a carga positiva aumenta Z.', 'Deve ter 40 elétrons, pois A representa a quantidade de elétrons.', 'Deve ter 20 elétrons; a carga 2+ não afeta a eletrosfera.'], 'Z=20 define 20 prótons e A−Z=20 nêutrons. A carga +2 exige P−E=2, portanto E=18. A linha confundiu perda de elétrons com ganho.', 'Aplicar a carga no sentido errado ou usar A como contagem de elétrons.', 'Confira primeiro o núcleo e use depois a equação carga=P−E.', 2],
  ['lock-03', 'LOCK_IN', 'HARD', 'SYNTHESIZE', 'SULFUR_ISOTOPE_ION_COMPARISON', 'Espécie I tem Z=16, A=32 e 18 elétrons. Espécie II tem Z=16, A=34 e 16 elétrons. Qual descrição é correta?', 'São isótopos de enxofre; I é S²⁻ com 16 nêutrons e II é S neutro com 18 nêutrons.', ['I é oxigênio e II é enxofre, pois os números de massa diferem.', 'Ambas são enxofre neutro, pois têm 16 prótons.', 'I é S²⁺ com 16 nêutrons e II é S²⁻ com 18 nêutrons.'], 'Z=16 identifica enxofre nas duas espécies. I tem N=32−16=16 e carga 16−18=−2; II tem N=34−16=18 e carga zero.', 'Misturar a classificação isotópica, determinada por A e Z, com a carga, determinada por P−E.', 'Calcule N=A−Z e carga=P−E independentemente para cada espécie.', 3],
  ['review-01', 'REVIEW', 'EASY', 'RECALL', 'POTASSIUM_NUCLEUS_REVIEW', 'Uma amostra contém o nuclídeo ³⁹K neutro. O potássio tem Z=19. Quantos prótons, nêutrons e elétrons há em cada átomo?', '19 prótons, 20 nêutrons e 19 elétrons.', ['39 prótons, 19 nêutrons e 19 elétrons.', '19 prótons, 39 nêutrons e 20 elétrons.', '20 prótons, 19 nêutrons e 19 elétrons.'], 'Z=19 fornece prótons; N=39−19=20; a neutralidade iguala elétrons e prótons.', 'Trocar A e Z ou esquecer que neutralidade exige P=E.', 'Aplique P=Z, N=A−Z e, para átomo neutro, E=P.', 0],
  ['review-02', 'REVIEW', 'MEDIUM', 'INTERPRET', 'FLUORIDE_ELECTRON_COUNT', 'Em uma solução, uma espécie de flúor apresenta 9 prótons e 10 elétrons. Qual informação é possível obter mesmo sem saber seus nêutrons?', 'É F⁻, pois tem um elétron a mais que prótons; o número de massa continua desconhecido.', ['É F neutro e seu número de massa é 19.', 'É Ne⁺, porque 10 elétrons definem o elemento neônio.', 'É F⁺, pois a presença de prótons supera a de elétrons.'], 'Nove prótons identificam flúor. Um elétron a mais dá carga −1. Sem a contagem de nêutrons, não é possível determinar A.', 'Inferir o número de massa ou o elemento a partir dos elétrons isoladamente.', 'Para o elemento use P; para carga use P−E; para A ainda é necessário N.', 1],
  ['review-03', 'REVIEW', 'MEDIUM', 'DISTINGUISH', 'NITROGEN_ISOTOPE_LABELS', 'Dois átomos neutros aparecem identificados como ¹⁴N e ¹⁵N. Qual propriedade explica por que ambos são nitrogênio, embora tenham massas diferentes?', 'Ambos têm Z=7 e, portanto, sete prótons; diferem no número de nêutrons.', ['Ambos têm A=7 e diferem no número de elétrons.', 'O mais pesado tem um próton a mais, mas continua sendo o mesmo elemento.', 'O símbolo N indica apenas a quantidade de nêutrons, não o elemento.'], 'O elemento nitrogênio tem Z=7. Os isótopos conservam prótons e diferem em nêutrons: 7 em N-14 e 8 em N-15.', 'Confundir mudança de massa com mudança do número atômico.', 'Identifique o elemento pelo símbolo e Z; calcule os nêutrons subtraindo Z de A.', 2],
  ['review-04', 'REVIEW', 'MEDIUM', 'READ_NOTATION', 'ATOMIC_SYMBOL_POSITION_REVIEW', 'Na escrita nuclear de um átomo, o número inferior à esquerda do símbolo químico é Z. O que esse número informa?', 'A quantidade de prótons e, assim, a identidade do elemento.', ['A soma de prótons e nêutrons do núcleo.', 'A quantidade de elétrons perdidos pelo átomo.', 'A quantidade de nêutrons sem relação com o elemento.'], 'O índice inferior esquerdo é o número atômico Z, igual ao número de prótons. O número de massa A aparece na posição superior esquerda.', 'Confundir a posição do número atômico com o número de massa ou com a carga.', 'Leia a posição antes de interpretar: inferior esquerdo é Z; superior esquerdo é A.', 3],
  ['review-05', 'REVIEW', 'HARD', 'EVALUATE', 'CHLORINE_AVERAGE_MASS_CLAIM', 'A tabela periódica mostra massa atômica média do cloro próxima de 35,5 u. Um aluno conclui que todo átomo de cloro tem 35,5 núcleons. Qual correção é adequada?', 'A média resulta das abundâncias de isótopos; cada núcleo tem número de massa inteiro.', ['A conclusão está certa porque a massa atômica é sempre A de cada átomo.', 'O cloro não possui prótons, então a média não descreve núcleos.', 'O valor 35,5 significa que metade dos átomos perdeu um nêutron.'], 'O valor tabelado é uma média ponderada da composição isotópica natural. Um átomo individual tem número inteiro de prótons e nêutrons, portanto A inteiro.', 'Tratar a massa atômica média como número de massa de cada átomo individual.', 'Diferencie a massa média de uma amostra do valor A de um nuclídeo.', 0],
  ['review-06', 'REVIEW', 'HARD', 'JUSTIFY', 'ELEMENT_IDENTITY_CHANGE_REVIEW', 'Uma reação química transfere elétrons entre átomos, mas não envolve transformação nuclear. Qual alteração seria necessária para que uma espécie passasse a ser outro elemento?', 'Mudar o número de prótons do núcleo; mudar elétrons altera apenas a carga.', ['Mudar o número de elétrons, mantendo os prótons.', 'Mudar o número de nêutrons, mantendo os prótons.', 'Mudar o número de massa por qualquer transferência eletrônica.'], 'A identidade química é definida por Z, a quantidade de prótons. Transferências eletrônicas formam íons; mudar nêutrons produz outro isótopo do mesmo elemento.', 'Confundir formação de íon ou isótopo com mudança do elemento.', 'Pergunte qual contagem determina Z; mudanças apenas em E ou N não trocam o elemento.', 1],
];

const expectedPurposeCounts = { PROBE: 0, PRACTICE: 1, TRANSFER: 4, LOCK_IN: 3, REVIEW: 6 };
const positionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  positionCounts[answerPosition] += 1;
  return {
    id: `v5-chem-atomic-${id}`,
    purpose,
    difficulty,
    cognitiveProcess,
    contextFamily,
    statement,
    options,
    correctAnswer,
    explanation,
    errorFocus,
    hint,
    misconceptions: { [distractors[0]]: [errorFocus.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')] },
  };
});

const idsFor = (purpose) => questions.filter((question) => question.purpose === purpose).map((question) => question.id);
const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentId: 'v5-chemistry-atomic-structure',
  subject: 'CHEMISTRY',
  domain: 'ATOMOS',
  topic: 'numero atomico, isotopos e ions',
  canonicalSkillCode: 'CHEMISTRY_ATOMIC_STRUCTURE',
  contentVersion: 5,
  expectedQuestionCount: questions.length,
  expectedContextCount: new Set(questions.map((question) => question.contextFamily)).size,
  expectedAnswerPositionCounts: Object.fromEntries(['A', 'B', 'C', 'D'].map((label, index) => [label, positionCounts[index]])),
  expectedPurposeCounts,
  officialMappingStatus: 'NOT_CLAIMED',
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  publicationStatus: 'STAGING',
  contentAuthoringStatus: 'AUTHORED',
  lesson: {
    title: 'Como ler modelos de átomos, isótopos e íons',
    objective: 'Interpretar Z, A e carga para determinar prótons, nêutrons e elétrons, distinguir isótopos de íons e justificar conclusões a partir de modelos e dados.',
    summary: 'Use três relações sem misturá-las: Z=P, A=P+N e carga=P−E. O núcleo define o elemento e o isótopo; a eletrosfera define se a espécie é neutra ou um íon.',
    explanation: '## Comece pelo núcleo\nO número atômico Z conta prótons. Esse número identifica o elemento: se Z=17, a espécie tem 17 prótons e é cloro, mesmo que tenha ganhado ou perdido elétrons. O número de massa A conta prótons e nêutrons juntos. Portanto, N=A−Z. Elétrons não entram em A.\n\n## Separe isótopo de íon\nIsótopos têm o mesmo Z e números de massa diferentes; a diferença está nos nêutrons. Íons têm quantidades diferentes de prótons e elétrons. Para a carga em unidades elementares, q=P−E: carga positiva indica menos elétrons que prótons; carga negativa indica mais elétrons. Na ionização comum, o núcleo permanece igual.\n\n## Leia a notação\nNa escrita ⁴⁰₂₀Ca²⁺, o índice inferior esquerdo é Z=20 e o superior esquerdo é A=40; a carga 2+ aparece à direita. Assim, P=20, N=40−20=20 e E=20−2=18. A identidade do cálcio decorre dos 20 prótons, não dos 18 elétrons.\n\n## Massa média não é A de um átomo\nA massa atômica mostrada na tabela periódica pode ser fracionária porque representa uma média ponderada das massas isotópicas e de suas abundâncias. Cada nuclídeo individual tem um número inteiro de prótons e nêutrons e, portanto, um A inteiro.\n\n## Exemplo resolvido\nPara ³⁷₁₇Cl⁻, Z=17, então P=17; N=A−Z=37−17=20; e q=P−E=−1, então E=18. O símbolo Cl continua válido porque Z não mudou. Comparado a ³⁵Cl, o núcleo tem dois nêutrons a mais: são isótopos do mesmo elemento, e a carga negativa identifica o estado iônico.',
    workedExample: 'Em uma ficha com A=64, Z=30 e carga 2+, primeiro obtenha P=30. Em seguida, N=64−30=34. Por fim, 2=P−E, então E=28. A resposta fica consistente porque 30−28=+2. A sequência evita usar elétrons para calcular A ou nêutrons para identificar o elemento.',
    commonMistake: 'Usar A como se fosse o número de prótons, incluir elétrons no número de massa, ou tratar uma transferência de elétrons como mudança de elemento ou de isótopo.',
    commonErrors: ['Trocar o número atômico Z pelo número de massa A.', 'Somar elétrons ao núcleo ao calcular A.', 'Diminuir elétrons em um ânion ou aumentá-los em um cátion.', 'Dizer que isótopos são elementos diferentes por terem massas diferentes.'],
    tips: ['Anote Z, A e q em colunas separadas antes de calcular.', 'Use P=Z e N=A−Z para o núcleo.', 'Use q=P−E para conferir a eletrosfera.', 'Ao comparar espécies, diga primeiro o que permaneceu igual e só então o que mudou.'],
    priorKnowledge: ['Ler símbolos e números em uma representação simples de átomo.', 'Somar e subtrair números inteiros.'],
    keyConcepts: ['número atômico e identidade do elemento', 'número de massa e contagem de nucleons', 'isótopos e variação de nêutrons', 'íons e variação de elétrons', 'notação nuclear', 'média isotópica e número de massa'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Relembrar o significado de Z, A e carga em espécies isoladas.', questionIds: [] },
      { stage: 'APPLICATION', focus: 'Calcular partículas a partir de dados de núcleo e eletrosfera.', questionIds: idsFor('PRACTICE') },
      { stage: 'TRANSFER', focus: 'Aplicar o modelo a espectrometria, abundância isotópica e ionização.', questionIds: idsFor('TRANSFER') },
      { stage: 'INTEGRATION', focus: 'Combinar isótopos, carga e consistência de registros.', questionIds: idsFor('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Revisar notação, identidade e relações quantitativas em contextos variados.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'Z_IDENTIFIES_ELEMENT', text: 'O elemento é identificado por Z, a quantidade de prótons.' },
      { trigger: 'A_COUNTS_NUCLEONS', text: 'A conta prótons e nêutrons; use N=A−Z.' },
      { trigger: 'CHARGE_SIGN_ELECTRONS', text: 'Use q=P−E: sinal positivo indica menos elétrons; negativo, mais.' },
      { trigger: 'ISOTOPE_VS_ION', text: 'Isótopos diferem em nêutrons; íons diferem em elétrons.' },
      { trigger: 'IONIZATION_NUCLEUS', text: 'Ganhar ou perder elétrons não muda o núcleo na ionização comum.' },
      { trigger: 'AVERAGE_MASS', text: 'A massa atômica tabelada é média da amostra; A de um nuclídeo é inteiro.' },
    ],
    remediations: [
      { id: 'SEPARATE_Z_A', misconception: 'TROCAR_Z_E_A', prompt: 'Marque Z como prótons e A como prótons+nêutrons. Subtraia A−Z e confira se P+N=A.' },
      { id: 'TRACE_CHARGE', misconception: 'INVERTER_CARGA_E_ELETRONS', prompt: 'Escreva q=P−E. Se q é negativo, determine quantos elétrons existem além dos prótons.' },
      { id: 'COMPARE_NUCLEI', misconception: 'CONFUNDIR_ISOTOPO_E_ION', prompt: 'Compare primeiro Z e N para classificar o núcleo; depois compare P e E para classificar a carga.' },
      { id: 'AUDIT_NOTATION', misconception: 'LER_POSICAO_ERRADA', prompt: 'Circule o número inferior esquerdo (Z), o superior esquerdo (A) e a carga à direita antes de calcular.' },
      { id: 'AVERAGE_VS_NUCLIDE', misconception: 'MEDIA_COMO_NUMERO_DE_MASSA', prompt: 'Calcule a média ponderada de abundâncias e compare-a com os valores inteiros de A dos isótopos.' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 22,
    sourceDossier: [
      { title: 'IUPAC Gold Book: atomic number', publisher: 'International Union of Pure and Applied Chemistry', url: 'https://goldbook.iupac.org/terms/view/A00499', accessedOn: '2026-10-13', supports: ['Z é a quantidade de prótons do núcleo.'], use: 'Referência terminológica para validar a definição; exemplos e explicações do pacote são autorais.' },
      { title: 'IUPAC Gold Book: mass number', publisher: 'International Union of Pure and Applied Chemistry', url: 'https://goldbook.iupac.org/terms/view/M03726', accessedOn: '2026-10-13', supports: ['A conta prótons e nêutrons do núcleo.'], use: 'Referência terminológica para validar a definição; exemplos e explicações do pacote são autorais.' },
      { title: 'IUPAC Gold Book: isotopes', publisher: 'International Union of Pure and Applied Chemistry', url: 'https://goldbook.iupac.org/terms/view/I03331', accessedOn: '2026-10-13', supports: ['Isótopos têm o mesmo número atômico e diferentes números de massa.'], use: 'Referência terminológica para validar a distinção; exemplos e questões do pacote são autorais.' },
      { title: 'Chemistry 2e, Section 2.3: Atomic Structure and Symbolism', publisher: 'OpenStax', url: 'https://openstax.org/books/chemistry-2e/pages/2-3-atomic-structure-and-symbolism', accessedOn: '2026-10-13', supports: ['Interpretação de número atômico, número de massa e símbolos nucleares.'], use: 'Conferência conceitual; o pacote não reproduz exercícios ou texto do livro.' },
      { title: 'Chemistry 2e, Section 2.6: Ionic and Molecular Compounds', publisher: 'OpenStax', url: 'https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds', accessedOn: '2026-10-13', supports: ['Formação de íons por variação de elétrons sem alteração do número de prótons em reações químicas comuns.'], use: 'Conferência conceitual; o pacote não reproduz exercícios ou texto do livro.' },
    ],
    copyrightNote: 'Questões, cenários, explicações e dados foram escritos para este pacote. Fontes sustentam a precisão conceitual; o alinhamento curricular oficial e a revisão pedagógica humana permanecem pendentes.',
  },
  questions,
};

export function buildChemistryAtomicStructurePack() {
  return pack;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  process.stdout.write(`Built ${questions.length} original atomic-structure questions: ${OUTPUT}\n`);
}
