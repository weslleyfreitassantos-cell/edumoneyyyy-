import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const version = 'central-estudos-v2-candidate-2026-10-25.2';

const q = (id, purpose, difficulty, statement, options, correctAnswer, explanation, misconception) => ({
  id, purpose, interactionType: 'SINGLE_CHOICE', difficulty, statement, options, correctAnswer,
  explanation, misconception,
});

const candidates = [
  {
    journeyCode: 'CEV2_EF06MA03_OPERACOES_01', journeyTitle: 'Estratégias com números naturais', subject: 'MATHEMATICS', grade: 6,
    officialSkillCode: 'EF06MA03', skill: 'MATH_NATURAL_OPERATIONS_STRATEGIES', unitCode: 'MAT_NUMEROS', unitTitle: 'Números e operações',
    officialText: 'Resolver e elaborar problemas que envolvam cálculos (mentais ou escritos, exatos ou aproximados) com números naturais, por meio de estratégias variadas, com compreensão dos processos neles envolvidos com e sem uso de calculadora.',
    lesson: {
      title: 'Escolher uma estratégia para calcular', estimatedMinutes: 20,
      introduction: 'A biblioteca da escola recebeu 8 caixas com 24 livros em cada uma. Antes de calcular, vale perguntar: há uma maneira de decompor 24 para facilitar a multiplicação? E como conferir se o total faz sentido?',
      explanation: 'Números naturais podem ser calculados por decomposição, estimativa, algoritmos escritos e calculadora. A estratégia deve preservar o valor da operação e deixar claros os passos. Na multiplicação, por exemplo, 24 pode ser pensado como 20 + 4. Em problemas com mais de uma operação, leia a situação para decidir a ordem; parênteses e a relação entre os dados ajudam a organizar o raciocínio.',
      workedExample: { prompt: 'Uma escola organiza 6 fileiras com 18 cadeiras. Quantas cadeiras são?', steps: ['Decomponha 18 em 10 + 8.', 'Calcule 6 × 10 = 60 e 6 × 8 = 48.', 'Some 60 + 48 = 108.', 'Confira: 6 grupos de cerca de 20 devem dar um pouco mais que 100.'], answer: '108 cadeiras.' },
      guidedPractice: [{ prompt: 'Calcule 7 × 25 usando 25 = 100 ÷ 4.', scaffold: 'Multiplique 7 por 100 e depois divida o resultado por 4.' }, { prompt: 'Estime 398 + 205 antes de achar o total exato.', scaffold: 'Aproximar 398 para 400 ajuda a conferir a ordem de grandeza.' }, { prompt: 'Explique por que 4 × (30 + 2) é igual a 4 × 30 + 4 × 2.', scaffold: 'Considere quatro grupos, cada um com 30 e mais 2.' }],
      application: [{ context: 'Organização escolar', prompt: 'Uma excursão leva 7 ônibus com 42 lugares. Se 268 estudantes vão participar, quantos lugares ficam vazios? Registre as operações e confira por estimativa.' }, { context: 'Consumo consciente', prompt: 'Uma campanha juntou 36 pacotes com 25 folhas cada. Quantas folhas foram reunidas? Compare uma decomposição com o uso de calculadora.' }],
      review: ['Identifique quais quantidades o problema relaciona.', 'Escolha cálculo mental, decomposição, algoritmo ou calculadora conforme a situação.', 'Em problemas com várias operações, explique a ordem escolhida.', 'Use estimativa para conferir se o resultado é razoável.', 'Responda com a unidade pedida.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06ma03-q1','cev2-ef06ma03-q2','cev2-ef06ma03-q3','cev2-ef06ma03-q4','cev2-ef06ma03-q5'] },
    },
    questions: [
      q('cev2-ef06ma03-q1','PROBE','EASY','Uma sala tem 6 fileiras com 14 carteiras em cada. Qual cálculo representa o total?', ['6 + 14','6 × 14','14 − 6','14 ÷ 6'],'6 × 14','Há seis grupos iguais de 14 carteiras; por isso, a multiplicação representa a situação.','Somar os dois números como se cada fileira tivesse apenas uma carteira adicional.'),
      q('cev2-ef06ma03-q2','PRACTICE','EASY','Qual é uma decomposição correta de 32 × 5 que facilita o cálculo?', ['(30 × 5) + (2 × 5)','30 × 2 + 5','32 + 5','32 × 2 + 5'],'(30 × 5) + (2 × 5)','A propriedade distributiva permite separar 32 em 30 + 2: 150 + 10 = 160.','Multiplicar apenas uma das partes da decomposição.'),
      q('cev2-ef06ma03-q3','TRANSFER','MEDIUM','Uma feira vendeu 128 ingressos pela manhã e 96 à tarde. Depois, 35 ingressos foram cancelados. Quantos permaneceram válidos?', ['259','189','224','61'],'189','Some as vendas: 128 + 96 = 224. Depois retire os 35 cancelados: 224 − 35 = 189.','Subtrair os cancelamentos antes de juntar as duas vendas.'),
      q('cev2-ef06ma03-q4','LOCK_IN','MEDIUM','Uma estudante calcula 4 × (20 + 3) e obtém 80 + 3 = 83. Qual correção preserva a multiplicação por 4?', ['4 × 20 + 4 × 3 = 92','4 + 20 + 3 = 27','20 + 3 × 4 = 32','4 × 20 − 3 = 77'],'4 × 20 + 4 × 3 = 92','Os quatro grupos contêm tanto 20 quanto 3: 80 + 12 = 92.','Distribuir o fator 4 somente para a primeira parcela.'),
      q('cev2-ef06ma03-q5','REVIEW','MEDIUM','Sem calcular exatamente, qual faixa é mais plausível para 49 × 21?', ['Menos de 100','Entre 900 e 1.200','Entre 200 e 400','Mais de 5.000'],'Entre 900 e 1.200','49 × 21 fica perto de 50 × 20 = 1.000; a estimativa ajuda a detectar erros de ordem de grandeza.','Tratar 49 × 21 como uma soma ou ignorar o tamanho dos fatores.'),
    ],
  },
  {
    journeyCode: 'CEV2_EF06MA07_FRACOES_01', journeyTitle: 'Frações: partes, comparação e equivalência', subject: 'MATHEMATICS', grade: 6,
    officialSkillCode: 'EF06MA07', skill: 'MATH_FRACTION_MEANING_COMPARISON', unitCode: 'MAT_NUMEROS', unitTitle: 'Números e operações',
    officialText: 'Compreender, comparar e ordenar frações associadas às ideias de partes de inteiros e resultado de divisão, identificando frações equivalentes.',
    lesson: {
      title: 'Comparar frações com significado', estimatedMinutes: 20,
      introduction: 'Duas equipes dividiram barras de cereal iguais. Uma recebeu 3/4 de uma barra e outra, 5/8. A escrita parece diferente; para decidir quem recebeu mais, primeiro precisamos comparar partes do mesmo tamanho.',
      explanation: 'O denominador informa em quantas partes iguais o inteiro foi dividido; o numerador indica quantas dessas partes estão sendo consideradas. Frações equivalentes representam a mesma quantidade, mesmo com numeradores e denominadores diferentes. Para comparar, use uma representação, frações equivalentes ou uma referência como 1/2 e 1 inteiro. O inteiro comparado precisa ter o mesmo tamanho.',
      workedExample: { prompt: 'Qual é maior: 3/4 ou 5/8?', steps: ['Escreva 3/4 em oitavos: multiplique numerador e denominador por 2.', '3/4 = 6/8.', 'Compare 6/8 e 5/8: os inteiros estão divididos em partes do mesmo tamanho.', 'Como 6/8 > 5/8, então 3/4 > 5/8.'], answer: '3/4 é maior que 5/8.' },
      guidedPractice: [{ prompt: 'Represente 2/3 e 4/6 em uma reta ou desenho.', scaffold: 'Divida o mesmo inteiro em 3 ou 6 partes iguais e compare a porção.' }, { prompt: 'Compare 5/6 com 1/2 sem transformar para decimal.', scaffold: 'Metade de 6 partes iguais são 3 partes.' }, { prompt: 'Ordene 1/4, 3/4 e 1/2.', scaffold: 'Escreva todas em oitavos ou use a posição entre 0 e 1.' }],
      application: [{ context: 'Receita', prompt: 'Uma receita usa 2/3 de xícara de água; outra usa 3/4. Qual usa mais? Mostre uma comparação que mantenha o mesmo tamanho de xícara.' }, { context: 'Leitura de dados', prompt: 'Em uma votação, 4/8 da turma escolheu leitura e 3/6 escolheu desenho. As frações representam quantidades diferentes? Explique.' }],
      review: ['Compare frações de inteiros de mesmo tamanho.', 'O denominador indica o tamanho das partes iguais.', 'Frações equivalentes nomeiam a mesma quantidade.', 'Use uma representação, equivalência ou referência conhecida.', 'Confira se a comparação responde à pergunta.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06ma07-q1','cev2-ef06ma07-q2','cev2-ef06ma07-q3','cev2-ef06ma07-q4','cev2-ef06ma07-q5'] },
    },
    questions: [
      q('cev2-ef06ma07-q1','PROBE','EASY','Em uma figura dividida em 8 partes iguais, 3 estão pintadas. Qual fração representa a parte pintada?', ['3/8','8/3','5/8','3/5'],'3/8','O numerador conta as partes pintadas; o denominador conta todas as partes iguais do inteiro.','Inverter numerador e denominador ou contar somente as partes sem pintar.'),
      q('cev2-ef06ma07-q2','PRACTICE','EASY','Qual fração é equivalente a 2/3?', ['4/6','3/4','2/6','5/6'],'4/6','Multiplicar numerador e denominador de 2/3 por 2 produz 4/6 sem alterar a quantidade.','Alterar só o numerador ou só o denominador.'),
      q('cev2-ef06ma07-q3','TRANSFER','MEDIUM','Lia percorreu 5/8 de uma trilha e Caio percorreu 3/4 da mesma trilha. Quem percorreu mais?', ['Lia','Caio','Percorreram a mesma distância','Não é possível comparar, pois os denominadores diferem'],'Caio','3/4 equivale a 6/8; assim, 6/8 é maior que 5/8.','Comparar apenas os denominadores ou os numeradores isoladamente.'),
      q('cev2-ef06ma07-q4','LOCK_IN','MEDIUM','Qual explicação mostra por que 2/5 é menor que 4/5?', ['As partes têm o mesmo tamanho e 2 partes são menos que 4','O denominador 5 é menor que 4','2/5 é maior porque 2 é par','Frações com numeradores diferentes não podem ser comparadas'],'As partes têm o mesmo tamanho e 2 partes são menos que 4','Com denominadores iguais, as partes unitárias têm o mesmo tamanho; compare quantas partes foram tomadas.','Confundir o tamanho do denominador com a quantidade representada.'),
      q('cev2-ef06ma07-q5','REVIEW','MEDIUM','Qual afirmação é verdadeira para 1/2 e 3/6?', ['Representam a mesma quantidade','1/2 é maior porque tem denominador menor','3/6 é maior porque tem numerador maior','Só seriam iguais se os denominadores fossem iguais'],'Representam a mesma quantidade','3/6 simplifica para 1/2; as duas frações ocupam o mesmo ponto na reta numérica.','Achar que a forma escrita determina a quantidade sem considerar equivalência.'),
    ],
  },
  {
    journeyCode: 'CEV2_EF06CI01_MISTURAS_01', journeyTitle: 'Misturas homogêneas e heterogêneas', subject: 'SCIENCE', grade: 6,
    officialSkillCode: 'EF06CI01', skill: 'SCIENCE_MIXTURE_CLASSIFICATION', unitCode: 'SCI_MATERIAIS', unitTitle: 'Materiais e transformações',
    officialText: 'Classificar como homogênea ou heterogênea a mistura de dois ou mais materiais (água e sal, água e óleo, água e areia etc.).',
    lesson: {
      title: 'Observar fases para classificar misturas', estimatedMinutes: 18,
      introduction: 'Ao preparar água com sal, os grãos podem deixar de ser visíveis. Em um copo com água e óleo, aparecem camadas. Observar o sistema com cuidado ajuda a descrever o que vemos sem confundir aparência com composição.',
      explanation: 'Mistura é formada por dois ou mais materiais. Para a classificação escolar, observe quantas fases visíveis compõem o sistema: uma fase uniforme indica mistura homogênea; duas ou mais fases visíveis indicam mistura heterogênea. Dissolver sal em água não significa que o sal desapareceu como matéria: suas partículas continuam distribuídas no líquido. A observação depende das condições e do tempo; registre o que foi realmente observado.',
      workedExample: { prompt: 'Após mexer água e areia, o sistema tem uma ou mais fases visíveis?', steps: ['Observe o líquido sem agitar novamente.', 'A areia pode se depositar e continuar distinguível da água.', 'Como há regiões com aspecto diferente, observam-se duas fases.', 'Classifique o sistema como heterogêneo.'], answer: 'Mistura heterogênea.' },
      guidedPractice: [{ prompt: 'Compare um copo com água e sal dissolvido a outro com água e óleo.', scaffold: 'Conte as fases visíveis em cada sistema, sem usar somente a cor.' }, { prompt: 'Explique por que água com sal continua sendo uma mistura.', scaffold: 'Pense nos materiais usados antes de mexer.' }, { prompt: 'O que precisa ser registrado para outra pessoa repetir a observação?', scaffold: 'Inclua materiais, quantidades aproximadas e o que foi visto.' }],
      application: [{ context: 'Laboratório escolar', prompt: 'Uma amostra contém água e pequenos grãos de areia. Registre evidências observáveis e classifique a mistura.' }, { context: 'Cozinha', prompt: 'Açúcar foi misturado à água até não ser mais visível. Explique a classificação e o que a observação não permite concluir.' }],
      review: ['Mistura reúne dois ou mais materiais.', 'Fase é cada porção visualmente uniforme do sistema observado.', 'Uma fase visível indica mistura homogênea; mais de uma, heterogênea.', 'Dissolução não significa desaparecimento da matéria.', 'Descreva evidências antes de classificar.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06ci01-q1','cev2-ef06ci01-q2','cev2-ef06ci01-q3','cev2-ef06ci01-q4','cev2-ef06ci01-q5'] },
    },
    questions: [
      q('cev2-ef06ci01-q1','PROBE','EASY','Depois de mexer água com sal até o sal não ficar visível, o sistema observado apresenta:', ['Uma fase visível e aspecto uniforme','Duas camadas visíveis','Somente sal sólido','Três fases obrigatórias'],'Uma fase visível e aspecto uniforme','Quando o sal está dissolvido e distribuído, observa-se uma fase uniforme; a mistura continua contendo os dois materiais.','Concluir que o sal deixou de existir porque não pode ser visto.'),
      q('cev2-ef06ci01-q2','PRACTICE','EASY','Água e óleo, em repouso, formam camadas visíveis. Como classificar?', ['Heterogênea','Homogênea','Substância pura','Gás'],'Heterogênea','As duas camadas são fases distintas e visíveis, evidência de mistura heterogênea.','Classificar pela quantidade de líquidos, sem observar fases.'),
      q('cev2-ef06ci01-q3','TRANSFER','MEDIUM','Uma estudante mistura água, sal e areia. A areia se deposita no fundo; a água salgada permanece acima. O sistema é:', ['Heterogêneo, pois há mais de uma fase visível','Homogêneo, pois todos os materiais foram mexidos','Substância pura, pois a areia ficou no fundo','Homogêneo, porque o sal não aparece'],'Heterogêneo, pois há mais de uma fase visível','A porção de areia e a solução aquosa podem ser distinguidas como fases diferentes.','Considerar apenas o sal dissolvido e ignorar a areia.'),
      q('cev2-ef06ci01-q4','LOCK_IN','MEDIUM','Qual observação é evidência mais direta para classificar uma mistura como heterogênea?', ['É possível distinguir duas porções com aspectos diferentes','O recipiente é transparente','Os materiais foram comprados em lugares diferentes','A mistura foi agitada por dez segundos'],'É possível distinguir duas porções com aspectos diferentes','A classificação se apoia nas fases observáveis do sistema.','Usar informação sobre o recipiente ou o procedimento como se fosse a observação das fases.'),
      q('cev2-ef06ci01-q5','REVIEW','MEDIUM','Ao não ver mais os cristais de açúcar após mexer a água, o que é correto concluir?', ['O açúcar se dissolveu e a mistura pode apresentar uma fase uniforme','O açúcar foi destruído','A água virou substância pura','Não há mais matéria no copo'],'O açúcar se dissolveu e a mistura pode apresentar uma fase uniforme','A aparência uniforme é compatível com dissolução; a matéria do açúcar continua na solução.','Confundir invisibilidade com desaparecimento.'),
    ],
  },
  {
    journeyCode: 'CEV2_EF06CI02_TRANSFORMACOES_01', journeyTitle: 'Evidências de transformações químicas', subject: 'SCIENCE', grade: 6,
    officialSkillCode: 'EF06CI02', skill: 'SCIENCE_CHEMICAL_TRANSFORMATION_EVIDENCE', unitCode: 'SCI_MATERIAIS', unitTitle: 'Materiais e transformações',
    officialText: 'Identificar evidências de transformações químicas a partir do resultado de misturas de materiais que originam produtos diferentes dos que foram misturados.',
    lesson: {
      title: 'Distinguir mistura de transformação química', estimatedMinutes: 19,
      introduction: 'Misturar farinha e água muda a aparência, mas nem toda mudança visível produz novas substâncias. Em algumas combinações, aparecem gás, mudança de cor ou materiais com propriedades diferentes. O importante é reunir evidências, não adivinhar apenas pelo aspecto.',
      explanation: 'Uma transformação química ocorre quando materiais de partida dão origem a substâncias com propriedades diferentes. Formação de gás, mudança persistente de cor, liberação ou absorção de energia e formação de sólido podem ser indícios, mas cada sinal precisa ser interpretado no contexto. Misturar sem reagir também pode mudar a aparência. Em experimentos escolares, compare o antes e o depois e siga as regras de segurança; nunca prove ou cheire diretamente materiais.',
      workedExample: { prompt: 'Vinagre e bicarbonato são misturados e surgem bolhas. Qual evidência deve ser registrada?', steps: ['Registre os materiais antes da mistura.', 'Observe a formação de bolhas sem aproximar o rosto.', 'Bolhas sugerem a produção de um gás durante a reação.', 'Relacione o sinal ao conjunto de mudanças, sem afirmar além do observado.'], answer: 'A formação de gás é evidência compatível com transformação química.' },
      guidedPractice: [{ prompt: 'Compare gelo derretendo com massa de bolo assando.', scaffold: 'Pergunte se surgem materiais com propriedades diferentes e se a mudança pode ser desfeita facilmente.' }, { prompt: 'Quais observações podem ser registradas sem tocar nos materiais?', scaffold: 'Cor, bolhas, temperatura medida e formação de sólido podem ser descritos.' }, { prompt: 'Por que uma mudança de cor isolada não prova sempre uma reação?', scaffold: 'Pense em iluminação, mistura de tintas e outras mudanças físicas.' }],
      application: [{ context: 'Cozinha', prompt: 'Ao assar uma massa, cor e textura mudam. Cite evidências e explique por que a conclusão deve considerar o conjunto da transformação.' }, { context: 'Experimento seguro', prompt: 'Planeje um registro de observação para vinagre e bicarbonato, indicando o que observar antes e depois e como manter segurança.' }],
      review: ['Mudança de aparência, sozinha, não prova transformação química.', 'Compare materiais antes e produtos depois.', 'Gás, cor, temperatura ou sólido podem ser evidências, conforme o contexto.', 'Registre somente o que foi observado.', 'Siga instruções de segurança e não prove materiais.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06ci02-q1','cev2-ef06ci02-q2','cev2-ef06ci02-q3','cev2-ef06ci02-q4','cev2-ef06ci02-q5'] },
    },
    questions: [
      q('cev2-ef06ci02-q1','PROBE','EASY','Ao misturar vinagre e bicarbonato, observam-se bolhas. Qual é uma interpretação cuidadosa?', ['A formação de gás é evidência compatível com transformação química','As bolhas provam que o vinagre evaporou por completo','A mistura virou uma substância pura','Não ocorreu mudança porque os materiais continuam no copo'],'A formação de gás é evidência compatível com transformação química','As bolhas são uma evidência observável de formação de gás; a explicação considera o processo da mistura.','Afirmar que as bolhas, sem contexto, provam qualquer conclusão específica.'),
      q('cev2-ef06ci02-q2','PRACTICE','EASY','Qual situação apresenta a evidência mais clara de novos produtos após misturar materiais?', ['Vinagre e bicarbonato liberam gás','Areia é colocada em água e se deposita','Pedras são separadas por tamanho','Água líquida é colocada em outro copo'],'Vinagre e bicarbonato liberam gás','A liberação de gás na reação entre os materiais é evidência de transformação química.','Confundir separação física ou transferência de recipiente com formação de substância.'),
      q('cev2-ef06ci02-q3','TRANSFER','MEDIUM','Uma fruta cortada escurece depois de algum tempo. O que um registro científico deve fazer primeiro?', ['Descrever a mudança observada e comparar condições antes de explicar','Afirmar que toda mudança de cor é uma nova substância','Misturar a fruta com qualquer produto de limpeza','Provar a fruta para identificar a reação'],'Descrever a mudança observada e comparar condições antes de explicar','Registrar a observação e as condições permite avaliar a evidência sem tirar conclusões precipitadas.','Tratar uma evidência isolada como prova completa ou propor ação insegura.'),
      q('cev2-ef06ci02-q4','LOCK_IN','MEDIUM','Qual exemplo é principalmente uma mudança física?', ['Gelo derrete e continua sendo água','Pão assa e muda de cheiro e textura','Vinagre e bicarbonato liberam gás','Ferro enferruja ao longo do tempo'],'Gelo derrete e continua sendo água','Na fusão, muda o estado físico, mas o material continua sendo água.','Supor que toda mudança visível é uma reação química.'),
      q('cev2-ef06ci02-q5','REVIEW','MEDIUM','Durante uma observação escolar, qual atitude é segura e cientificamente útil?', ['Registrar mudanças sem provar nem cheirar diretamente os materiais','Aproximar o rosto para sentir qualquer gás','Misturar produtos de limpeza para comparar','Descartar o registro e confiar apenas na memória'],'Registrar mudanças sem provar nem cheirar diretamente os materiais','Observação documentada e segura permite comparar o antes e o depois.','Priorizar curiosidade sem seguir as regras de segurança.'),
    ],
  },
  {
    journeyCode: 'CEV2_EF06CI03_SEPARACAO_01', journeyTitle: 'Escolher métodos de separação', subject: 'SCIENCE', grade: 6,
    officialSkillCode: 'EF06CI03', skill: 'SCIENCE_SEPARATION_METHODS', unitCode: 'SCI_MATERIAIS', unitTitle: 'Materiais e transformações',
    officialText: 'Selecionar métodos mais adequados para a separação de diferentes sistemas heterogêneos a partir da identificação de processos de separação de materiais.',
    lesson: {
      title: 'Relacionar propriedades e métodos de separação', estimatedMinutes: 20,
      introduction: 'Uma mistura de areia e água precisa ser separada. O método escolhido depende do que sabemos dos materiais: tamanho das partículas, capacidade de dissolver, densidade e possibilidade de evaporação.',
      explanation: 'Sistemas heterogêneos podem ser separados por métodos físicos escolhidos conforme as propriedades dos componentes. Filtração retém partículas sólidas maiores que os poros do filtro; decantação aproveita a diferença de densidade depois que as fases se separam; peneiração distingue sólidos por tamanho; evaporação pode recuperar um sólido dissolvido, embora a água não seja recolhida nesse processo simples. Um método adequado responde ao objetivo e considera segurança e impacto ambiental.',
      workedExample: { prompt: 'Como separar areia de água em uma atividade escolar?', steps: ['A areia não está dissolvida e forma partículas sólidas.', 'Um filtro permite a passagem da água e retém grande parte da areia.', 'A filtração é adequada para separar sólido não dissolvido de líquido.', 'Registre que a água filtrada pode ainda conter substâncias dissolvidas.'], answer: 'Filtração, observando que ela não remove substâncias dissolvidas.' },
      guidedPractice: [{ prompt: 'Escolha entre peneiração, filtração e decantação para separar cada mistura.', scaffold: 'Observe se são sólidos de tamanhos diferentes ou sólido e líquido.' }, { prompt: 'Como recuperar sal dissolvido em água usando evaporação?', scaffold: 'A água passa ao estado gasoso e o sal pode permanecer como sólido.' }, { prompt: 'O que deve ser considerado ao escolher um método para grande escala?', scaffold: 'Além de separar, avalie energia, resíduos, segurança e recuperação dos materiais.' }],
      application: [{ context: 'Tratamento de água', prompt: 'Explique por que uma peneira grossa não remove sal dissolvido e proponha um processo diferente para reter partículas maiores.' }, { context: 'Reciclagem', prompt: 'Uma mistura tem parafusos de ferro e areia. Escolha um método, justifique pela propriedade usada e indique um limite.' }],
      review: ['Identifique os componentes e se há uma ou mais fases.', 'Relacione o método à propriedade física usada.', 'Filtração retém sólidos não dissolvidos; decantação separa fases após repouso.', 'Evaporação pode deixar o sólido dissolvido, mas não recolhe a água.', 'Considere finalidade, segurança e resíduos.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06ci03-q1','cev2-ef06ci03-q2','cev2-ef06ci03-q3','cev2-ef06ci03-q4','cev2-ef06ci03-q5'] },
    },
    questions: [
      q('cev2-ef06ci03-q1','PROBE','EASY','Qual método separa melhor areia não dissolvida da água em uma atividade simples?', ['Filtração','Peneiração fina do líquido sem filtro','Imantação','Congelamento'],'Filtração','O filtro retém partículas de areia e permite a passagem da água.','Achar que a água com areia pode ser separada por magnetismo.'),
      q('cev2-ef06ci03-q2','PRACTICE','EASY','Para separar pedrinhas de tamanhos diferentes, qual método é mais adequado?', ['Peneiração','Evaporação','Destilação do sólido','Dissolução em óleo'],'Peneiração','A peneira separa sólidos conforme o tamanho de suas partículas.','Escolher método de separação de sólido e líquido para dois sólidos.'),
      q('cev2-ef06ci03-q3','TRANSFER','MEDIUM','Depois que água e óleo ficam em camadas, qual processo pode facilitar a separação?', ['Decantação','Filtração para dissolver o óleo','Peneiração','Evaporação do óleo sem avaliar segurança'],'Decantação','As fases líquidas com densidades diferentes podem ser separadas por decantação apropriada.','Supor que filtros comuns retêm um líquido dissolvido em outro.'),
      q('cev2-ef06ci03-q4','LOCK_IN','MEDIUM','Uma solução de água e sal é filtrada. O que se espera?', ['O sal dissolvido atravessa o filtro junto com a água','Todo o sal fica retido no filtro','A água vira areia','O sal se transforma em gás imediatamente'],'O sal dissolvido atravessa o filtro junto com a água','Partículas dissolvidas passam pelo filtro comum; filtração não separa uma solução desse modo.','Confundir substância dissolvida com sólido suspenso.'),
      q('cev2-ef06ci03-q5','REVIEW','MEDIUM','Para obter sal de uma solução aquosa por evaporação simples, o que fica no recipiente ao final?', ['O sal sólido','A água líquida e todo o sal, sem mudança','Somente o filtro','Areia formada pela água'],'O sal sólido','A água evapora e o soluto não volátil pode permanecer como sólido.','Esperar que evaporação simples recupere também a água como líquido.'),
    ],
  },
  {
    journeyCode: 'CEV2_EF06LP02_NOTICIA_01', journeyTitle: 'Notícia e outros gêneros jornalísticos', subject: 'PORTUGUESE', grade: 6,
    officialSkillCode: 'EF06LP02', skill: 'PORTUGUESE_JOURNALISTIC_GENRES', unitCode: 'LP_LEITURA', unitTitle: 'Leitura, gêneros e sentidos',
    officialText: 'Estabelecer relação entre os diferentes gêneros jornalísticos, compreendendo a centralidade da notícia.',
    lesson: {
      title: 'Reconhecer a notícia e sua relação com outros gêneros', estimatedMinutes: 20,
      introduction: 'Uma escola publica uma notícia sobre a abertura da biblioteca e, na semana seguinte, uma entrevista com estudantes sobre o espaço. Os textos tratam do mesmo assunto, mas têm objetivos e formas diferentes.',
      explanation: 'Gêneros jornalísticos compartilham a circulação de informações de interesse público, mas organizam o conteúdo de modos diferentes. A notícia apresenta um fato de forma concisa, geralmente respondendo o que aconteceu, com quem, onde e quando. Reportagens podem aprofundar causas, dados e diferentes perspectivas; entrevistas organizam perguntas e respostas. Manchete, título, data, autoria e fontes ajudam o leitor a compreender a publicação, mas não substituem a leitura do texto completo.',
      workedExample: { prompt: '“Biblioteca da escola reabre nesta segunda-feira” é uma manchete. O que ela informa e o que ainda precisa ser confirmado no texto?', steps: ['A manchete indica o acontecimento principal: a reabertura.', '“Nesta segunda-feira” apresenta uma referência temporal que depende da data da publicação.', 'O texto deve trazer informações como local, horário e fonte.', 'A manchete resume; ela não apresenta necessariamente todos os detalhes.'], answer: 'A manchete anuncia a reabertura, mas o leitor deve conferir data, local e detalhes na notícia.' },
      guidedPractice: [{ prompt: 'Compare uma notícia curta e uma entrevista sobre o mesmo evento.', scaffold: 'Observe quem organiza a informação e qual pergunta cada gênero responde.' }, { prompt: 'Que dados ajudam a verificar quando e onde um fato ocorreu?', scaffold: 'Procure data, local, autoria e fontes citadas.' }, { prompt: 'Por que a manchete não basta para conhecer todos os lados de um fato?', scaffold: 'Ela seleciona e resume informações em poucas palavras.' }],
      application: [{ context: 'Comunicação escolar', prompt: 'Planeje uma notícia curta sobre uma feira de ciências. Liste as informações essenciais e indique como confirmaria cada uma.' }, { context: 'Leitura crítica', prompt: 'Uma manchete chama atenção para um detalhe, mas o texto destaca outro. Explique por que é importante ler o corpo da notícia.' }],
      review: ['A notícia relata um fato de interesse público de modo conciso.', 'Reportagem pode aprofundar contexto, fontes e perspectivas.', 'Entrevista organiza perguntas e respostas.', 'Manchete resume e seleciona; o texto oferece detalhes.', 'Confira autoria, data e fontes antes de compartilhar.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06lp02-q1','cev2-ef06lp02-q2','cev2-ef06lp02-q3','cev2-ef06lp02-q4','cev2-ef06lp02-q5'] },
    },
    questions: [
      q('cev2-ef06lp02-q1','PROBE','EASY','Qual é uma função central de uma notícia?', ['Relatar um fato de interesse público com informações essenciais','Ensinar uma receita passo a passo','Contar sempre uma história imaginária','Apresentar somente a opinião pessoal do leitor'],'Relatar um fato de interesse público com informações essenciais','A notícia informa um fato e ajuda o leitor a localizar dados principais.','Confundir notícia com narrativa ficcional ou opinião individual.'),
      q('cev2-ef06lp02-q2','PRACTICE','EASY','Em uma entrevista, como costuma ser organizado o texto?', ['Por perguntas e respostas','Somente por versos rimados','Por lista de ingredientes','Por instruções numeradas obrigatórias'],'Por perguntas e respostas','A entrevista registra perguntas do entrevistador e respostas da pessoa entrevistada.','Reduzir todo texto jornalístico à forma de uma notícia.'),
      q('cev2-ef06lp02-q3','TRANSFER','MEDIUM','Uma reportagem traz dados, entrevista moradores e explica como uma praça mudou ao longo do tempo. O que a diferencia de uma notícia breve?', ['Aprofunda o contexto e diferentes informações sobre o tema','Não pode informar fatos','É sempre uma conversa privada','Dispensa fontes e autoria'],'Aprofunda o contexto e diferentes informações sobre o tema','A reportagem desenvolve o assunto com contexto, dados e fontes, enquanto a notícia tende a ser mais concisa.','Supor que a reportagem deixa de ser jornalística por ser mais detalhada.'),
      q('cev2-ef06lp02-q4','LOCK_IN','MEDIUM','Uma manchete informa “Aulas de música começam na quinta”, mas não diz o horário. Onde procurar esse detalhe?', ['No texto completo e nas informações de serviço da publicação','Concluir que todas as aulas serão à meia-noite','Somente no tamanho da manchete','Ignorar a data da publicação'],'No texto completo e nas informações de serviço da publicação','A manchete resume o fato; detalhes devem ser conferidos no corpo e no serviço da notícia.','Achar que manchetes sempre trazem todas as informações.'),
      q('cev2-ef06lp02-q5','REVIEW','MEDIUM','Dois textos tratam do mesmo acontecimento: um relata o fato e outro apresenta respostas de uma atleta. Como podem ser classificados?', ['Notícia e entrevista, respectivamente','Dois anúncios necessariamente','Conto e receita','Bilhete e verbete'],'Notícia e entrevista, respectivamente','O primeiro relata o acontecimento; o segundo organiza a fala da atleta por perguntas e respostas.','Classificar os gêneros apenas pelo tema, sem observar organização e finalidade.'),
    ],
  },
  {
    journeyCode: 'CEV2_EF06LP03_SERIE_SINONIMICA_01', journeyTitle: 'Escolha de palavras e sentidos', subject: 'PORTUGUESE', grade: 6,
    officialSkillCode: 'EF06LP03', skill: 'PORTUGUESE_SYNONYMY_CONTEXT', unitCode: 'LP_LEITURA', unitTitle: 'Leitura, gêneros e sentidos',
    officialText: 'Analisar diferenças de sentido entre palavras de uma série sinonímica.',
    lesson: {
      title: 'Sinônimos dependem do contexto', estimatedMinutes: 18,
      introduction: 'Em um aviso, “a entrada está liberada” pode ser adequada; em outro contexto, “a entrada está gratuita” significa algo diferente. Palavras próximas nem sempre podem ser trocadas sem mudar o sentido.',
      explanation: 'Palavras de uma série sinonímica compartilham alguns sentidos, mas podem variar em intensidade, formalidade, avaliação e combinações comuns. “Observar” e “examinar” se aproximam, mas examinar costuma indicar atenção mais detalhada. Para escolher, releia a frase, identifique o que o autor quer dizer e teste a substituição. Se a ideia, o tom ou a precisão mudarem, as palavras não funcionam como equivalentes naquele contexto.',
      workedExample: { prompt: 'No trecho “A pesquisadora examinou as amostras ao microscópio”, qual troca preserva melhor a ideia?', steps: ['Identifique a ação: observar as amostras com atenção.', '“Analisou” mantém a ideia de observação cuidadosa.', '“Olhou” é possível, mas menos específico.', 'Confira se a frase continua adequada ao contexto científico.'], answer: '“Analisou” preserva o sentido com maior precisão.' },
      guidedPractice: [{ prompt: 'Compare “casa”, “moradia” e “lar” em frases diferentes.', scaffold: 'Perceba diferenças de formalidade e de vínculo afetivo.' }, { prompt: 'Substitua “disse” por “avisou” em uma frase e avalie o que muda.', scaffold: 'Pergunte se a fala comunica uma informação importante a alguém.' }, { prompt: 'Por que um dicionário de sinônimos oferece possibilidades, não trocas automáticas?', scaffold: 'Considere regência, situação e intenção do texto.' }],
      application: [{ context: 'Revisão de texto', prompt: 'Revise a frase “O estudante viu os dados com cuidado”. Escolha um verbo mais preciso e explique a diferença.' }, { context: 'Comunicação', prompt: 'Em um convite formal, compare “venha”, “compareça” e “apareça”. Qual combina melhor com o tom? Justifique.' }],
      review: ['Sinônimos têm sentidos próximos, não necessariamente idênticos.', 'Contexto, formalidade e intensidade influenciam a escolha.', 'Teste a substituição dentro da frase.', 'Observe se a precisão e o tom são preservados.', 'Use o dicionário como apoio e confirme pelo contexto.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06lp03-q1','cev2-ef06lp03-q2','cev2-ef06lp03-q3','cev2-ef06lp03-q4','cev2-ef06lp03-q5'] },
    },
    questions: [
      q('cev2-ef06lp03-q1','PROBE','EASY','Na frase “A turma observou atentamente o mapa”, qual verbo mantém melhor a ideia de olhar com atenção?', ['Examinou','Esqueceu','Escondeu','Anunciou'],'Examinou','“Examinou” mantém a ideia de observar cuidadosamente o mapa.','Escolher palavra que compartilha alguma situação, mas não o sentido da ação.'),
      q('cev2-ef06lp03-q2','PRACTICE','EASY','Em “O aviso informa que a biblioteca fecha às 17h”, qual palavra pode substituir “informa” sem mudar muito o sentido?', ['Comunica','Esconde','Apaga','Atrasa'],'Comunica','“Comunica” também indica transmitir uma informação ao leitor.','Usar palavra com sentido oposto ou referente a outra ação.'),
      q('cev2-ef06lp03-q3','TRANSFER','MEDIUM','Em um convite formal, “compareça à reunião” soa mais adequado que “dê as caras”. Por quê?', ['As expressões têm níveis de formalidade diferentes','As duas têm sempre o mesmo tom','“Compareça” não tem relação com ir a um lugar','A frase formal precisa rimar'],'As expressões têm níveis de formalidade diferentes','O contexto formal favorece uma escolha compatível com o tom esperado.','Ignorar o efeito de registro e considerar só o sentido geral de presença.'),
      q('cev2-ef06lp03-q4','LOCK_IN','MEDIUM','Na frase “O atleta correu rapidamente”, substituir “rapidamente” por “devagar” preserva o sentido?', ['Não; “devagar” indica o sentido contrário','Sim; as palavras são sinônimas perfeitas','Sim; ambas indicam rapidez','Não, porque advérbios não podem ser substituídos'],'Não; “devagar” indica o sentido contrário','A substituição altera a informação sobre a velocidade da ação.','Confundir pertencimento à mesma classe gramatical com sinonímia.'),
      q('cev2-ef06lp03-q5','REVIEW','MEDIUM','Qual é a melhor maneira de verificar se um sinônimo funciona em uma frase?', ['Substituir no contexto e conferir se ideia, precisão e tom permanecem','Escolher sempre a palavra mais longa','Usar a primeira opção encontrada','Trocar todas as palavras por termos formais'],'Substituir no contexto e conferir se ideia, precisão e tom permanecem','A leitura contextual revela mudanças de sentido, intensidade ou registro.','Tratar a lista de sinônimos como equivalência automática.'),
    ],
  },
  {
    journeyCode: 'CEV2_EF06LP05_MODOS_VERBAIS_01', journeyTitle: 'Modos verbais e intenção comunicativa', subject: 'PORTUGUESE', grade: 6,
    officialSkillCode: 'EF06LP05', skill: 'PORTUGUESE_VERB_MOOD_EFFECTS', unitCode: 'LP_LEITURA', unitTitle: 'Leitura, gêneros e sentidos',
    officialText: 'Identificar os efeitos de sentido dos modos verbais, considerando o gênero textual e a intenção comunicativa.',
    lesson: {
      title: 'O modo verbal ajuda a orientar o leitor', estimatedMinutes: 19,
      introduction: 'Compare “A feira começa às nove”, “Talvez a feira comece às nove” e “Chegue às nove”. Os verbos apresentam uma informação, uma possibilidade e uma orientação.',
      explanation: 'O modo indicativo costuma apresentar fatos ou afirmações; o subjuntivo marca possibilidade, hipótese ou desejo; o imperativo orienta, solicita ou aconselha. O efeito depende do gênero e da situação: em uma notícia, a forma verbal pode apresentar um fato; em uma regra, pode orientar uma ação. Leia a frase completa e observe quem fala, para quem e com qual finalidade antes de classificar o efeito.',
      workedExample: { prompt: 'Em “Talvez a equipe chegue antes do início”, que efeito o verbo produz?', steps: ['“Talvez” introduz uma possibilidade, não uma certeza.', '“Chegue” está no modo subjuntivo.', 'O enunciado expressa expectativa incerta.', 'Compare com “A equipe chega às oito”, que apresenta uma afirmação.'], answer: 'A frase expressa uma possibilidade.' },
      guidedPractice: [{ prompt: 'Compare “Use o cinto” e “Você usa o cinto”.', scaffold: 'Observe qual frase orienta uma ação.' }, { prompt: 'Transforme uma certeza em hipótese usando “talvez”.', scaffold: 'A escolha do modo verbal deve acompanhar o sentido de possibilidade.' }, { prompt: 'Por que uma instrução pode usar o imperativo sem ser agressiva?', scaffold: 'O gênero e a cortesia do texto também influenciam o efeito.' }],
      application: [{ context: 'Cartaz escolar', prompt: 'Escreva uma orientação para cuidar dos livros e explique o efeito do verbo escolhido.' }, { context: 'Notícia', prompt: 'Compare “O grêmio organiza a feira” com “O grêmio talvez organize a feira”. Explique a diferença de certeza.' }],
      review: ['Indicativo costuma afirmar ou apresentar fatos.', 'Subjuntivo pode expressar dúvida, possibilidade, desejo ou hipótese.', 'Imperativo orienta, solicita ou aconselha.', 'O efeito depende do gênero, do interlocutor e da intenção.', 'Leia o contexto antes de interpretar o verbo.'],
      learningCheck: { passRule: 'A revisão técnica verifica cada resposta; a revisão pedagógica humana permanece pendente.', questionIds: ['cev2-ef06lp05-q1','cev2-ef06lp05-q2','cev2-ef06lp05-q3','cev2-ef06lp05-q4','cev2-ef06lp05-q5'] },
    },
    questions: [
      q('cev2-ef06lp05-q1','PROBE','EASY','Na frase “Talvez a biblioteca abra no sábado”, o verbo “abra” indica:', ['Possibilidade','Ordem direta','Fato confirmado','Ação encerrada'],'Possibilidade','“Talvez” e o subjuntivo apresentam uma hipótese, não uma confirmação.','Ler qualquer verbo no presente como certeza.'),
      q('cev2-ef06lp05-q2','PRACTICE','EASY','Em um cartaz, “Separe o papel para reciclagem” tem principalmente o efeito de:', ['Orientar uma ação','Relatar um fato passado','Expressar dúvida','Descrever uma lembrança'],'Orientar uma ação','O imperativo “separe” dirige uma orientação ao leitor.','Confundir uma orientação com uma afirmação sobre o que já aconteceu.'),
      q('cev2-ef06lp05-q3','TRANSFER','MEDIUM','Qual frase apresenta uma informação como fato, sem marcar hipótese?', ['A equipe começa a apresentação às dez','Talvez a equipe comece às dez','Se a equipe começasse às dez','Comece a apresentação às dez'],'A equipe começa a apresentação às dez','A frase no indicativo apresenta diretamente a informação.','Ignorar marcadores de hipótese ou interpretar uma ordem como notícia.'),
      q('cev2-ef06lp05-q4','LOCK_IN','MEDIUM','Em “Espero que os estudantes participem”, qual sentido o subjuntivo ajuda a expressar?', ['Desejo ou expectativa','Ordem concluída','Fato comprovado','Ação habitual obrigatória'],'Desejo ou expectativa','“Espero que” introduz desejo ou expectativa e favorece o subjuntivo “participem”.','Classificar o modo verbal sem observar a expressão que o acompanha.'),
      q('cev2-ef06lp05-q5','REVIEW','MEDIUM','Por que “Feche a janela” pode ser uma instrução em um manual?', ['O imperativo orienta o leitor a realizar uma ação','O verbo sempre relata algo passado','A frase expressa uma possibilidade incerta','Todo imperativo é necessariamente uma ameaça'],'O imperativo orienta o leitor a realizar uma ação','O gênero manual e o contexto mostram que o imperativo organiza passos.','Atribuir um tom agressivo automático sem considerar gênero e finalidade.'),
    ],
  },

];

for (const candidate of candidates) {
  candidate.version = version;
  candidate.stage = 'ENSINO_FUNDAMENTAL';
  candidate.contentAuthoringStatus = 'TECH_VALIDATED_PENDING_REVIEW';
  candidate.pedagogicalReviewStatus = 'PEDAGOGICAL_REVIEW_PENDING';
  candidate.publicationStatus = 'STAGING';
  candidate.officialSource = {
    id: 'BNCC_EI_EF_2018',
    documentVersion: 'BNCC Educação Infantil e Ensino Fundamental, versão final 2018',
    url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
    catalogPath: 'content/bncc/official/catalog-2018.json',
    repositoryExtractionStatus: 'AUTOMATED_TEXT_EXTRACTION_REVIEW_REQUIRED',
  };
  for (const question of candidate.questions) question.officialSkillCode = candidate.officialSkillCode;
  const output = join(root, 'content', 'adaptive', 'central-estudos-v2', 'journeys', `${candidate.officialSkillCode.toLowerCase()}-${candidate.journeyCode.split('_').at(-1).toLowerCase()}.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
}

const packageDir = join(root, 'content', 'adaptive', 'central-estudos-v2');
const journeysDir = join(packageDir, 'journeys');
const existingMatrix = JSON.parse(await readFile(join(packageDir, 'curriculum-matrix.json'), 'utf8'));
const previousRows = new Map(existingMatrix.map((row) => [row.journeyCode, row]));
const journeyFiles = (await readdir(journeysDir)).filter((file) => file.endsWith('.json')).sort();
const journeys = [];
for (const file of journeyFiles) {
  const path = join(journeysDir, file);
  const journey = JSON.parse(await readFile(path, 'utf8'));
  journey.version = version;
  journey.pedagogicalReviewStatus = 'PEDAGOGICAL_REVIEW_PENDING';
  journey.publicationStatus = 'STAGING';
  await writeFile(path, `${JSON.stringify(journey, null, 2)}\n`, 'utf8');
  journeys.push({ file, journey });
}

const matrix = journeys.map(({ journey }) => {
  const previous = previousRows.get(journey.journeyCode) ?? {};
  return {
    subject: journey.subject,
    stage: journey.stage,
    grade: journey.grade,
    journeyCode: journey.journeyCode,
    journeyTitle: journey.journeyTitle,
    officialSkillCode: journey.officialSkillCode,
    officialText: journey.officialText ?? previous.officialText,
    officialSource: journey.officialSource ?? previous.officialSource,
    alignmentStatus: 'SOURCE_MATCHED_CANDIDATE_PENDING_HUMAN_REVIEW',
    contentVersion: version,
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
  };
});
await writeFile(join(packageDir, 'curriculum-matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');

const manifest = JSON.parse(await readFile(join(packageDir, 'manifest.json'), 'utf8'));
manifest.packVersion = version;
manifest.status = 'STAGING';
manifest.publicationStatus = 'NOT_PUBLISHED';
manifest.humanPedagogicalReview = 'PENDING';
manifest.subjects = [...new Set(journeys.map(({ journey }) => journey.subject))].sort();
manifest.gradeScopes = [{ stage: 'ENSINO_FUNDAMENTAL', grade: 6 }];
manifest.candidateCount = journeys.length;
manifest.lessonCount = journeys.length;
manifest.questionCount = journeys.reduce((sum, { journey }) => sum + (journey.questions?.length ?? 0), 0);
manifest.policy = 'Automated validation never approves, publishes, or attributes pedagogy to a human reviewer.';
await writeFile(join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ written: candidates.length, lessons: journeys.length, questions: manifest.questionCount, version }, null, 2));
