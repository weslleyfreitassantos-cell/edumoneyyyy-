import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/chemistry-stoichiometry.json');

const rows = [
  ['practice-01', 'PRACTICE', 'EASY', 'APPLY', 'ALUMINUM_CHLORIDE_MOLE_RATIO', 'Na equação balanceada 2 Al + 3 Cl₂ → 2 AlCl₃, o alumínio está em excesso. Se 9 mol de Cl₂ reagirem completamente, quantos mol de AlCl₃ podem se formar?', '6 mol', ['3 mol', '9 mol', '12 mol'], 'A razão entre Cl₂ e AlCl₃ é 3:2. Multiplicando os dois coeficientes por 3, 9 mol de Cl₂ correspondem a 6 mol de AlCl₃.', 'Usar o coeficiente do reagente como se fosse a quantidade de produto.', 'Escreva a fração molar produto/reagente com os coeficientes 2/3 e aplique-a a 9 mol de Cl₂.', 0],
  ['practice-02', 'PRACTICE', 'MEDIUM', 'CALCULATE', 'METHANE_MASS_TO_CARBON_DIOXIDE', 'Na combustão CH₄ + 2 O₂ → CO₂ + 2 H₂O, há oxigênio suficiente. Considere M(CH₄) = 16 g/mol e M(CO₂) = 44 g/mol. Que massa de CO₂ pode ser formada a partir de 32 g de CH₄?', '88 g', ['44 g', '32 g', '16 g'], '32 g de CH₄ equivalem a 2 mol. A razão CH₄:CO₂ é 1:1, então formam-se 2 mol de CO₂; 2 × 44 g/mol = 88 g.', 'Converter massa diretamente pela razão dos coeficientes, sem passar por mol.', 'Faça a cadeia g CH₄ → mol CH₄ → mol CO₂ → g CO₂ e confira o cancelamento das unidades.', 2],
  ['practice-03', 'PRACTICE', 'MEDIUM', 'APPLY', 'IRON_OXIDE_CO_REDUCTION', 'Na reação balanceada Fe₂O₃ + 3 CO → 2 Fe + 3 CO₂, o CO está em excesso. Partindo de 1,5 mol de Fe₂O₃, qual é a quantidade máxima de ferro produzida?', '3 mol', ['1,5 mol', '4,5 mol', '6 mol'], 'A equação relaciona 1 mol de Fe₂O₃ a 2 mol de Fe. Assim, 1,5 mol × 2 = 3 mol de Fe.', 'Achar que os coeficientes descrevem uma única reação indivisível, sem poder escalar a proporção.', 'Compare os coeficientes de Fe₂O₃ e Fe: para cada 1 mol do primeiro, formam-se 2 mol do segundo.', 1],
  ['practice-04', 'PRACTICE', 'MEDIUM', 'CALCULATE', 'POTASSIUM_CHLORATE_OXYGEN', 'A decomposição é 2 KClO₃ → 2 KCl + 3 O₂. Se 4 mol de KClO₃ se decompõem completamente, quantos mol de O₂ são formados?', '6 mol', ['3 mol', '4 mol', '8 mol'], 'A razão KClO₃:O₂ é 2:3. Duplicar 2 mol para 4 mol também duplica 3 mol para 6 mol.', 'Trocar a razão produto/reagente ou ignorar o coeficiente 3 do oxigênio.', 'Use 3 mol O₂ / 2 mol KClO₃ como fator e multiplique por 4 mol KClO₃.', 3],
  ['practice-05', 'PRACTICE', 'HARD', 'CALCULATE', 'CERAMIC_PROCESS_PERCENT_YIELD', 'Um processo cerâmico tinha rendimento teórico de 20 kg de produto e forneceu 14 kg após a separação. Qual foi o rendimento percentual?', '70%', ['60%', '140%', '35%'], 'Rendimento percentual = rendimento real ÷ rendimento teórico × 100. Portanto, 14 ÷ 20 × 100 = 70%.', 'Dividir o rendimento teórico pelo real ou inverter numerador e denominador.', 'Coloque a quantidade realmente obtida no numerador e a quantidade prevista no denominador.', 1],
  ['transfer-01', 'TRANSFER', 'MEDIUM', 'PLAN', 'AMMONIA_FEEDSTOCK_REQUIREMENT', 'Na síntese N₂ + 3 H₂ → 2 NH₃, uma fábrica planeja produzir 8 mol de NH₃ sem sobra de reagentes. Quantos mol de N₂ e H₂ são necessários?', '4 mol de N₂ e 12 mol de H₂.', ['8 mol de N₂ e 12 mol de H₂.', '4 mol de N₂ e 8 mol de H₂.', '12 mol de N₂ e 4 mol de H₂.'], 'A razão 1:3:2 deve ser multiplicada por 4 para que o produto passe de 2 para 8 mol. Isso exige 4 mol de N₂ e 12 mol de H₂.', 'Multiplicar somente o coeficiente do produto ou associar os coeficientes às espécies erradas.', 'Encontre o fator comum entre 2 mol de NH₃ e 8 mol; aplique-o aos dois reagentes.', 0],
  ['transfer-02', 'TRANSFER', 'MEDIUM', 'CALCULATE', 'LIMESTONE_ACID_NEUTRALIZATION', 'A reação CaCO₃ + 2 HCl → CaCl₂ + CO₂ + H₂O ocorre com HCl em excesso. Considere M(CaCO₃) = 100 g/mol e M(CO₂) = 44 g/mol. Qual massa de CO₂ pode resultar de 50 g de CaCO₃?', '22 g', ['44 g', '50 g', '11 g'], '50 g de CaCO₃ correspondem a 0,50 mol. A razão CaCO₃:CO₂ é 1:1, então formam-se 0,50 mol de CO₂, ou 22 g.', 'Usar a proporção entre massas como se massa e mol tivessem a mesma razão dos coeficientes.', 'Converta 50 g de CaCO₃ em mol, aplique a razão 1:1 e converta o CO₂ de volta para gramas.', 1],
  ['transfer-03', 'TRANSFER', 'HARD', 'INTERPRET', 'BAKING_SODA_GAS_QUANTITY', 'No modelo 2 NaHCO₃ → Na₂CO₃ + CO₂ + H₂O, considere M(NaHCO₃) = 84 g/mol. Uma amostra de 252 g se decompõe completamente. Quantos mol de CO₂ são previstos?', '1,5 mol', ['3 mol', '2 mol', '0,5 mol'], '252 g ÷ 84 g/mol = 3 mol de NaHCO₃. Como 2 mol do reagente formam 1 mol de CO₂, a quantidade prevista é 1,5 mol.', 'Confundir a quantidade do reagente com a do produto ou esquecer o coeficiente 2.', 'Primeiro descubra quantos mol de NaHCO₃ existem; depois use a razão 1 mol CO₂ para 2 mol NaHCO₃.', 2],
  ['transfer-04', 'TRANSFER', 'HARD', 'ANALYZE', 'ANTACID_LIMITING_REACTANT', 'No modelo NaHCO₃ + HCl → NaCl + CO₂ + H₂O, um ensaio usa 0,75 mol de NaHCO₃ e 0,50 mol de HCl. Admitindo reação completa, qual conclusão está correta?', 'HCl é limitante e podem se formar 0,50 mol de CO₂.', ['NaHCO₃ é limitante e podem se formar 0,75 mol de CO₂.', 'Nenhum reagente é limitante porque a equação tem coeficientes iguais.', 'HCl é limitante e podem se formar 0,75 mol de CO₂.'], 'A proporção entre NaHCO₃, HCl e CO₂ é 1:1:1. Os 0,50 mol de HCl reagem com 0,50 mol de NaHCO₃ e limitam a formação a 0,50 mol de CO₂.', 'Comparar apenas os nomes ou massas dos reagentes, em vez de comparar suas quantidades com a proporção da equação.', 'Para coeficientes iguais, o menor número de mol limita; o produto acompanha esse mesmo número.', 3],
  ['transfer-05', 'TRANSFER', 'HARD', 'EVALUATE', 'INDUSTRIAL_PRODUCT_RECOVERY', 'Uma linha de produção previa teoricamente 250 kg de um material e recuperou 210 kg após purificação. Qual leitura combina corretamente rendimento e perda de processo?', 'O rendimento foi 84%; a diferença de 40 kg não deve ser chamada de produto recuperado.', ['O rendimento foi 119%; a massa recuperada supera a prevista.', 'O rendimento foi 16%; esse valor é a razão entre a perda e o total previsto.', 'O rendimento foi 40%; esse valor é a massa que não foi recuperada.'], '210 ÷ 250 × 100 = 84%. Os 40 kg são a diferença entre previsão e recuperação, não o rendimento percentual.', 'Confundir a massa perdida com a razão percentual ou inverter a fração.', 'Calcule primeiro a fração 210/250; só depois transforme-a em porcentagem.', 0],
  ['lock-01', 'LOCK_IN', 'HARD', 'INTEGRATE', 'ALUMINUM_CHLORIDE_MASS_LIMITING', 'Na reação 2 Al + 3 Cl₂ → 2 AlCl₃, misturam-se 54 g de Al e 284 g de Cl₂. Considere M(Al) = 27 g/mol e M(Cl₂) = 71 g/mol. Qual é o resultado teórico?', 'Al é limitante e podem se formar 2 mol de AlCl₃.', ['Cl₂ é limitante e podem se formar 4 mol de AlCl₃.', 'Al é limitante e podem se formar 4 mol de AlCl₃.', 'Os reagentes estão na proporção exata e formam 3 mol de AlCl₃.'], '54 g Al = 2 mol e 284 g Cl₂ = 4 mol. Dois mol de Al exigem 3 mol de Cl₂; portanto, Al limita e 2 mol de AlCl₃ são previstos.', 'Escolher o reagente limitante comparando apenas os mol disponíveis, sem dividir pela proporção da equação.', 'Compare 2/2 para Al e 4/3 para Cl₂: o menor quociente indica quanto a reação pode avançar.', 1],
  ['lock-02', 'LOCK_IN', 'HARD', 'INTEGRATE', 'MAGNESIUM_OXIDE_MASS_BALANCE', 'A reação 2 Mg + O₂ → 2 MgO recebe 48 g de Mg e 48 g de O₂. Considere M(Mg) = 24 g/mol e M(O₂) = 32 g/mol; M(MgO) = 40 g/mol. Qual massa teórica de MgO pode ser formada?', '80 g', ['40 g', '96 g', '120 g'], '48 g Mg = 2 mol, enquanto 48 g O₂ = 1,5 mol. Os 2 mol de Mg exigem 1 mol de O₂, então Mg limita e formam-se 2 mol MgO = 80 g.', 'Supor que o reagente com menor massa sempre limita ou esquecer de converter cada massa em mol.', 'Converta as duas massas; compare mol disponíveis divididos pelos coeficientes e só então converta o produto em gramas.', 2],
  ['lock-03', 'LOCK_IN', 'HARD', 'EVALUATE', 'CALCIUM_CARBONATE_REAL_YIELD', 'Na decomposição CaCO₃ → CaO + CO₂, 250 g de CaCO₃ são processados. Use M(CaCO₃) = 100 g/mol e M(CaO) = 56 g/mol. Se forem obtidos 112 g de CaO, qual foi o rendimento percentual?', '80%', ['56%', '112%', '125%'], '250 g de CaCO₃ são 2,5 mol; a razão 1:1 prevê 2,5 mol de CaO, ou 140 g. O rendimento é 112/140 × 100 = 80%.', 'Usar a massa inicial como rendimento teórico sem aplicar a razão molar e a massa molar do produto.', 'Calcule primeiro a massa teórica de CaO; depois divida a massa real por esse valor.', 3],
  ['review-01', 'REVIEW', 'EASY', 'DISTINGUISH', 'WATER_COEFFICIENT_VS_SUBSCRIPT', 'Na equação 2 H₂ + O₂ → 2 H₂O, o que representa o coeficiente 2 diante de H₂O?', 'Uma proporção de duas unidades de H₂O para cada unidade de O₂ na equação balanceada.', ['Dois átomos de hidrogênio dentro de cada molécula de água.', 'Dois gramas de água formados em qualquer escala.', 'Dois mol de água obrigatoriamente, mesmo que a reação ocorra em outra escala.'], 'O coeficiente dá a proporção entre quantidades de partículas ou mol. O índice 2 em H₂O indica dois átomos de hidrogênio em cada molécula.', 'Confundir coeficiente, índice da fórmula, massa e quantidade absoluta.', 'Leia o número antes da fórmula como proporção da reação e o número pequeno como composição da partícula.', 0],
  ['review-02', 'REVIEW', 'MEDIUM', 'APPLY', 'CHLORATE_SPACED_RATIO', 'Para 2 KClO₃ → 2 KCl + 3 O₂, quantos mol de O₂ correspondem a 0,4 mol de KClO₃?', '0,6 mol', ['0,4 mol', '0,8 mol', '1,2 mol'], 'A razão O₂/KClO₃ é 3/2. Logo, 0,4 × 3/2 = 0,6 mol de O₂.', 'Aplicar o fator 2/3 quando a pergunta pede produto por reagente.', 'Monte a fração com o produto no numerador: 3 mol O₂ / 2 mol KClO₃.', 1],
  ['review-03', 'REVIEW', 'HARD', 'ANALYZE', 'PROPANE_COMBUSTION_LIMITING', 'Na combustão C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O, há 1 mol de C₃H₈ e 4 mol de O₂. Qual resultado é previsto?', 'O₂ é limitante e podem se formar 2,4 mol de CO₂.', ['C₃H₈ é limitante e podem se formar 3 mol de CO₂.', 'O₂ é limitante e podem se formar 4 mol de CO₂.', 'Os reagentes estão na proporção estequiométrica e formam 3 mol de CO₂.'], 'Um mol de C₃H₈ exigiria 5 mol de O₂, mas há apenas 4. A quantidade de CO₂ é 4 × 3/5 = 2,4 mol.', 'Achar que uma mistura é estequiométrica por ter números próximos ou usar o coeficiente do produto sem limitar pelos reagentes.', 'Calcule quanto CO₂ cada reagente poderia produzir; o menor resultado identifica o limitante.', 2],
  ['review-04', 'REVIEW', 'MEDIUM', 'CALCULATE', 'SALT_MOLAR_AMOUNT_RECOVERY', 'Na reação HCl + NaOH → NaCl + H₂O, considere M(NaCl) = 58,5 g/mol. Uma amostra contém 117 g de NaCl. Quantos mol de NaCl ela representa?', '2 mol', ['1 mol', '58,5 mol', '0,5 mol'], 'A quantidade de matéria é n = m/M. Portanto, 117 g ÷ 58,5 g/mol = 2 mol.', 'Multiplicar massa por massa molar ou esquecer a unidade mol na divisão.', 'Use n = m/M; gramas divididos por gramas por mol resultam em mol.', 3],
  ['review-05', 'REVIEW', 'HARD', 'EVALUATE', 'YIELD_CLAIM_AUDIT', 'Um relatório informa rendimento teórico de 40 g e rendimento real de 46 g, atribuindo rendimento de 115%. Qual análise é mais adequada para um produto isolado e seco?', 'A razão calculada é 115%, mas o resultado pede verificar pureza, secagem, medição e pressupostos antes de tratá-lo como rendimento químico acima do teórico.', ['O valor prova que a conservação da matéria foi violada.', 'O rendimento é necessariamente 85%, pois deve-se subtrair 40 de 46.', 'O cálculo está errado; todo rendimento real precisa ser menor que 40 g, qualquer que seja a medição.'], '46/40 × 100 = 115%, mas uma massa aparente acima do teórico pode indicar umidade, impurezas, erro de medição ou modelo incompleto. O cálculo não valida sozinho a qualidade da amostra.', 'Aceitar ou rejeitar o número sem separar o cálculo da avaliação da amostra e das medições.', 'Confira a fórmula percentual e depois verifique se a massa real representa produto puro, seco e corretamente medido.', 0],
];

const expectedPurposeCounts = { PROBE: 0, PRACTICE: 5, TRANSFER: 5, LOCK_IN: 3, REVIEW: 5 };
const positionCounts = [0, 0, 0, 0];
const questions = rows.map(([id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, errorFocus, hint, answerPosition]) => {
  const options = [...distractors];
  options.splice(answerPosition, 0, correctAnswer);
  positionCounts[answerPosition] += 1;
  return {
    id: `v5-chem-stoich-${id}`,
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
  contentId: 'v5-chemistry-stoichiometry',
  subject: 'CHEMISTRY',
  domain: 'REACOES',
  topic: 'proporcoes molares, reagente limitante e rendimento',
  canonicalSkillCode: 'CHEMISTRY_STOICHIOMETRY',
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
    title: 'Da equação à quantidade de produto',
    objective: 'Usar uma equação balanceada e quantidades fornecidas para relacionar mols, massas, reagente limitante e rendimento.',
    summary: 'Balanceie primeiro. Converta massa em mol, aplique a razão dos coeficientes e só então converta a unidade pedida.',
    explanation: '## 1. O que a equação informa\nEm uma equação balanceada, os coeficientes dão a proporção entre quantidades de partículas e de mol. Em N₂ + 3 H₂ → 2 NH₃, cada proporção de 1 mol de N₂ para 3 mol de H₂ pode formar 2 mol de NH₃. A proporção pode ser ampliada ou reduzida; os coeficientes não fixam uma quantidade absoluta nem indicam a velocidade da reação.\n\n## 2. Balanceie antes de calcular\nA equação precisa conservar o número de átomos de cada elemento. Ao balancear, alteramos coeficientes, nunca os índices dentro de uma fórmula: trocar H₂O por H₂O₂ mudaria a substância. Use somente os coeficientes de uma equação balanceada para obter fatores estequiométricos.\n\n## 3. De massa para massa\nOs coeficientes relacionam mol, não gramas diretamente. Para uma massa conhecida, calcule n = m/M. Use então a razão molar da equação para chegar aos mol da substância desejada. Se a resposta pede massa, finalize com m = n × M. Em cada etapa, acompanhe as unidades para que as unidades intermediárias se cancelem.\n\n## 4. Encontre o reagente limitante\nQuando há mais de um reagente, calcule quanto produto cada um poderia formar, mantendo os outros suficientes. O reagente que prevê a menor quantidade de produto é o limitante; ele determina o rendimento teórico. Não compare somente as massas nem escolha automaticamente o menor número de mol: leve em conta os coeficientes e, se a resposta exigir massa, as massas molares.\n\n## 5. Exemplo resolvido e rendimento\nConsidere 2 Al + 3 Cl₂ → 2 AlCl₃. Com 54 g de Al e 284 g de Cl₂, usando M(Al)=27 g/mol e M(Cl₂)=71 g/mol, temos 2 mol de Al e 4 mol de Cl₂. Dois mol de Al exigem 3 mol de Cl₂, então o alumínio limita. A proporção prevê 2 mol de AlCl₃. Se M(AlCl₃)=133,5 g/mol, o rendimento teórico é 267 g. Se o experimento recuperar 213,6 g de produto puro e seco, o rendimento percentual é 213,6/267 × 100 = 80%. O rendimento real pode ser menor por perdas ou reação incompleta; um valor aparente acima do teórico exige verificar pureza, secagem, medição e modelo.',
    workedExample: 'Para 2 Al + 3 Cl₂ → 2 AlCl₃, converta 54 g Al em 2 mol e 284 g Cl₂ em 4 mol. Compare as capacidades: 2/2 = 1 para Al e 4/3 ≈ 1,33 para Cl₂. O menor fator é o do Al; logo, Al é limitante. Ele forma 2 mol AlCl₃. Com 133,5 g/mol, isso corresponde a 267 g teóricos. Uma recuperação de 213,6 g dá 80% de rendimento.',
    commonMistake: 'Aplicar a razão dos coeficientes diretamente a gramas ou decidir o limitante apenas pela menor massa ou quantidade em mol.',
    commonErrors: ['Usar uma equação ainda não balanceada.', 'Alterar índices da fórmula em vez de coeficientes.', 'Inverter a razão entre produto e reagente.', 'Esquecer a conversão de gramas para mol antes de usar os coeficientes.', 'Escolher limitante comparando somente massas ou mol absolutos.', 'Dividir rendimento teórico pelo real em vez de real pelo teórico.'],
    tips: ['Confira átomos e balanceamento antes da conta.', 'Escreva os fatores como frações com unidades.', 'Para cada reagente, estime o produto possível e compare.', 'Converta para gramas apenas no fim, quando essa for a unidade pedida.', 'Mantenha rendimento real, teórico e percentual como grandezas diferentes.'],
    priorKnowledge: ['Ler fórmulas químicas e reconhecer coeficientes e índices.', 'Calcular massa molar e usar n = m/M.', 'Trabalhar com proporções, frações e porcentagens.'],
    keyConcepts: ['coeficientes como proporções molares', 'equação balanceada e conservação de átomos', 'cadeia massa-mol-mol-massa', 'reagente limitante e rendimento teórico', 'rendimento real e rendimento percentual'],
    progression: [
      { stage: 'FOUNDATION', focus: 'A sequência reutiliza sondagens existentes; retome coeficientes, unidades e proporções se necessário.', questionIds: [] },
      { stage: 'APPLICATION', focus: 'Aplicar razões molares em cálculos diretos e conversões entre massa e mol.', questionIds: idsFor('PRACTICE') },
      { stage: 'TRANSFER', focus: 'Levar o método a processos de produção, neutralização, decomposição e recuperação.', questionIds: idsFor('TRANSFER') },
      { stage: 'INTEGRATION', focus: 'Combinar massas molares, limitante, produto teórico e rendimento real.', questionIds: idsFor('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Recuperar distinções e aplicar o raciocínio em novos contextos e tempos de revisão.', questionIds: idsFor('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'COEFFICIENT_RATIO', text: 'Coeficientes dão uma razão escalável entre mol; não são uma quantidade absoluta.' },
      { trigger: 'BALANCE_BEFORE_CALCULATION', text: 'Balanceie mudando coeficientes, nunca os índices que definem as fórmulas.' },
      { trigger: 'MASS_TO_MOLE', text: 'Converta a massa conhecida em mol com n = m/M antes de usar a proporção da equação.' },
      { trigger: 'LIMITING_REACTANT', text: 'O limitante é o reagente que, respeitada a proporção, permite formar menos produto.' },
      { trigger: 'MOLE_TO_MASS', text: 'Depois da razão molar, converta os mol do produto em gramas usando sua massa molar.' },
      { trigger: 'PERCENT_YIELD', text: 'Rendimento percentual compara o valor real ao teórico: real ÷ teórico × 100.' },
    ],
    remediations: [
      { id: 'COEFFICIENT_VS_SUBSCRIPT', misconception: 'INDICE_CONFUNDIDO_COM_COEFICIENTE', prompt: 'Marque o número que pode ser ajustado no balanceamento e conte os átomos dentro de cada fórmula sem alterá-la.' },
      { id: 'UNIT_CHAIN', misconception: 'MASSA_USADA_COMO_MOL', prompt: 'Escreva a cadeia g da substância conhecida → mol conhecida → mol desejado → g desejado, anotando unidades em cada etapa.' },
      { id: 'LIMITING_CAPACITY', misconception: 'LIMITANTE_ESCOLHIDO_PELA_MASSA', prompt: 'Calcule o produto possível a partir de cada reagente e compare as duas previsões.' },
      { id: 'YIELD_RATIO', misconception: 'RENDIMENTO_PERCENTUAL_INVERTIDO', prompt: 'Identifique a quantidade real e a teórica, escreva real/teórica × 100 e estime se o resultado faz sentido.' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 25,
    sourceDossier: [
      {
        title: 'IUPAC Gold Book: stoichiometry (S06026)',
        publisher: 'International Union of Pure and Applied Chemistry',
        url: 'https://goldbook.iupac.org/terms/view/S06026',
        accessedOn: '2026-10-13',
        supports: ['A equação estequiométrica relaciona quantidades de reagentes e produtos pelos coeficientes.'],
        use: 'Conferência da definição e do significado quantitativo dos coeficientes; itens do pacote são autorais.',
      },
      {
        title: 'Chemistry 2e, Section 4.3: Reaction Stoichiometry',
        publisher: 'OpenStax',
        url: 'https://openstax.org/books/chemistry-2e/pages/4-3-reaction-stoichiometry',
        accessedOn: '2026-10-13',
        supports: ['Equações balanceadas fornecem fatores estequiométricos para converter quantidades de reagentes e produtos; cálculos podem relacionar mol e massa.'],
        use: 'Conferência conceitual do fluxo de cálculo; exemplos, valores e questões deste pacote foram escritos independentemente.',
      },
      {
        title: 'Chemistry 2e, Section 4.4: Reaction Yields',
        publisher: 'OpenStax',
        url: 'https://openstax.org/books/chemistry-2e/pages/4-4-reaction-yields',
        accessedOn: '2026-10-13',
        supports: ['O reagente limitante determina a quantidade teórica de produto; rendimento real e teórico fundamentam o rendimento percentual.'],
        use: 'Conferência dos conceitos de limitante e rendimento; texto e questões do pacote são autorais.',
      },
    ],
    copyrightNote: 'Questões, números, cenários e explicações são autorais. As fontes conferem conceitos; revisão pedagógica humana permanece pendente e nenhum alinhamento BNCC oficial é reivindicado.',
  },
};

export function buildChemistryStoichiometryPack() {
  return structuredClone(pack);
}

if (JSON.stringify(expectedPurposeCounts) !== JSON.stringify(Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length])))) {
  throw new Error('CHEMISTRY_STOICHIOMETRY_V5_QUESTION_COUNTS_INVALID');
}
if (positionCounts.some((count, index) => count !== [5, 5, 4, 4][index])) throw new Error('CHEMISTRY_STOICHIOMETRY_V5_ANSWER_POSITIONS_UNBALANCED');

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${questions.length} original chemistry-stoichiometry questions to ${OUTPUT}`);
}
