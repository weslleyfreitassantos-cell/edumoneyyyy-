import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/chemistry-reaction-evidence.json');

const rows = [
  ['probe-01', 'PROBE', 'EASY', 'DISTINGUISH', 'SUGAR_DISSOLUTION_RECOVERY', 'Açúcar é misturado à água e deixa de ser visível. Depois, a água evapora e cristais de açúcar aparecem no recipiente. Qual conclusão é mais compatível com as observações?', 'O açúcar se dissolveu e voltou a cristalizar; não há evidência de uma substância nova.', ['O açúcar reagiu porque desapareceu da vista.', 'A evaporação transformou açúcar em água.', 'Os cristais provam que uma reação ocorreu durante a dissolução.'], 'A dissolução dispersa partículas na água, e a evaporação permite recuperar o açúcar. Mudança de aparência, sem mudança de composição, é física.', 'Interpretar o desaparecimento visual durante dissolução como formação de outra substância.', 'Pergunte se a composição mudou ou se as mesmas partículas apenas se dispersaram e puderam ser recuperadas.', 0],
  ['probe-02', 'PROBE', 'MEDIUM', 'EVALUATE', 'DYE_MIXTURE_CHROMATOGRAPHY', 'Duas soluções de corantes são misturadas e ficam roxas. Uma análise posterior separa novamente os mesmos dois corantes, sem detectar produtos diferentes. O que a mudança de cor permite concluir?', 'Sozinha, não demonstra reação; os dados mostram uma mistura física dos corantes originais.', ['A cor roxa prova que surgiu uma substância nova.', 'A análise não importa, pois toda mistura de soluções é reação.', 'Os corantes deixaram de existir porque a cor mudou.'], 'A cor observada mudou, mas a análise recuperou os mesmos componentes. Uma mudança de cor pode ser pista, não prova isolada de reação.', 'Tomar qualquer mudança de cor como prova conclusiva de transformação química.', 'Separe a observação visual dos dados sobre quais substâncias estavam presentes antes e depois.', 1],
  ['practice-01', 'PRACTICE', 'MEDIUM', 'ANALYZE', 'COLORLESS_SOLUTIONS_CONTROLLED_PRECIPITATE', 'Duas soluções transparentes formam um sólido ao serem combinadas. Em ensaios de controle, cada solução permanece transparente quando submetida sozinha às mesmas condições. Qual interpretação é mais forte?', 'A formação do sólido, ausente nos controles, sustenta a hipótese de uma nova substância insolúvel.', ['A transparência inicial prova que as soluções eram a mesma substância.', 'O sólido é necessariamente um reagente que já estava visível.', 'Nenhuma conclusão é possível mesmo com controles e produto diferente.'], 'O sólido aparece apenas quando os reagentes interagem. Um precipitado com propriedades diferentes das soluções é evidência convergente de formação de produto.', 'Ignorar controles ou afirmar uma causa sem comparar os reagentes isolados.', 'Compare o resultado da mistura com cada controle e procure uma propriedade do sólido diferente das soluções iniciais.', 2],
  ['practice-02', 'PRACTICE', 'EASY', 'COMPARE', 'DISTILLATION_WATER_IDENTITY', 'Durante uma demonstração, água líquida ferve, o vapor passa por um condensador e volta a ser coletado como líquido. Qual afirmação descreve melhor o processo observado?', 'A água mudou de estado e voltou ao líquido; isso, por si só, não indica uma reação química.', ['A água se decompôs porque apareceram bolhas.', 'O condensador criou uma substância nova ao resfriar o vapor.', 'A ebulição prova que os átomos de hidrogênio desapareceram.'], 'Ebulição e condensação são mudanças de estado. Se a substância recuperada continua sendo água, não se identificou mudança química.', 'Confundir ebulição e condensação com reação por causa da formação de vapor.', 'Verifique se houve apenas mudança de estado ou se os produtos têm composição diferente da água.', 3],
  ['practice-03', 'PRACTICE', 'HARD', 'EVALUATE', 'REACTION_EVIDENCE_CONVERGING_TABLE', 'Três equipes analisam amostras. Na A, um líquido aquecido produz bolhas; na B, uma mistura forma um sólido que não aparece nos controles; na C, duas tintas apenas se misturam. Qual resultado oferece a evidência mais forte de reação?', 'A equipe B, porque o sólido novo aparece após a interação e não nos controles.', ['A equipe A, pois qualquer bolha prova reação.', 'A equipe C, pois qualquer cor final diferente prova produto químico.', 'As três equipes têm evidência igualmente conclusiva.'], 'Bolhas podem vir de ebulição, e misturar pigmentos pode alterar a cor sem criar substância. Um sólido novo, ausente em controles comparáveis, sustenta melhor a hipótese química.', 'Escolher a pista mais visível sem considerar explicações alternativas e controles.', 'Procure uma mudança que dependa da interação dos reagentes e compare com controles adequados.', 0],
  ['transfer-01', 'TRANSFER', 'HARD', 'EVALUATE', 'BREAD_FERMENTATION_BLANK_CONTROL', 'Em dois frascos com a mesma solução açucarada, apenas aquele que recebeu levedura produz gás. A análise identifica dióxido de carbono e etanol nesse frasco; o controle sem levedura não apresenta esses produtos. Qual conclusão é sustentada?', 'Os dados apoiam uma transformação química associada à fermentação, com produtos diferentes dos reagentes.', ['Apenas ocorreu ebulição, embora o frasco não tenha sido aquecido.', 'O açúcar mudou de estado e por isso virou dióxido de carbono.', 'O controle prova que qualquer gás em líquido é produto químico.'], 'Produtos identificados apenas no sistema com levedura e açúcar sustentam a formação de novas substâncias. O controle ajuda a excluir produção espontânea ou causada pelo recipiente.', 'Confundir a observação de gás com a explicação do processo sem usar o controle e a análise dos produtos.', 'Compare os produtos do frasco com levedura ao controle e identifique o que mudou na composição.', 1],
  ['transfer-02', 'TRANSFER', 'MEDIUM', 'INTERPRET', 'SODA_BOTTLE_PRESSURE_RELEASE', 'Ao abrir uma garrafa de água gaseificada, surgem bolhas e o som de liberação de gás. A quantidade de dióxido de carbono dissolvido diminui, mas não há reagentes novos nem produtos detectados. Qual interpretação é adequada?', 'O gás dissolvido está saindo da solução após a queda de pressão; as bolhas não demonstram uma reação nova.', ['O dióxido de carbono foi produzido por uma reação porque se tornou visível.', 'A água se decompôs em gás e líquido ao abrir a tampa.', 'Toda liberação de gás transforma a bebida em outra substância.'], 'A abertura altera a pressão e favorece a saída do dióxido de carbono que já estava dissolvido. A observação de bolhas não basta para afirmar que houve reação.', 'Supor que um gás observado necessariamente se formou durante o evento.', 'Pergunte se o gás foi produzido por reagentes ou se já estava dissolvido e apenas escapou.', 2],
  ['transfer-03', 'TRANSFER', 'HARD', 'ANALYZE', 'IRON_CORROSION_DRY_MOIST_CONTROLS', 'Três peças iguais de ferro ficam em condições distintas: ar seco, água sem contato com ar e ar úmido. Apenas na última aparece uma camada de ferrugem; a inspeção confirma material com propriedades diferentes do ferro. O que os dados sustentam?', 'A interação do ferro com água e oxigênio favoreceu uma transformação química; os controles ajudam a identificar as condições necessárias.', ['A ferrugem é somente água que mudou de estado sobre o ferro.', 'O controle em ar seco prova que o ferro nunca reage com oxigênio.', 'A camada confirma que a massa de ferro foi destruída.'], 'O produto com propriedades diferentes aparece na condição que reúne umidade e oxigênio. Comparar controles permite avaliar quais condições acompanham a corrosão.', 'Atribuir ferrugem a uma única condição sem considerar a comparação controlada.', 'Compare as condições dos três recipientes e relacione o produto observado às condições que ocorreram juntas.', 3],
  ['lock-01', 'LOCK_IN', 'HARD', 'DISTINGUISH', 'CANDLE_MELTING_AND_COMBUSTION', 'Ao acender uma vela, a cera próxima ao pavio derrete e a chama libera gases. Qual análise separa corretamente os dois fenômenos?', 'Derreter a cera é mudança física; a combustão da cera vaporizada forma substâncias diferentes e é química.', ['Os dois fenômenos são físicos porque ocorrem na mesma vela.', 'Os dois são reações porque a vela muda de forma.', 'A chama é física, mas derreter a cera é uma reação química.'], 'A cera líquida continua sendo cera, então a fusão é física. Na combustão, a cera reage com oxigênio e origina produtos com composição diferente.', 'Classificar processos simultâneos como se todos tivessem a mesma natureza.', 'Analise cada etapa separadamente: mudança de estado e formação de produtos são evidências diferentes.', 0],
  ['review-01', 'REVIEW', 'MEDIUM', 'EVALUATE', 'OPEN_REACTOR_ESCAPING_GAS_MASS', 'Uma reação que libera gás ocorre em um frasco aberto sobre uma balança. A massa indicada diminui, mas o gás que sai é coletado em outro recipiente e também pesado. Como interpretar o resultado?', 'A leitura do frasco diminui porque parte da matéria saiu; ao incluir o gás coletado, a massa total se conserva.', ['A reação destruiu matéria, pois o frasco ficou mais leve.', 'A massa do gás não conta porque ele deixou o recipiente.', 'A queda na balança prova que não houve reação química.'], 'A balança do frasco aberto mede apenas o que permaneceu nele. Somando o gás que escapou, o sistema ampliado inclui a matéria transferida e conserva a massa.', 'Confundir a fronteira do sistema medido com a quantidade total de matéria.', 'Defina o que está dentro do sistema da balança e inclua a matéria que saiu ao comparar o total.', 1],
  ['review-02', 'REVIEW', 'EASY', 'DISTINGUISH', 'APPLE_BROWNING_AFTER_CUT', 'Uma maçã cortada escurece após ficar exposta ao ar. Qual dado favorece a interpretação de transformação química, em vez de simples mudança de forma?', 'A exposição ao oxigênio acompanha a formação de compostos escuros diferentes dos presentes na polpa fresca.', ['O corte aumentou a área exposta, portanto nenhuma mudança química pode ocorrer.', 'A cor prova sozinha que uma substância específica foi formada.', 'A maçã perdeu todos os átomos de sua superfície.'], 'O corte é uma mudança física, mas o escurecimento envolve reações com o oxigênio e a formação de compostos diferentes. A cor é uma pista interpretada junto da evidência sobre os produtos.', 'Confundir o corte físico com os processos químicos posteriores ou usar cor como prova isolada.', 'Separe o efeito mecânico do corte das mudanças que ocorreram depois da exposição ao ar.', 2],
  ['review-03', 'REVIEW', 'MEDIUM', 'COMPARE', 'REUSABLE_HANDWARMER_CRYSTALLIZATION', 'Em um aquecedor reutilizável, uma solução supersaturada cristaliza após um gatilho e libera calor. Depois, o sólido pode voltar a se dissolver quando aquecido, sem formar outros produtos. Qual conclusão é mais compatível?', 'A cristalização é uma mudança física de organização e estado; a liberação de calor não prova, sozinha, reação.', ['A liberação de calor comprova que novas substâncias foram formadas.', 'O cristal é necessariamente um produto químico porque é sólido.', 'O processo destruiu a solução e criou matéria do recipiente.'], 'A mesma substância pode cristalizar e depois se dissolver. Mudança térmica acompanha o processo, mas, sem mudança de composição, não basta para classificá-lo como reação.', 'Tratar qualquer variação de temperatura ou formação de sólido como prova de reação.', 'Use a possibilidade de recuperar a mesma composição e procure evidência de produtos diferentes.', 3],
  ['review-04', 'REVIEW', 'HARD', 'ANALYZE', 'SEALED_REACTION_MASS_BALANCE', 'Dois reagentes são misturados dentro de um recipiente selado. Há mudança de cor e formação de um sólido; a massa total antes e depois permanece igual. Qual afirmação concilia as observações?', 'Uma reação pode formar substâncias novas e conservar a massa total em sistema fechado.', ['A massa igual prova que nenhuma reação aconteceu.', 'A cor mudou, então os átomos deixaram de ser conservados.', 'O sólido formado precisa ter vindo de fora do recipiente.'], 'Uma reação reorganiza átomos sem criar ou destruir matéria. A massa total do sistema fechado pode permanecer igual enquanto as substâncias mudam.', 'Interpretar conservação da massa como ausência de transformação química.', 'Separe conservação dos átomos e da massa da identidade das substâncias antes e depois.', 0],
  ['review-05', 'REVIEW', 'MEDIUM', 'EVALUATE', 'INDICATOR_COLOR_CONTROLLED_PH', 'Um indicador muda de cor quando é adicionado a uma solução. Para avaliar se a amostra também sofreu outra reação, qual informação é mais útil?', 'Comparar a amostra a um controle e analisar se apareceram produtos diferentes, além da resposta de cor do indicador.', ['A cor, sozinha, identifica todos os produtos formados.', 'O indicador sempre reage com qualquer substância da solução.', 'Nenhum controle é necessário porque a cor é uma prova direta.'], 'A cor do indicador responde às condições químicas da solução, mas não descreve por si só toda a composição da amostra. Controle e análise de produtos delimitam a conclusão.', 'Atribuir ao material analisado toda mudança de cor causada pelo próprio indicador.', 'Considere o papel do indicador e compare a amostra com um controle sem a mudança investigada.', 1],
  ['review-06', 'REVIEW', 'HARD', 'DESIGN', 'FAIR_CONTROL_FOR_COLOR_CHANGE', 'Uma estudante quer testar se duas soluções reagem para formar um produto colorido. Qual desenho oferece a comparação mais informativa?', 'Manter volumes, temperatura e recipiente iguais, testar cada solução isolada e a mistura, repetir e comparar a composição final.', ['Misturar volumes diferentes e comparar com uma solução de outro recipiente.', 'Testar somente a mistura e concluir a partir da primeira cor observada.', 'Alterar temperatura e iluminação ao mesmo tempo para acelerar a mudança.'], 'Controles isolam o efeito da interação entre as soluções. Repetições e condições constantes ajudam a separar produto novo de cor inicial, iluminação ou aquecimento.', 'Mudar várias condições ao mesmo tempo e atribuir o resultado a uma única causa.', 'Mantenha as condições constantes e inclua controles de cada reagente isolado.', 2],
  ['review-07', 'REVIEW', 'MEDIUM', 'JUSTIFY', 'CLAIM_EVIDENCE_REASONING_FINAL', 'Um relatório afirma: “Houve reação química porque a mistura borbulhou”. Qual revisão transforma a afirmação em uma conclusão melhor justificada?', 'Registrar as bolhas como observação, comparar com controles e buscar evidência de produto novo antes de concluir.', ['Manter a frase, pois bolhas são prova universal de reação.', 'Trocar “borbulhou” por “mudou de cor” e manter a mesma conclusão.', 'Concluir que ocorreu ebulição sem verificar a temperatura.'], 'Uma conclusão científica distingue observação de inferência e avalia alternativas, como gás dissolvido ou ebulição. Evidência de produto novo e controles fortalecem a afirmação.', 'Apresentar uma inferência como fato sem mostrar dados que a sustentem.', 'Escreva separadamente o que foi observado, a hipótese e o teste que poderia diferenciá-la de alternativas.', 3],
];

const expectedPurposeCounts = { PROBE: 2, PRACTICE: 3, TRANSFER: 3, LOCK_IN: 1, REVIEW: 7 };
const positionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  positionCounts[answerPosition] += 1;
  return {
    id: `v5-chem-reaction-evidence-${id}`,
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
  contentId: 'v5-chemistry-reaction-evidence',
  subject: 'CHEMISTRY',
  domain: 'REACOES',
  topic: 'evidencias e limites ao interpretar transformacoes quimicas',
  canonicalSkillCode: 'CHEMISTRY_REACTION_EVIDENCE',
  contentVersion: 5,
  expectedQuestionCount: questions.length,
  expectedContextCount: new Set(questions.map((question) => question.contextFamily)).size,
  expectedAnswerPositionCounts: Object.fromEntries(['A', 'B', 'C', 'D'].map((label, index) => [label, positionCounts[index]])),
  expectedPurposeCounts,
  officialMappingStatus: 'NOT_CLAIMED',
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  publicationStatus: 'STAGING',
  contentAuthoringStatus: 'AUTHORED',
  questions,
  lesson: {
    title: 'Evidências: o que os dados permitem concluir',
    objective: 'Distinguir mudanças físicas de transformações químicas e justificar conclusões sobre formação de novas substâncias com evidências, controles e explicações alternativas.',
    summary: 'Bolhas, cor, temperatura e sólidos são observações úteis, mas uma pista isolada pode ter causas físicas. Compare controles, investigue produtos e delimite a conclusão.',
    explanation: '## Comece pelo que foi observado\nRegistre sem interpretar: surgiu gás, apareceu um sólido, a cor mudou, a temperatura variou ou houve mudança de estado? Em seguida, pergunte se alguma substância nova foi formada. Uma transformação química envolve reagentes que dão origem a produtos com composição ou identidade diferente.\n\n## Uma pista não é uma prova isolada\nBolhas podem resultar de ebulição ou da saída de gás já dissolvido; uma cor pode mudar porque pigmentos se misturaram ou porque um indicador respondeu ao pH; a temperatura pode variar durante dissolução ou cristalização. Essas observações orientam uma hipótese, mas devem ser comparadas a outras explicações.\n\n## Compare e controle\nTeste cada reagente isoladamente nas mesmas condições e compare com a mistura. Mantenha volumes, recipiente, temperatura e iluminação constantes, quando forem relevantes. Repita observações e procure propriedades de produtos diferentes dos reagentes. Um sólido que aparece apenas na mistura e apresenta propriedades próprias sustenta a hipótese de precipitação.\n\n## Explique no nível das partículas\nEm uma reação, os átomos dos reagentes se reorganizam e formam substâncias diferentes; os átomos não desaparecem. Em um sistema fechado, a massa total se conserva. Em um recipiente aberto, uma leitura pode diminuir se um gás sair: isso muda a fronteira do que a balança está medindo, não a quantidade total de matéria.\n\n## Exemplo resolvido\nDuas soluções transparentes são misturadas e surge um sólido branco. Controles de cada solução, preparados e mantidos nas mesmas condições, continuam transparentes. Uma análise adicional mostra que o sólido tem propriedades diferentes das soluções iniciais. A combinação de controle, produto distinto e observação reproduzível sustenta a conclusão de que ocorreu uma transformação química. Se o único dado fossem bolhas em um líquido aquecido, ebulição continuaria sendo uma explicação possível.',
    workedExample: 'Em três recipientes iguais, a solução A fica sozinha, a solução B fica sozinha e A+B são misturadas. Apenas A+B forma um sólido. A observação é “surgiu um sólido”; a inferência é “pode ter se formado um produto insolúvel”. Controles iguais e uma comparação das propriedades do sólido com as dos reagentes tornam a inferência mais forte. A conclusão não deve ir além dos dados coletados.',
    commonMistake: 'Tratar bolhas, cor, temperatura ou mudança de estado como prova automática, sem considerar controles, produtos e explicações físicas alternativas.',
    commonErrors: ['Confundir observação com explicação e apresentar uma hipótese como certeza.', 'Tomar bolhas ou mudança de cor como prova sem testar causas físicas.', 'Ignorar controles que mostram o que acontece com cada reagente isolado.', 'Interpretar a queda de massa em sistema aberto como matéria destruída.', 'Afirmar formação de um produto específico sem dados que identifiquem sua composição.'],
    tips: ['Escreva primeiro a observação e depois a inferência.', 'Pergunte quais explicações físicas também poderiam produzir o sinal.', 'Compare a mistura com controles nas mesmas condições.', 'Procure propriedades ou composição de produtos diferentes dos reagentes.', 'Defina a fronteira do sistema antes de interpretar massa medida.'],
    priorKnowledge: ['Reconhecer estados físicos e propriedades observáveis.', 'Distinguir observação, hipótese e conclusão.', 'Ler tabelas simples de comparação entre amostras.'],
    keyConcepts: ['mudança física e identidade da substância', 'formação de novas substâncias por reorganização de átomos', 'gás, precipitado, cor e temperatura como evidências contextualizadas', 'controle experimental e explicações alternativas', 'conservação da matéria em sistema fechado'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Separar observação de inferência e reconhecer mudanças físicas.', questionIds: idsFor('PROBE') },
      { stage: 'APPLICATION', focus: 'Interpretar evidências em situações controladas e comparáveis.', questionIds: idsFor('PRACTICE') },
      { stage: 'TRANSFER', focus: 'Aplicar o raciocínio a processos biológicos, ambientais e cotidianos.', questionIds: idsFor('TRANSFER') },
      { stage: 'INTEGRATION', focus: 'Combinar sinais, controles e conservação da matéria para justificar conclusões.', questionIds: idsFor('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Recuperar a distinção entre pista, produto e prova em novos contextos.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'OBSERVATION_VS_INFERENCE', text: '“Vi bolhas” é observação; “formou-se um produto” é inferência que precisa de evidência.' },
      { trigger: 'ALTERNATIVE_PHYSICAL_CAUSE', text: 'Ebulição, gás dissolvido e mistura de pigmentos podem explicar alguns sinais sem uma reação nova.' },
      { trigger: 'NEW_SUBSTANCE', text: 'A evidência mais importante é que uma ou mais substâncias diferentes foram formadas.' },
      { trigger: 'CONTROL_COMPARISON', text: 'Controles nas mesmas condições mostram se a mudança dependeu da interação entre os reagentes.' },
      { trigger: 'MATTER_CONSERVATION_BOUNDARY', text: 'Em recipiente aberto, gás que escapa deixa de ser contado pela balança local; a matéria não desaparece.' },
      { trigger: 'CLAIM_SCOPE', text: 'A conclusão deve ser tão forte quanto os dados, sem nomear produtos que não foram identificados.' },
    ],
    remediations: [
      { id: 'SIGN_IS_NOT_PROOF', misconception: 'BOLHA_COR_OU_TEMPERATURA_COMO_PROVA', prompt: 'Liste uma causa física para o sinal observado e compare-a com a hipótese de reação.' },
      { id: 'OBSERVATION_INFERENCE', misconception: 'OBSERVACAO_COMO_CONCLUSAO', prompt: 'Separe a frase em dado observado, hipótese e informação que falta para testar a hipótese.' },
      { id: 'CONTROL_DESIGN', misconception: 'CONTROLE_AUSENTE', prompt: 'Descreva como cada reagente se comportaria sozinho nas mesmas condições da mistura.' },
      { id: 'OPEN_SYSTEM_MASS', misconception: 'MATERIA_DESTRUIDA', prompt: 'Desenhe a fronteira do sistema medido e identifique se algum gás saiu ou entrou.' },
      { id: 'PRODUCT_IDENTITY', misconception: 'PRODUTO_NAO_IDENTIFICADO', prompt: 'Compare uma propriedade do produto com as propriedades conhecidas dos reagentes antes de nomeá-lo.' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 22,
    sourceDossier: [
      {
        title: 'Chemistry 2e, Section 1.3: Physical and Chemical Properties',
        publisher: 'OpenStax',
        url: 'https://openstax.org/books/chemistry-2e/pages/1-3-physical-and-chemical-properties',
        accessedOn: '2026-10-13',
        supports: ['Mudanças físicas alteram estado ou propriedades sem alterar a identidade química.', 'Uma mudança química produz matéria diferente da presente antes da mudança.'],
        use: 'Conferência conceitual; questões e explicações do pacote são autorais.',
      },
      {
        title: 'Chemistry 2e, Section 1.2: Phases and Classification of Matter',
        publisher: 'OpenStax',
        url: 'https://openstax.org/books/chemistry-2e/pages/1-2-phases-and-classification-of-matter',
        accessedOn: '2026-10-13',
        supports: ['A matéria total se conserva em mudanças químicas e físicas; a medição pode não incluir matéria que saiu do sistema.'],
        use: 'Conferência da explicação sobre conservação da matéria e fronteira de sistemas abertos.',
      },
      {
        title: 'Lesson 6.3: Forming a Precipitate',
        publisher: 'American Chemical Society',
        url: 'https://www.acs.org/middleschoolchemistry/lessonplans/chapter6/lesson3.html',
        accessedOn: '2026-10-13',
        supports: ['A comparação controlada das propriedades do precipitado e dos reagentes pode confirmar a formação de substância diferente.'],
        use: 'Referência didática para uso de controles e comparação de propriedades; texto e atividades do pacote são autorais.',
      },
      {
        title: 'Lesson 3.5: Different Substances React Differently',
        publisher: 'American Chemical Society',
        url: 'https://www.acs.org/education/resources/k-8/inquiryinaction/fifth-grade/chapter-3/different-substances-react-differently.html',
        accessedOn: '2026-10-13',
        supports: ['Gás, mudança de cor, temperatura e precipitado são evidências possíveis de reação, interpretadas em contexto.'],
        use: 'Conferência das pistas observáveis e dos exemplos; não é fonte de alinhamento BNCC para este pacote.',
      },
    ],
    copyrightNote: 'Questões, cenários, explicações e dados foram escritos para este pacote. As fontes conferem conceitos; alinhamento curricular oficial e revisão pedagógica humana permanecem pendentes.',
  },
};

export function buildChemistryReactionEvidencePack() {
  return structuredClone(pack);
}

if (JSON.stringify(expectedPurposeCounts) !== JSON.stringify(Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length])))) {
  throw new Error('CHEMISTRY_REACTION_EVIDENCE_V5_QUESTION_COUNTS_INVALID');
}
if (positionCounts.some((count) => count !== 4)) throw new Error('CHEMISTRY_REACTION_EVIDENCE_V5_ANSWER_POSITIONS_UNBALANCED');

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${questions.length} original chemistry-reaction-evidence questions to ${OUTPUT}`);
}
