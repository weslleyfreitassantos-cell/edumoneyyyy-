import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'content/adaptive/tec-escola-core-v5/math-percent-increase.json');
const MIGRATION = resolve(ROOT, 'supabase/migrations/20261015001600_bncc_math_percent_increase_question_first_v5.sql');
const sourceQuestions = JSON.parse(readFileSync(resolve(ROOT, 'content/adaptive/tec-escola-core-v4/subjects/mathematics/questions.json'), 'utf8'))
  .filter((question) => question.primarySkill === 'MATH_PERCENT_INCREASE');

const rows = [
  ['PROBE','EASY','CALCULATE','BOOK_PRICE','Um livro custa R$ 100 e teve aumento de 10%. Qual é o valor do aumento?','R$ 10.',['R$ 110.','R$ 90.','10 livros.'],'10% de R$ 100 é R$ 10. Esse valor é apenas o acréscimo; o novo preço seria R$ 110.','Calcule primeiro a taxa aplicada ao preço inicial.','INCREASE_CONFUSED_WITH_FINAL_VALUE'],
  ['PROBE','EASY','CALCULATE','SNACK_PRICE','Um lanche custava R$ 80 e aumentou 15%. Qual é o novo preço?','R$ 92.',['R$ 95.','R$ 12.','R$ 68.'],'15% de R$ 80 é R$ 12. Somando o acréscimo ao preço inicial, o novo preço é R$ 92.','Encontre 10% e 5% de R$ 80 e some ao valor inicial.','RATE_ADDED_AS_CURRENCY'],
  ['PROBE','EASY','CALCULATE','WATER_USE','O consumo registrado passou de 400 L para 460 L. Qual foi o aumento percentual em relação ao valor inicial?','15%.',['60%.','13%.','12%.'],'A diferença é 60 L. Em relação a 400 L, 60 ÷ 400 = 0,15, ou 15%.','Divida a diferença pelo consumo inicial.','CHANGE_DIVIDED_BY_FINAL'],
  ['PROBE','EASY','CALCULATE','PENCIL_BOX','Uma caixa tinha 200 lápis e recebeu aumento de 5% no estoque. Quantos lápis foram acrescentados?','10 lápis.',['5 lápis.','205 lápis.','40 lápis.'],'5% de 200 é 10. A pergunta solicita a quantidade acrescentada, não o total depois da reposição.','Diferencie “quantos foram acrescentados” de “quantos há agora”.','RATE_MISTAKEN_FOR_ADDITION'],

  ['PRACTICE','EASY','CALCULATE','BUS_FARE','Uma tarifa de R$ 6,00 aumenta 10%. Qual é o valor da tarifa depois do aumento?','R$ 6,60.',['R$ 6,10.','R$ 7,00.','R$ 5,40.'],'10% de R$ 6,00 é R$ 0,60. O preço final é R$ 6,60.','10% corresponde a um décimo do preço inicial.','PERCENT_TAKEN_AS_DECIMAL_CURRENCY'],
  ['PRACTICE','EASY','CALCULATE','SCHOOL_BUDGET','Um orçamento de R$ 500 recebeu aumento de 20%. Qual foi o acréscimo?','R$ 100.',['R$ 520.','R$ 20.','R$ 80.'],'20% de R$ 500 é R$ 100. Como a pergunta pede o acréscimo, não somamos ao orçamento.','Calcule a parte percentual e pare no acréscimo solicitado.','INCREASE_AMOUNT_CONFUSED_WITH_TOTAL'],
  ['PRACTICE','EASY','CALCULATE','LIBRARY_HOURS','O horário de atendimento aumentou de 20 para 22 horas semanais. Qual foi o aumento percentual?','10%.',['2%.','9%.','20%.'],'O aumento absoluto foi de 2 horas. Em relação às 20 horas iniciais, 2 ÷ 20 = 10%.','A base da variação é o valor inicial, 20 horas.','ABSOLUTE_CHANGE_REPORTED_AS_PERCENT'],
  ['PRACTICE','MEDIUM','CALCULATE','TRANSPORT_COST','Uma despesa passou de R$ 240 para R$ 276. Qual foi o aumento percentual?','15%.',['13%.','36%.','12%.'],'A diferença é R$ 36. Dividindo pela base inicial de R$ 240, obtemos 0,15 = 15%.','Subtraia primeiro e divida a diferença pelo valor inicial.','CHANGE_DIVIDED_BY_FINAL'],
  ['PRACTICE','MEDIUM','CALCULATE','PLANT_HEIGHT','Uma planta media 80 cm e passou a medir 100 cm. Qual é o aumento percentual da altura?','25%.',['20%.','125%.','80%.'],'A diferença é 20 cm. Em relação a 80 cm, 20 ÷ 80 = 0,25, ou 25%.','Não use a altura final como denominador.','FINAL_HEIGHT_USED_AS_BASE'],
  ['PRACTICE','MEDIUM','CALCULATE','CLASS_ENROLLMENT','As inscrições em uma oficina subiram de 120 para 150. Qual foi a taxa de aumento?','25%.',['20%.','30%.','125%.'],'Houve 30 inscrições a mais. A variação relativa é 30 ÷ 120 = 25%.','Compare o acréscimo com as inscrições no início.','CHANGE_DIVIDED_BY_FINAL'],
  ['PRACTICE','MEDIUM','CALCULATE','WATER_BILL','Uma conta de água de R$ 350 aumentou 8%. Qual é o novo valor?','R$ 378.',['R$ 358.','R$ 28.','R$ 322.'],'8% de R$ 350 é R$ 28. Somando ao valor inicial, o total é R$ 378.','Calcule 0,08 × 350 e some uma vez ao valor inicial.','RATE_ADDED_WITHOUT_MULTIPLICATION'],
  ['PRACTICE','MEDIUM','CALCULATE','SPORTS_PARTICIPATION','A participação em uma atividade passou de 50 para 65 pessoas. Qual foi o aumento percentual?','30%.',['15%.','23%.','130%.'],'O aumento foi de 15 pessoas. A base é 50: 15 ÷ 50 = 30%.','Use a quantidade inicial como referência.','FINAL_COUNT_USED_AS_DENOMINATOR'],
  ['PRACTICE','MEDIUM','CALCULATE','BUS_DISTANCE','Uma linha de ônibus ampliou o trajeto de 25 km para 30 km. Qual foi o aumento percentual?','20%.',['5%.','16,7%.','120%.'],'O trajeto aumentou 5 km. Como 5 ÷ 25 = 0,20, o aumento foi de 20%.','Compare os 5 km extras com os 25 km iniciais.','PERCENT_CHANGE_CALCULATED_FROM_NEW_TOTAL'],
  ['PRACTICE','MEDIUM','CALCULATE','SALARY_ADJUSTMENT','Uma bolsa de R$ 1.600 recebe reajuste de 5%. Qual é o novo valor?','R$ 1.680.',['R$ 1.605.','R$ 1.680,05.','R$ 1.520.'],'5% de R$ 1.600 é R$ 80. O novo valor é R$ 1.680.','5% é 0,05; multiplique a base pelo fator 1,05 para obter o total.','PERCENT_NUMBER_ADDED_DIRECTLY'],
  ['PRACTICE','MEDIUM','CALCULATE','MUSEUM_VISITORS','Um museu recebeu 2.000 visitantes em um mês e 2.300 no seguinte. Qual foi o aumento percentual?','15%.',['13%.','300%.','30%.'],'A diferença é 300 visitantes. Em relação aos 2.000 iniciais, 300 ÷ 2.000 = 15%.','O número de visitantes do primeiro mês é a base.','ABSOLUTE_COUNT_AS_PERCENT'],
  ['PRACTICE','HARD','CALCULATE','MARKET_PRICE','O preço de um material passou de R$ 48 para R$ 60. Qual foi o aumento percentual?','25%.',['20%.','12%.','125%.'],'O acréscimo foi R$ 12. Como 12 ÷ 48 = 0,25, a taxa de aumento é 25%.','Simplifique a razão 12/48.','CHANGE_DIVIDED_BY_FINAL'],
  ['PRACTICE','HARD','CALCULATE','PROJECT_OUTPUT','Uma equipe concluiu 72 tarefas em uma etapa e 90 na seguinte. Qual foi o aumento percentual da quantidade concluída?','25%.',['20%.','18%.','125%.'],'A diferença é 18 tarefas; 18 ÷ 72 = 0,25, então o aumento foi de 25%.','Use 72 como base e confira se sua resposta representa uma taxa.','CHANGE_OVER_FINAL_COUNT'],

  ['TRANSFER','MEDIUM','TRANSFER','TICKET_REVENUE','A receita de bilhetes de um evento aumentou de R$ 3.000 para R$ 3.600. Qual afirmação está correta?','O aumento foi de R$ 600, equivalente a 20% da receita inicial.',['O aumento foi de 20% da receita final.','O aumento foi de 600%.','A receita cresceu 16,7% porque 600 ÷ 3.600 é a base.'],'A variação absoluta é R$ 600. A base inicial de R$ 3.000 produz 600 ÷ 3.000 = 20%.','Verifique qual valor representa o ponto de partida.','FINAL_REVENUE_USED_AS_BASE'],
  ['TRANSFER','MEDIUM','TRANSFER','FUNDRAISER_GOAL','Uma campanha arrecadou R$ 800 e depois chegou a R$ 1.000. Qual foi o aumento percentual sobre a arrecadação inicial?','25%.',['20%.','200%.','125%.'],'O acréscimo foi R$ 200. Em relação a R$ 800, a variação é 200 ÷ 800 = 25%.','A meta alcançada é o valor final, não a base.','FINAL_AMOUNT_USED_AS_BASE'],
  ['TRANSFER','MEDIUM','TRANSFER','PRINTED_COPIES','Uma gráfica aumentou a tiragem de 1.200 para 1.500 cópias. Qual é o acréscimo e sua taxa sobre a tiragem anterior?','300 cópias e 25%.',['300 cópias e 20%.','1.500 cópias e 25%.','25 cópias e 300%.'],'A diferença é 300; 300 ÷ 1.200 = 25%. As duas medidas são distintas: quantidade e taxa.','Encontre a diferença e depois calcule a razão pela base anterior.','ABSOLUTE_AND_RELATIVE_CHANGE_MIXED'],
  ['TRANSFER','MEDIUM','TRANSFER','SCHOOL_GARDEN_AREA','A área de um canteiro passou de 16 m² para 20 m². Qual foi o crescimento percentual?','25%.',['20%.','4%.','125%.'],'A área cresceu 4 m². Dividindo 4 por 16, obtemos 0,25 = 25%.','A diferença é comparada à área de partida.','AREA_DIFFERENCE_REPORTED_AS_RATE'],
  ['TRANSFER','HARD','TRANSFER','PRICE_WITH_TAX','Um serviço custava R$ 150. Após reajuste de 12%, qual é o acréscimo e o novo preço?','R$ 18 de acréscimo e R$ 168 no total.',['R$ 12 de acréscimo e R$ 162 no total.','R$ 168 de acréscimo e R$ 318 no total.','R$ 18 de acréscimo e R$ 150 no total.'],'12% de R$ 150 é R$ 18. Somando ao preço anterior, chega-se a R$ 168.','Calcule a variação e só então determine o total atualizado.','TAX_RATE_APPLIED_TO_WRONG_BASE'],
  ['TRANSFER','HARD','TRANSFER','POPULATION_ESTIMATE','Uma estimativa populacional passou de 24.000 para 25.200 habitantes. Qual foi o aumento percentual?','5%.',['1.200%.','4,8%.','5,2%.'],'O acréscimo foi 1.200 habitantes. Em relação a 24.000, 1.200 ÷ 24.000 = 5%.','Simplifique a razão 1.200/24.000 antes de converter.','ABSOLUTE_INCREASE_AS_PERCENT'],
  ['TRANSFER','HARD','TRANSFER','REVERSE_NEW_VALUE','Depois de um aumento de 20%, um preço ficou em R$ 144. Qual era o preço antes do aumento?','R$ 120.',['R$ 124.','R$ 115,20.','R$ 172,80.'],'R$ 144 corresponde a 120% da base. Assim, base = 144 ÷ 1,20 = R$ 120.','O valor final representa 100% + 20% do preço inicial.','FINAL_VALUE_MINUS_RATE_POINTS'],
  ['TRANSFER','HARD','TRANSFER','RATE_AND_POINTS','Uma taxa de atendimento passou de 40% para 50%. Qual alternativa distingue corretamente as duas formas de descrever a mudança?','A diferença é 10 pontos percentuais; o aumento relativo é 25% sobre a taxa inicial.',['A diferença e o aumento relativo são ambos 10%.','A diferença é 25 pontos percentuais.','O aumento relativo é 10 pontos percentuais.'],'50% − 40% = 10 pontos percentuais. Relativamente aos 40% iniciais, 10 ÷ 40 = 25%.','Calcule primeiro a diferença e depois divida pela taxa inicial.','PERCENTAGE_POINTS_CONFUSED_WITH_RELATIVE_INCREASE'],
  ['REVIEW','HARD','EVALUATE','SAME_RATE_DIFFERENT_BASES','Duas taxas de aumento são 10%: uma incide sobre R$ 200 e outra sobre R$ 500. Qual comparação é correta?','Os acréscimos são R$ 20 e R$ 50; a taxa é igual, mas os valores absolutos diferem.',['Os dois acréscimos são R$ 10.','A primeira taxa é maior porque seu valor-base é menor.','Os preços finais são iguais porque a taxa coincide.'],'A mesma taxa aplicada a bases diferentes produz acréscimos diferentes. 10% de 200 é 20; 10% de 500 é 50.','Converta cada taxa usando sua própria base.','SAME_PERCENT_ASSUMED_SAME_AMOUNT'],

  ['LOCK_IN','MEDIUM','REVISE_CLAIM','LOCKIN_ADD_PERCENT','Uma pessoa calcula 15% de R$ 200 e soma 15 ao preço. Qual é o erro?','Usou a taxa numérica como valor do acréscimo; 15% de R$ 200 é R$ 30.',['O preço deveria diminuir R$ 15.','O acréscimo correto é R$ 215.','A base deveria ser a própria taxa.'],'15% significa 0,15 da base. Multiplicar 200 por 0,15 dá R$ 30; a taxa não é diretamente um valor em reais.','Transforme 15% em 0,15 antes de multiplicar.','RATE_POINTS_ADDED_AS_CURRENCY'],
  ['LOCK_IN','MEDIUM','DISTINGUISH','LOCKIN_FINAL_VS_INCREASE','Uma conta de R$ 300 aumentou 10%. Qual par apresenta corretamente acréscimo e total final?','R$ 30 de acréscimo e R$ 330 de total.',['R$ 330 de acréscimo e R$ 630 de total.','R$ 10 de acréscimo e R$ 310 de total.','R$ 30 de acréscimo e R$ 300 de total.'],'10% de R$ 300 é R$ 30. O total final inclui o valor inicial: R$ 330.','Nomeie separadamente variação e valor final.','INCREASE_AND_FINAL_VALUE_SWAPPED'],
  ['LOCK_IN','HARD','REVISE_CLAIM','LOCKIN_WRONG_DENOMINATOR','Um aumento foi de 30 para 36. Um cálculo usa 6 ÷ 36 para achar a taxa. Qual correção é necessária?','Dividir 6 pela base inicial 30; o aumento é 20%.',['Dividir 36 por 6; o aumento é 600%.','Dividir 6 por 30 e concluir 2%.','Usar 36 como base porque é o maior valor.'],'A variação percentual “de 30 para 36” usa 30 como referência: 6 ÷ 30 = 20%.','A palavra “de” marca o ponto de partida.','FINAL_VALUE_USED_AS_DENOMINATOR'],
  ['LOCK_IN','HARD','DISTINGUISH','LOCKIN_PERCENT_POINTS','A taxa passou de 8% para 10%. Um relatório diz “aumento de 2%”. Qual revisão elimina a ambiguidade?','A taxa aumentou 2 pontos percentuais; em termos relativos, aumentou 25% sobre 8%.',['A taxa aumentou 2 pontos percentuais e 2% relativamente.','A taxa aumentou 18 pontos percentuais.','A taxa aumentou 25 pontos percentuais.'],'A diferença direta é 2 pontos percentuais. A variação relativa é 2 ÷ 8 = 25%.','Expresse diferença entre taxas e crescimento relativo separadamente.','POINT_CHANGE_MISLABELED_AS_PERCENT'],
  ['LOCK_IN','HARD','EVALUATE','LOCKIN_UNIFORM_INCREASE','Uma média de consumo subiu 10% em uma cidade. Qual conclusão não é sustentada sem dados adicionais?','Que o consumo de cada domicílio subiu exatamente 10%.',['Que a média agregada aumentou 10%, conforme informado.','Que é necessário conhecer distribuição e método de cálculo para falar de cada domicílio.','Que um indicador médio pode resumir um conjunto.'],'Um aumento na média agregada não implica mudança idêntica em cada unidade. São necessários dados desagregados para essa afirmação.','Distinga a média do comportamento de cada caso.','AGGREGATE_CHANGE_GENERALIZED_TO_EACH_CASE'],
  ['LOCK_IN','HARD','CALCULATE','LOCKIN_ROUNDING','Uma medida passou de 64 para 72 unidades. Qual é o aumento percentual exato?','12,5%.',['8%.','11,1%.','12%.'],'A diferença é 8; 8 ÷ 64 = 0,125 = 12,5%. A resposta não exige arredondamento.','Simplifique 8/64 antes de converter para porcentagem.','CHANGE_DIVIDED_BY_FINAL_AND_ROUNDED'],

  ['REVIEW','MEDIUM','CALCULATE','REVIEW_NEW_VALUE','Um equipamento de R$ 400 teve aumento de 7,5%. Qual é o novo preço?','R$ 430.',['R$ 407,50.','R$ 30.','R$ 370.'],'7,5% de R$ 400 é R$ 30; o preço atualizado é R$ 430.','7,5% é 0,075; calcule o acréscimo antes de somá-lo.','DECIMAL_RATE_IGNORED'],
  ['REVIEW','MEDIUM','CALCULATE','REVIEW_RATE','Uma quantidade cresceu de 160 para 184. Qual é a taxa de aumento?','15%.',['13%.','24%.','115%.'],'O acréscimo é 24; 24 ÷ 160 = 0,15.','Use a quantidade inicial como denominador.','FINAL_COUNT_AS_BASE'],
  ['REVIEW','HARD','TRANSFER','REVIEW_REVERSE','Após aumento de 25%, um valor é R$ 250. Qual era o valor inicial?','R$ 200.',['R$ 225.','R$ 187,50.','R$ 312,50.'],'R$ 250 representa 125% da base. Então 250 ÷ 1,25 = R$ 200.','Divida o total pelo fator 1,25; não subtraia 25 unidades.','RATE_SUBTRACTED_AS_ABSOLUTE_AMOUNT'],
  ['REVIEW','HARD','CALCULATE','REVIEW_SMALL_BASE','Uma quantidade passa de 8 para 10. Qual é o aumento percentual?','25%.',['20%.','2%.','125%.'],'A diferença é 2; 2 ÷ 8 = 0,25 = 25%.','A diferença pequena precisa ser comparada à base, não lida como taxa.','ABSOLUTE_CHANGE_USED_AS_PERCENT'],
  ['REVIEW','HARD','DISTINGUISH','REVIEW_TWO_STEPS','Um preço de R$ 200 sobe 10% e, depois, sobe mais 10% sobre o novo valor. Qual é o preço final?','R$ 242.',['R$ 240.','R$ 220.','R$ 244.'],'Primeiro, R$ 200 × 1,10 = R$ 220. Depois, R$ 220 × 1,10 = R$ 242. A segunda base é atualizada.','Aplique o segundo aumento ao valor após a primeira etapa.','SUCCESSIVE_RATES_ADDED_TO_ORIGINAL'],
  ['REVIEW','HARD','EVALUATE','REVIEW_RATE_VS_COUNT','Uma região A teve aumento de 12% sobre 50 unidades; uma região B, aumento de 8% sobre 200. Qual conclusão é correta?','A taxa relativa é maior em A; o aumento absoluto é maior em B: 6 contra 16 unidades.',['A região A teve aumento absoluto maior porque 12% é maior.','A região B teve taxa relativa maior porque ganhou mais unidades.','Os aumentos absolutos são iguais.'],'12% de 50 é 6; 8% de 200 é 16. Taxa relativa e quantidade absoluta podem ordenar os casos de formas diferentes.','Calcule as partes usando a base de cada região.','RATE_AND_ABSOLUTE_INCREASE_CONFLATED'],
  ['REVIEW','HARD','SYNTHESIZE','REVIEW_FULL_REPORT','Um relatório informa valor inicial de 500 unidades, aumento absoluto de 75 e valor final de 575. Qual variação percentual confere os dados?','15%.',['13%.','75%.','115%.'],'75 ÷ 500 = 0,15, ou 15%. A conferência também confirma que 500 + 75 = 575.','Verifique a soma e use o valor inicial como base percentual.','FINAL_TOTAL_USED_AS_BASE'],
  ['REVIEW','HARD','EVALUATE','REVIEW_MISSING_BASE','Uma notícia diz que um indicador aumentou 12%, mas não apresenta o valor inicial nem a definição do indicador. O que é possível concluir?','A notícia afirma uma variação de 12%, mas a base e o método precisam ser conhecidos para verificar e interpretar a afirmação.',['Que o indicador aumentou 12 unidades.','Que todo caso individual aumentou 12%.','Que o valor final é 112 unidades.'],'Sem base e definição, não se converte taxa em quantidade nem se verifica o alcance da afirmação.','Separe o que foi reportado do que os dados permitem recalcular.','RATE_WITHOUT_BASE_TREATED_AS_ABSOLUTE'],
  ['REVIEW','HARD','TRANSFER','REVIEW_CONTEXT','Uma oficina cresceu de 24 para 30 participantes; no mês seguinte, de 30 para 36. Em qual intervalo o aumento percentual foi maior?','No primeiro: 6 ÷ 24 = 25%; no segundo: 6 ÷ 30 = 20%.',['Os dois, porque o acréscimo foi de 6 em ambos.','No segundo: 25%, pois a base é maior.','Não é possível comparar porque as diferenças absolutas são iguais.'],'A diferença absoluta é 6 nos dois intervalos, mas as bases são 24 e 30. Assim, as taxas são 25% e 20%.','Compare cada diferença com o total no início do respectivo intervalo.','EQUAL_ABSOLUTE_CHANGE_ASSUMED_EQUAL_RATE'],
].filter((row) => row[3] !== 'SPORTS_PARTICIPATION').map(([purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, hint, misconception], index) => {
  const options = [...distractors];
  options.splice(index % 4, 0, correctAnswer);
  return {
    id: `v5-math-percent-increase-${String(index + 1).padStart(2, '0')}`,
    purpose, difficulty, cognitiveProcess: purpose === 'TRANSFER' ? ['APPLY', 'COMPARE', 'EVALUATE'][index % 3] : cognitiveProcess, contextFamily, statement, options, correctAnswer, explanation, hint,
    errorFocus: misconception,
    misconceptions: { [distractors[0]]: [misconception] },
  };
});

const purposeCounts = Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, rows.filter((question) => question.purpose === purpose).length]));
const sourceQuestionFeedback = sourceQuestions.map((question) => ({
  questionId: question.id,
  hint: 'Separe aumento absoluto, valor final e taxa relativa. Para a taxa, compare o acréscimo ao valor inicial; para o total, some o acréscimo uma vez.',
  errorFocus: 'PERCENT_INCREASE_AMOUNT_BASE_AND_FINAL_VALUE',
}));

export function buildMathPercentIncreasePack() {
  return {
    packVersion: 'tec-escola-core-v5-question-first', contentId: 'v5-math-percent-increase-change',
    subject: 'MATHEMATICS', domain: 'PERCENTAGE', topic: 'calcular_e_interpretar_aumento_percentual', canonicalSkillCode: 'MATH_PERCENT_INCREASE',
    contentVersion: 1, lessonVersion: 1, expectedQuestionCount: 40, expectedContextCount: 40,
    expectedPurposeCounts: purposeCounts, expectedAnswerPositionCounts: { A: 10, B: 10, C: 10, D: 10 },
    officialMappingStatus: 'NOT_CLAIMED', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', publicationStatus: 'STAGING', contentAuthoringStatus: 'AUTHORED',
    sourceQuestionFeedback,
    sourceReconciliation: { sourceQuestionCount: sourceQuestions.length, feedbackAdded: sourceQuestions.length, sourceReconciliationStatus: 'EXACT', newQuestions: 40, reusedQuestionsCountedAsNew: false },
    lesson: {
      title: 'Calcular e interpretar aumento percentual',
      objective: 'Calcular acréscimo absoluto, valor final e taxa relativa de aumento, usando a base inicial e distinguindo percentuais de pontos percentuais.',
      summary: 'Aumento percentual compara a variação com o valor inicial. O acréscimo é uma quantidade; o valor final é a soma do inicial com o acréscimo; a taxa é uma razão percentual. Esses resultados não podem ser trocados.',
      explanation: '## 1. Separe os dados da mudança\nEm “de 80 para 100”, o valor inicial é 80, o final é 100 e o aumento absoluto é 100 − 80 = 20. Antes de calcular, anote essas três quantidades com suas unidades.\n\n## 2. Calcule a taxa sobre o valor inicial\nA fórmula é: **aumento percentual = (valor final − valor inicial) ÷ valor inicial × 100%**. No exemplo, 20 ÷ 80 × 100% = 25%. O denominador é o ponto de partida porque a pergunta mede o crescimento em relação a ele.\n\n## 3. Encontre o novo valor a partir da taxa\nSe um preço de R$ 200 aumenta 15%, calcule 0,15 × 200 = R$ 30. O acréscimo é R$ 30; o total atualizado é R$ 230. Não some “15” diretamente ao preço: 15% é uma taxa, não uma quantia em reais.\n\n## 4. Use fatores multiplicativos\nUm aumento de r% equivale a multiplicar o valor inicial por 1 + r/100. Um aumento de 8% usa o fator 1,08. Esse método é útil para conferir o resultado, mas mantenha a unidade e a base explícitas.\n\n## 5. Trabalhe de trás para frente\nSe o preço final após aumento de 20% é R$ 144, o final corresponde a 120% da base. Portanto, base = 144 ÷ 1,20 = R$ 120. Subtrair 20 unidades ou 20% do valor final não desfaz corretamente o aumento.\n\n## 6. Diferencie taxas e pontos percentuais\nUma taxa que passa de 40% para 50% aumenta 10 pontos percentuais. Em relação à taxa inicial, o crescimento relativo é 10 ÷ 40 = 25%. Informe qual medida está usando.\n\n## Exemplo resolvido\nUma quantidade passa de 160 para 184. Diferença: 184 − 160 = 24. Base: 160. Taxa: 24 ÷ 160 = 0,15 = 15%. Conferência: 160 × 1,15 = 184. Assim, 24 é o aumento absoluto e 184 é o valor final.\n\n## 7. Interprete o alcance\nUm aumento médio de 10% não significa que cada caso aumentou 10%. E, entre grupos com bases diferentes, uma taxa maior pode corresponder a uma quantidade menor. Diga se sua conclusão trata da taxa, da média ou da quantidade total.',
      workedExample: 'Uma tarifa de R$ 80 aumenta 15%. 1) Variação: 0,15 × 80 = R$ 12. 2) Total: 80 + 12 = R$ 92. 3) Conferência: 80 × 1,15 = R$ 92. Se a pergunta pedisse a taxa de uma mudança observada de R$ 80 para R$ 92, faríamos 12 ÷ 80 = 15%.',
      commonMistake: 'Dividir a variação pelo valor final; confundir taxa com acréscimo em unidades; somar a taxa numérica ao preço; misturar pontos percentuais e aumento relativo; ou generalizar uma média para cada caso.',
      tips: ['Escreva “inicial”, “final” e “diferença” antes de calcular.', 'Para uma taxa observada, divida a diferença pelo valor inicial.', 'Para um novo total, calcule a parte e some uma vez.', 'Em problemas inversos, divida pelo fator 1 + taxa.', 'Mantenha unidades em valores absolutos e use % para taxas.'],
      estimatedMinutes: 32,
      priorKnowledge: ['Identificar a base percentual.', 'Calcular porcentagens simples e subtrair valores.'],
      keyConcepts: ['aumento absoluto', 'valor inicial', 'valor final', 'taxa relativa', 'fator multiplicativo', 'pontos percentuais', 'média agregada'],
      progression: [
        { stage: 'DIAGNOSTIC', focus: 'Calcular acréscimos simples e identificar o valor inicial.', questionIds: rows.filter((question) => question.purpose === 'PROBE').map((question) => question.id) },
        { stage: 'PRACTICE', focus: 'Calcular diferença, taxa e novo valor em contextos graduais.', questionIds: rows.filter((question) => question.purpose === 'PRACTICE').map((question) => question.id) },
        { stage: 'TRANSFER', focus: 'Aplicar fatores, comparar bases e resolver situações inversas.', questionIds: rows.filter((question) => question.purpose === 'TRANSFER').map((question) => question.id) },
        { stage: 'CONSOLIDATION', focus: 'Corrigir confusões entre variação, taxa, total e pontos percentuais.', questionIds: rows.filter((question) => question.purpose === 'LOCK_IN').map((question) => question.id) },
        { stage: 'REVIEW', focus: 'Retomar cálculos, interpretação e limites de indicadores.', questionIds: rows.filter((question) => question.purpose === 'REVIEW').map((question) => question.id) },
      ],
      microExplanations: [
        { trigger: 'INITIAL_AS_BASE', text: 'A taxa de crescimento compara a diferença com o valor no início do intervalo.' },
        { trigger: 'AMOUNT_VS_TOTAL', text: 'A variação é o acréscimo; o total final é o inicial mais esse acréscimo.' },
        { trigger: 'RATE_IS_NOT_CURRENCY', text: '15% é uma taxa. Para obter reais, aplique-a à base.' },
        { trigger: 'REVERSE_FACTOR', text: 'Se o final já inclui o aumento, divida pelo fator 1 + taxa para recuperar a base.' },
        { trigger: 'POINTS_VS_RELATIVE', text: 'Subtrair duas taxas dá pontos percentuais; a mudança relativa usa a taxa inicial como base.' },
        { trigger: 'AGGREGATE_LIMIT', text: 'Uma variação média não descreve automaticamente cada unidade do grupo.' },
      ],
      remediations: [
        { id: 'THREE_VALUES_TABLE', misconception: 'Trocar o aumento absoluto pelo valor final.', prompt: 'Preencha três linhas: valor inicial, diferença e valor final. Leia de novo o que a pergunta pede.' },
        { id: 'DIVIDE_BY_INITIAL', misconception: 'Dividir a diferença pelo valor final.', prompt: 'Escreva “de ___ para ___”. Subtraia final − inicial e divida pelo inicial.' },
        { id: 'APPLY_RATE_TO_BASE', misconception: 'Somar o número da taxa diretamente ao preço.', prompt: 'Converta a porcentagem para decimal, multiplique pela base e mantenha a unidade monetária.' },
        { id: 'REVERSE_MULTIPLIER', misconception: 'Subtrair a taxa numérica do valor final em vez de recuperar a base.', prompt: 'Represente o final como (1 + taxa) × base e isole a base dividindo pelo fator.' },
        { id: 'LABEL_PERCENTAGE_POINTS', misconception: 'Chamar a diferença entre taxas de aumento relativo.', prompt: 'Registre a diferença em pontos percentuais e depois divida pela taxa inicial se pedirem variação relativa.' },
        { id: 'RATE_OR_COUNT', misconception: 'Concluir a quantidade absoluta apenas pela taxa.', prompt: 'Calcule cada acréscimo usando sua própria base e compare separadamente taxa e quantidade.' },
      ],
      authenticActivities: [{
        id: 'v5-math-percent-increase-audit',
        title: 'Auditoria de variações percentuais',
        objective: 'Recalcular aumentos de dados sintéticos e verificar se texto, base, taxa e valor final são coerentes.',
        context: 'Atividade com cartões de dados fictícios elaborados pelo docente; não usar preços pessoais, notas ou indicadores identificáveis de estudantes.',
        materials: ['Cartões com valores iniciais e finais sintéticos', 'Calculadora opcional', 'Quadro para base, diferença, taxa e total'],
        instructions: 'Em cada cartão, identifique valor inicial e final; calcule a diferença; divida pela base inicial; compare com a taxa anunciada; escreva o novo valor para casos em que a taxa é fornecida. Marque a unidade e explique qualquer divergência de arredondamento.',
        evidence: 'Tabela de cálculos reproduzíveis, com base explicitada e distinção entre aumento absoluto, taxa e valor final.',
        safety: 'Usar apenas dados fictícios e fornecer calculadora, tabela preenchível e alternativa acessível. Não comparar estudantes ou famílias.',
        privacyGuard: 'Não utilizar nem coletar valores reais de renda, despesas domésticas, notas, presença ou desempenho de estudantes.',
        ageRange: 'Ensino Fundamental II, com valores e precisão adequados à turma.',
        mediation: 'O docente verifica primeiro a escolha da base e depois a operação. Arredondamentos precisam ser declarados, não escondidos.',
        rubric: [
          { criterion: 'Base e diferença', emerging: 'Usa o final como início ou confunde diferença com total.', developing: 'Identifica os três valores com apoio.', proficient: 'Nomeia base, diferença e final com unidades corretas.' },
          { criterion: 'Taxa percentual', emerging: 'Divide pela base errada ou soma o percentual como unidade.', developing: 'Calcula a taxa após orientação.', proficient: 'Compara a diferença ao inicial e apresenta a taxa corretamente.' },
          { criterion: 'Interpretação', emerging: 'Confunde taxa, contagem ou pontos percentuais.', developing: 'Distingue as medidas em exemplos simples.', proficient: 'Explica alcance, base e limite da conclusão.' },
        ],
      }],
      reviewWindowsDays: [1, 3, 7], reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
      sourceDossier: [{ publisher: 'TecEscola', title: 'Conjunto sintético para aumentos percentuais', license: 'Situações e valores autorais, gerados para aprendizagem; não representam séries econômicas reais.' }],
      copyrightNote: 'Questões, valores, explicações e atividade são autorais e sintéticos. Revisão pedagógica pendente; alinhamento oficial não reivindicado.',
    },
    questions: rows,
  };
}

function main() {
  const pack = buildMathPercentIncreasePack();
  const result = validateQuestionFirstPack(pack);
  if (!result.valid) throw new Error(`MATH_PERCENT_INCREASE_PACK_INVALID:${result.errors.join(',')}`);
  writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(MIGRATION, buildMigration(pack));
  process.stdout.write(`${JSON.stringify({ valid: true, questions: result.questionCount, contexts: result.contextCount, counts: result.counts, answerPositions: result.answerPositionCounts, sourceFeedback: sourceQuestionFeedback.length }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
