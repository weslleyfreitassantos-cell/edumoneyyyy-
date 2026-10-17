import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = path.join(ROOT, 'content/adaptive/tec-escola-core-v5/science-materials-conscious-use-fi-v8.json');

const questions = [];
function addQuestion({ id, purpose, difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, explanation, hint, errorFocus }) {
  questions.push({
    id,
    purpose,
    difficulty,
    cognitiveProcess,
    contextFamily,
    statement,
    options: [correctAnswer, ...distractors],
    correctAnswer,
    explanation,
    hint,
    errorFocus,
  });
}

const probe = [
  ['material-observation', 'Uma colher de metal, uma tampa de plástico e uma folha de papel estão sobre a mesa. Qual afirmação descreve uma característica observável?', 'A colher, a tampa e a folha são objetos feitos de materiais diferentes.', ['A colher veio de uma floresta.', 'A tampa sempre será reciclada.', 'A folha foi produzida sem gastar energia.'], 'Observe o que está diante de você; não adivinhe a origem ou o destino.', 'Confundir observação com origem ou destino do material.'],
  ['material-use', 'Uma garrafa de vidro e uma garrafa de plástico podem guardar água. O que a comparação permite dizer?', 'As duas podem cumprir a mesma função, embora sejam feitas de materiais diferentes.', ['O vidro e o plástico são exatamente o mesmo material.', 'A função de um objeto depende apenas de sua cor.', 'Todo plástico deve ser descartado imediatamente.'], 'Compare função e material como informações diferentes.', 'Concluir que materiais diferentes são iguais em tudo.'],
  ['origin-natural', 'Uma caixa de papelão é feita de um material cuja origem está ligada às árvores. Qual é uma descrição adequada?', 'O papelão tem origem vegetal, embora passe por transformação industrial.', ['O papelão seja retirado pronto de uma árvore.', 'A caixa não tenha relação com nenhum recurso natural.', 'Todo papelão seja feito de metal.'], 'Pergunte de onde vem a matéria-prima e lembre-se das transformações.', 'Confundir matéria-prima com objeto pronto.'],
  ['conscious-choice', 'Uma turma pode usar uma folha nova ou o verso limpo de uma folha já usada para um rascunho. Qual escolha reduz o desperdício?', 'Usar o verso limpo para o rascunho e guardar a folha para outra finalidade.', ['Usar duas folhas novas para o mesmo rascunho.', 'Amassar folhas limpas sem usá-las.', 'Escolher a folha apenas pela cor.'], 'Procure a alternativa que usa melhor o que já está disponível.', 'Tratar consumo consciente como escolha de aparência.'],
];
probe.forEach(([contextFamily, statement, correctAnswer, distractors, hint, errorFocus], index) => addQuestion({ id: `v8-sci-materials-probe-${String(index + 1).padStart(2, '0')}`, purpose: 'PROBE', difficulty: 'EASY', cognitiveProcess: 'IDENTIFY', contextFamily, statement, correctAnswer, distractors, explanation: 'A resposta correta usa somente as informações observáveis ou a comparação indicada no enunciado.', hint, errorFocus }));

const practice = [
  ['compare-properties', 'Uma régua de madeira e uma régua de plástico têm o mesmo comprimento. Para escolher uma delas em uma atividade com água, qual propriedade merece ser observada?', 'Se o material resiste ao contato com a água no uso previsto.', ['A cor preferida do estudante.', 'O nome da loja onde foi comprada.', 'A quantidade de letras no nome da régua.'], 'Relacione a propriedade ao uso proposto.', 'Escolher um material por uma característica sem relação com a função.'],
  ['sort-disposal', 'Após uma atividade, há uma casca de fruta, uma garrafa de vidro limpa e um guardanapo muito sujo. O que deve orientar a separação?', 'A natureza do material e as condições em que cada resíduo está.', ['O tamanho dos resíduos apenas.', 'A ordem em que foram colocados na mesa.', 'O som produzido ao tocar cada item.'], 'Separe por características do resíduo, não por ordem ou aparência isolada.', 'Acreditar que toda separação depende de uma única característica.'],
  ['reuse-container', 'Um pote resistente e limpo pode ser usado para guardar lápis. Por que essa é uma alternativa consciente?', 'Porque prolonga o uso de um objeto antes de descartá-lo.', ['Porque transforma o pote em um material natural.', 'Porque impede qualquer outro resíduo de existir.', 'Porque todo pote deve guardar lápis.'], 'Prolongar o uso é diferente de afirmar que o objeto deixou de ser o que era.', 'Confundir reutilização com transformação completa do material.'],
  ['recycle-limit', 'Uma embalagem traz o símbolo de reciclagem, mas está cheia de restos de comida. Qual atitude é mais cuidadosa?', 'Verificar a orientação local e as condições necessárias para encaminhar a embalagem.', ['Colocar qualquer embalagem suja em qualquer coleta.', 'Concluir que o símbolo garante reciclagem imediata.', 'Queimar a embalagem para eliminá-la.'], 'Um símbolo não substitui a orientação sobre preparo e coleta.', 'Tratar o símbolo como garantia de destino.'],
  ['source-paper', 'Uma turma compara papel feito com fibra vegetal e papel produzido com fibras reaproveitadas. Qual pergunta ajuda a discutir a origem?', 'De que matéria-prima veio cada papel e quais transformações ocorreram?', ['Qual papel tem a letra mais bonita?', 'Qual papel ocupa mais espaço na mochila?', 'Qual papel faz mais barulho ao ser dobrado?'], 'Origem inclui matéria-prima e transformação.', 'Reduzir origem à aparência do produto final.'],
  ['durability-use', 'Para proteger um livro durante muitas aulas, uma capa resistente pode ser mais adequada que uma folha fina. O que a decisão considera?', 'A durabilidade esperada e a função que o objeto precisa cumprir.', ['Apenas o peso da capa.', 'Apenas o preço, sem considerar o uso.', 'A cor mais brilhante, independentemente da função.'], 'Observe o que o objeto precisa fazer ao longo do tempo.', 'Escolher sem relacionar propriedades e finalidade.'],
  ['waste-reduction', 'Em uma atividade, cada grupo recebe copos descartáveis novos, embora um conjunto de copos laváveis esteja disponível. Qual mudança reduz resíduos?', 'Usar os copos laváveis quando a segurança e a orientação da escola permitirem.', ['Distribuir dois copos descartáveis por pessoa.', 'Descartar os copos laváveis sem uso.', 'Usar copos novos apenas para que tenham a mesma cor.'], 'Redução começa evitando o descartável quando há alternativa segura.', 'Confundir uniformidade visual com redução de resíduos.'],
  ['material-change', 'Uma lata vazia foi amassada para ocupar menos espaço, mas continua sendo uma lata de metal. O que mudou?', 'A forma e o volume ocupado mudaram, mas o material continua sendo metal.', ['O metal virou papel.', 'A lata deixou de ter qualquer origem.', 'A lata passou a ser biodegradável.'], 'Diferencie mudança de forma de mudança de material.', 'Concluir que toda transformação muda a composição.'],
  ['local-guidance', 'Duas cidades podem ter regras diferentes para a coleta de embalagens. O que uma turma deve fazer?', 'Consultar a orientação do serviço local antes de decidir o destino.', ['Usar sempre a regra de outra cidade.', 'Escolher o destino por sorteio.', 'Misturar todos os resíduos para simplificar.'], 'O destino depende das condições da coleta disponível.', 'Generalizar uma regra sem verificar o contexto.'],
  ['repair-choice', 'A alça de uma mochila soltou, mas o tecido principal está íntegro. Qual opção pode evitar descarte desnecessário?', 'Avaliar o reparo da alça antes de substituir a mochila inteira.', ['Descartar a mochila sem verificar o defeito.', 'Comprar outra mochila e jogar a antiga fora automaticamente.', 'Cortar o tecido restante para não consertar.'], 'Pergunte se o problema é localizado e reparável.', 'Confundir defeito localizado com perda total do objeto.'],
  ['evidence-table', 'Uma tabela registra que a turma A reutilizou 12 folhas e a turma B reutilizou 7. Qual conclusão é apoiada pelos dados?', 'No período registrado, a turma A reutilizou 5 folhas a mais que a turma B.', ['A turma A nunca desperdiça papel.', 'A turma B não sabe usar papel.', 'Reutilizar papel sempre resolve todo problema ambiental.'], 'Use os valores e limite a conclusão ao período registrado.', 'Generalizar um dado pontual.'],
  ['material-and-access', 'Uma atividade precisa de um recipiente fácil de segurar. Além do material, o que deve ser considerado?', 'O tamanho, o peso, a segurança e as necessidades das pessoas que o utilizarão.', ['A marca do recipiente apenas.', 'A aparência sem considerar o uso.', 'Uma única forma obrigatória para todos.'], 'Uma escolha responsável considera uso e acessibilidade.', 'Ignorar segurança e diferentes necessidades de uso.'],
];
practice.forEach(([contextFamily, statement, correctAnswer, distractors, hint, errorFocus], index) => addQuestion({ id: `v8-sci-materials-practice-${String(index + 1).padStart(2, '0')}`, purpose: 'PRACTICE', difficulty: index < 6 ? 'EASY' : 'MEDIUM', cognitiveProcess: index < 6 ? 'COMPARE' : 'APPLY', contextFamily, statement, correctAnswer, distractors, explanation: 'A resposta conecta a propriedade, a origem ou o destino do material ao contexto apresentado e evita conclusões além dos dados.', hint, errorFocus }));

const transfer = [
  ['school-event', 'Em um evento escolar, há copos descartáveis, copos duráveis e um bebedouro. Qual plano é mais coerente com uso consciente?', 'Priorizar o bebedouro e os copos duráveis, com lavagem e organização adequadas.', ['Distribuir descartáveis mesmo quando os duráveis estão disponíveis.', 'Proibir água para evitar qualquer resíduo.', 'Escolher o plano apenas pela decoração dos copos.'], 'Combine redução, reutilização e condições de segurança.', 'Aplicar uma regra de redução sem considerar higiene e viabilidade.'],
  ['packaging-comparison', 'Duas embalagens protegem o mesmo produto: uma usa muito material e outra usa apenas o necessário. Qual análise é mais completa?', 'Comparar proteção, quantidade de material, possibilidade de reutilização e destino após o uso.', ['Escolher sempre a embalagem maior.', 'Considerar somente a cor da embalagem.', 'Concluir que toda embalagem leve é melhor em qualquer situação.'], 'Uma decisão precisa de mais de uma evidência.', 'Usar um único critério para um problema complexo.'],
  ['community-map', 'Uma turma mapeou pontos de coleta e percebeu que alguns ficam longe de parte das famílias. O que a análise deve considerar?', 'A distância e o acesso das pessoas, além do tipo de material aceito em cada ponto.', ['Somente o ponto mais bonito no mapa.', 'A quantidade de pontos sem verificar o que recebem.', 'A distância apenas para quem mora perto da escola.'], 'Dados de acesso mudam a avaliação da alternativa.', 'Confundir existência de coleta com acesso igual para todos.'],
  ['water-container', 'Durante uma excursão, a turma pode levar garrafas reutilizáveis ou comprar várias garrafas descartáveis. Qual justificativa é mais responsável?', 'Levar garrafas reutilizáveis, desde que haja água segura e organização para higienizá-las.', ['Escolher reutilizáveis sem verificar água e higiene.', 'Comprar descartáveis apenas porque são iguais.', 'Ficar sem água para não produzir resíduo.'], 'Consumo consciente deve preservar a saúde.', 'Ignorar condições de segurança ao propor reutilização.'],
  ['repair-workshop', 'Uma oficina escolar quer reduzir descarte de objetos. Qual atividade gera evidência para avaliar a proposta?', 'Registrar quantos objetos foram reparados, quais peças foram usadas e por quanto tempo continuaram em uso.', ['Contar apenas quantos cartazes foram feitos.', 'Afirmar que o reparo sempre funciona sem acompanhar o uso.', 'Descartar os objetos antes de examiná-los.'], 'Defina o que será observado antes de concluir.', 'Trocar evidência de resultado por intenção.'],
  ['advertising-claim', 'Um anúncio diz que uma embalagem é “100% sustentável”, sem explicar material, origem ou destino. Como ler essa afirmação?', 'Solicitar dados sobre o que a frase significa e quais etapas foram consideradas.', ['Aceitar a frase como prova completa.', 'Rejeitar qualquer embalagem sem investigar.', 'Concluir que uma palavra resolve toda a análise.'], 'Pergunte qual evidência sustenta a afirmação.', 'Tratar linguagem promocional como dado suficiente.'],
  ['home-routine', 'Em casa, uma família quer diminuir o desperdício de alimentos e embalagens. Qual primeira ação produz informação útil?', 'Observar e registrar por alguns dias quais resíduos aparecem e em que situações.', ['Comprar produtos diferentes sem observar o que acontece.', 'Descartar tudo sem separar para não contar.', 'Escolher uma solução sem conhecer o problema.'], 'Antes de agir, conheça o padrão do próprio contexto.', 'Pular da intenção para a solução sem observar.'],
  ['design-alternative', 'Uma equipe precisa criar um porta-lápis com material disponível. Qual proposta permite comparar alternativas?', 'Definir critérios de estabilidade, segurança, durabilidade e quantidade de material para testar protótipos.', ['Escolher o protótipo mais colorido sem testar.', 'Usar o máximo de material para garantir resultado.', 'Avaliar somente quem terminou primeiro.'], 'Critérios tornam a comparação justificável.', 'Confundir preferência com evidência de desempenho.'],
];
transfer.forEach(([contextFamily, statement, correctAnswer, distractors, hint, errorFocus], index) => addQuestion({ id: `v8-sci-materials-transfer-${String(index + 1).padStart(2, '0')}`, purpose: 'TRANSFER', difficulty: index < 3 ? 'MEDIUM' : 'HARD', cognitiveProcess: ['PLAN', 'EVALUATE', 'INTERPRET', 'JUSTIFY'][index % 4], contextFamily, statement, correctAnswer, distractors, explanation: 'A resposta usa critérios verificáveis, considera o contexto e evita prometer mais do que os dados permitem.', hint, errorFocus }));

const lockIn = [
  ['decision-justify', 'Uma estudante escolheu reutilizar uma caixa para organizar materiais. Qual justificativa mostra raciocínio completo?', 'A caixa ainda está em boas condições, atende à função e seu uso evita comprar outro organizador agora.', ['A caixa foi escolhida só porque é azul.', 'Qualquer caixa serve para qualquer função.', 'Reutilizar significa que não é preciso cuidar do objeto.'], 'Ligue condição, função e redução de consumo.', 'Justificar uma decisão com preferência isolada.'],
  ['source-destination', 'Qual sequência representa melhor o caminho de um objeto de papel?', 'Matéria-prima transformada em papel, uso do objeto e encaminhamento conforme a coleta disponível.', ['Objeto pronto retirado diretamente de uma árvore e descartado sem uso.', 'Uso, matéria-prima, fabricação e depois nenhum destino.', 'Cor do objeto, tamanho, preço e origem desconhecida.'], 'Organize origem, transformação, uso e destino.', 'Misturar etapas ou inventar um destino.'],
  ['data-limit', 'Uma escola reduziu o uso de copos descartáveis em uma semana. Qual afirmação é mais cuidadosa?', 'A escola usou menos copos no período observado; é preciso acompanhar outros períodos para avaliar a mudança.', ['A escola resolveu todo problema de resíduos.', 'A mudança funcionará sempre em qualquer lugar.', 'A redução não tem relação com nenhuma decisão.'], 'Inclua período e limite na conclusão.', 'Transformar um resultado local em regra universal.'],
  ['safe-reuse', 'Antes de reutilizar um pote encontrado na escola para guardar materiais, o que é necessário?', 'Verificar limpeza, integridade, tamanho, finalidade e orientação de segurança.', ['Usar o pote sem olhar seu estado.', 'Escolher apenas o pote com etiqueta mais bonita.', 'Usar qualquer recipiente para guardar alimentos também.'], 'Reutilização exige adequação ao uso.', 'Ignorar segurança e finalidade.'],
  ['compare-alternatives', 'Para comparar duas formas de reduzir papel em uma turma, qual registro ajuda mais?', 'Quantidade de folhas usadas, atividade realizada e período em cada alternativa.', ['Opinião de uma pessoa sem contexto.', 'Apenas a cor dos cadernos.', 'O número de estudantes sem contar folhas.'], 'Registre medida, contexto e período.', 'Escolher evidência que não mede a decisão.'],
  ['responsible-language', 'Qual frase comunica uma conclusão sem exagero?', 'Neste teste, o papel reaproveitado foi suficiente para os rascunhos da turma.', ['Papel reaproveitado é sempre melhor em qualquer uso.', 'Uma atividade prova que todo papel deve ser igual.', 'O resultado não permite aprender nada.'], 'Use o alcance exato do teste.', 'Usar absolutos ou descartar todos os dados.'],
];
lockIn.forEach(([contextFamily, statement, correctAnswer, distractors, hint, errorFocus], index) => addQuestion({ id: `v8-sci-materials-lock-${String(index + 1).padStart(2, '0')}`, purpose: 'LOCK_IN', difficulty: index < 3 ? 'MEDIUM' : 'HARD', cognitiveProcess: 'JUSTIFY', contextFamily, statement, correctAnswer, explanation: 'A resposta mantém a relação entre evidência, função, segurança e alcance da conclusão.', distractors, hint, errorFocus }));

const review = [
  ['review-observe', 'Qual frase é uma observação sobre uma embalagem?', 'A embalagem tem duas partes de plástico e uma tampa.', ['A embalagem foi produzida sem impacto.', 'A embalagem será reciclada com certeza.', 'A embalagem é a melhor de todas.']],
  ['review-origin', 'O que significa investigar a origem de um material?', 'Descobrir quais matérias-primas e transformações participaram de sua produção.', ['Saber apenas sua cor.', 'Descobrir quem segurou o objeto por último.', 'Medir somente seu tamanho.']],
  ['review-function', 'Por que a função do objeto importa ao escolher um material?', 'Porque o material precisa apresentar propriedades adequadas ao uso previsto.', ['Porque a função define a cor.', 'Porque todo material serve igualmente para qualquer uso.', 'Porque o objeto não pode ser reutilizado.']],
  ['review-reuse', 'Reutilizar um objeto significa:', 'Usá-lo novamente para a mesma ou outra finalidade adequada, prolongando seu uso.', ['Transformá-lo sempre em outro material.', 'Descartá-lo assim que for usado uma vez.', 'Garantir que ele nunca precise de limpeza.']],
  ['review-recycle', 'O que deve ser verificado antes de encaminhar um resíduo para coleta?', 'A regra local, o material e as condições exigidas para recebimento.', ['Somente o formato do resíduo.', 'Somente o símbolo da embalagem.', 'A opinião de quem estiver mais perto.']],
  ['review-conscious', 'Uma atitude de consumo consciente procura:', 'Atender à necessidade usando recursos com cuidado e evitando desperdício.', ['Comprar sempre a maior quantidade.', 'Escolher sempre o item mais colorido.', 'Descartar objetos que ainda podem ser usados.']],
  ['review-evidence', 'Uma tabela mostra o consumo de papel em dois dias. O que ela permite fazer?', 'Comparar os valores registrados nos dois dias dentro do período observado.', ['Provar como toda escola consumirá papel.', 'Descobrir a origem de cada folha sem dados adicionais.', 'Afirmar a causa sem investigar o contexto.']],
  ['review-access', 'Uma alternativa de descarte só pode ser usada por parte das famílias. O que isso indica?', 'A análise deve considerar acesso e condições reais, não apenas a existência da alternativa.', ['Que a alternativa funciona igualmente para todos.', 'Que distância não importa.', 'Que qualquer regra local serve em todo lugar.']],
  ['review-safety', 'Qual é uma regra importante ao reutilizar recipientes?', 'Adequar o recipiente à finalidade e verificar limpeza, integridade e segurança.', ['Usar qualquer recipiente para qualquer conteúdo.', 'Ignorar rachaduras se a cor for bonita.', 'Compartilhar recipientes sem higienização.']],
  ['review-limit', 'Por que uma conclusão deve informar o período e o contexto?', 'Para que outras pessoas saibam até onde os dados podem ser aplicados.', ['Para deixar a frase mais longa.', 'Para transformar uma observação em regra universal.', 'Para evitar comparar qualquer dado.']],
];
review.forEach(([contextFamily, statement, correctAnswer, distractors], index) => addQuestion({ id: `v8-sci-materials-review-${String(index + 1).padStart(2, '0')}`, purpose: 'REVIEW', difficulty: index < 5 ? 'EASY' : 'MEDIUM', cognitiveProcess: 'RECALL_AND_APPLY', contextFamily, statement, correctAnswer, distractors, explanation: 'A resposta retoma o princípio de observar, comparar e decidir considerando origem, uso, destino, segurança e limites.', hint: 'Volte à ideia principal da pergunta e evite generalizações.', errorFocus: 'Misturar origem, função, destino e conclusão sem considerar o contexto.' }));

const purposeCounts = Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
const answerPositionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((letter, index) => [letter, questions.filter((question) => question.options.indexOf(question.correctAnswer) === index).length]));
const questionIds = questions.map((question) => question.id);

const pack = {
  packVersion: 'tec-escola-core-v5-question-first',
  contentVersion: 8,
  contentId: 'v8-science-materials-conscious-use-fi',
  canonicalSkillCode: 'SCIENCE_MATERIALS_CONSCIOUS_USE_FI',
  subject: 'SCIENCE',
  domain: 'MATERIAIS_E_CONSUMO_CONSCIENTE',
  topic: 'materiais presentes em objetos cotidianos, origem, descarte e uso consciente',
  databasePackId: 'TECESCOLA_CORE_V5_QUESTION_FIRST',
  officialMappingStatus: 'NOT_CLAIMED',
  pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  publicationStatus: 'STAGING_INACTIVE',
  contentAuthoringStatus: 'AUTHORED',
  expectedPurposeCounts: purposeCounts,
  expectedQuestionCount: questions.length,
  expectedContextCount: new Set(questions.map((question) => question.contextFamily)).size,
  expectedAnswerPositionCounts: answerPositionCounts,
  sourceContext: {
    officialCode: 'EF01CI01',
    relation: 'AUTHORING_CONTEXT_ONLY',
    mappingStatus: 'CANONICAL_GAP',
    sourceStatus: 'OFFICIAL_SOURCE_CONTEXT_RECORDED_SOURCE_TEXT_REVIEW_REQUIRED',
    descriptor: 'Comparar características de diferentes materiais presentes em objetos de uso cotidiano, discutindo sua origem, os modos como são descartados e como podem ser usados de forma mais consciente.',
    officialSource: {
      id: 'BNCC_EI_EF_2018',
      documentVersion: 'BNCC Educação Infantil e Ensino Fundamental, versão final 2018',
      url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
      page: 335,
    },
    note: 'O descritor é usado como contexto de autoria; o vínculo canônico e a revisão do texto-fonte permanecem pendentes.',
  },
  lesson: {
    title: 'Materiais no cotidiano: origem, uso e destino',
    objective: 'Comparar materiais presentes em objetos cotidianos, relacionar propriedades ao uso, investigar origem e discutir escolhas de descarte e consumo consciente sem generalizações.',
    summary: 'Um objeto pode cumprir uma função com materiais diferentes. Para comparar escolhas, observe propriedades, origem, transformação, duração, possibilidade de reparo ou reutilização e destino disponível. Uma decisão consciente precisa considerar segurança, acesso e evidências do contexto.',
    progressiveExplanation: [
      'Comece pelo objeto e pelo uso: descreva o que é possível observar e qual função ele cumpre. Não confunda a aparência do objeto com a origem de seu material.',
      'Compare propriedades relevantes, como resistência, flexibilidade, absorção e durabilidade. A propriedade só faz sentido quando relacionada ao uso previsto e às condições de segurança.',
      'Investigue a origem: uma matéria-prima pode ser vegetal, mineral ou sintética e passar por transformações antes de formar o objeto. O produto pronto não aparece diretamente na natureza.',
      'Depois do uso, analise redução, reutilização, reparo, reciclagem e descarte conforme as regras locais. Símbolos e promessas não substituem a verificação do material e da coleta disponível.',
      'Conclua com limites: registre o que foi observado, em qual período e em qual contexto. Uma alternativa que funciona para uma turma pode exigir adaptações para outras pessoas e lugares.',
    ],
    workedExample: 'Uma turma compara uma caixa de papelão e um pote plástico para guardar lápis. Primeiro, observa que ambos podem conter os lápis, mas têm formas, rigidez e resistência à água diferentes. Depois, investiga que o papelão está ligado a matéria-prima vegetal transformada, enquanto o pote é feito de material sintético. A turma verifica o estado dos objetos, decide reutilizar os dois em situações adequadas e consulta a orientação local para o destino futuro. A conclusão é limitada: naquele contexto, reutilizar objetos em boas condições evitou uma compra e um descarte imediatos; isso não prova que um material seja sempre melhor para qualquer função.',
    commonErrors: [
      'Confundir matéria-prima com objeto pronto.',
      'Escolher um material por cor, marca ou aparência sem relacionar propriedade e função.',
      'Tratar o símbolo de reciclagem como garantia de coleta e reciclagem.',
      'Afirmar uma regra geral com base em uma observação local e curta.',
      'Propor reutilização sem verificar limpeza, integridade, segurança e acesso.',
    ],
    remediations: [
      { id: 'MATERIAL_ORIGIN', trigger: 'Confunde origem e objeto pronto', explanation: 'Separe matéria-prima, transformação, objeto e uso em quatro etapas.', workedExample: 'Árvore pode fornecer matéria-prima vegetal; depois de transformada, ela pode compor papelão; o papelão forma uma caixa que é usada e depois encaminhada conforme a coleta.', selfCheck: 'Consigo indicar a matéria-prima sem dizer que o objeto pronto foi retirado diretamente dela?' },
      { id: 'FUNCTION_PROPERTY', trigger: 'Escolhe sem relacionar propriedade e função', explanation: 'Nomeie a função e escolha uma propriedade necessária para cumpri-la.', workedExample: 'Para proteger um livro da chuva, a resistência à água é mais relevante que a cor da capa.', selfCheck: 'Minha justificativa explica qual propriedade ajuda no uso?' },
      { id: 'DESTINATION_CONTEXT', trigger: 'Generaliza o destino do resíduo', explanation: 'Verifique a regra local, a condição do material e o período da coleta.', workedExample: 'Uma embalagem pode ter símbolo de reciclagem, mas a turma ainda precisa saber se a coleta local recebe aquele material e se exige limpeza.', selfCheck: 'Indiquei a cidade ou serviço, o material e a condição necessários?' },
    ],
    everydayApplication: 'Observar embalagens, recipientes e materiais usados na escola ou em casa; decidir quando reduzir, reutilizar, reparar ou encaminhar um resíduo, sempre considerando segurança e regras locais.',
    practiceGuidance: 'Em cada atividade, peça primeiro uma descrição observável, depois uma comparação com critério, uma decisão e uma conclusão limitada ao contexto. Não peça coleta de dados pessoais nem ações com resíduos perigosos.',
    priorKnowledge: ['Reconhecer objetos de uso cotidiano e descrever características visíveis.', 'Comparar quantidades ou propriedades simples.', 'Seguir orientações de segurança e separação de materiais na escola.'],
    keyConcepts: ['material', 'matéria-prima', 'propriedade', 'função', 'transformação', 'reutilização', 'reciclagem', 'descarte', 'consumo consciente', 'evidência e limite'],
    progression: [
      { stage: 'FOUNDATION', focus: 'Observar objetos e distinguir material, função e origem.', questionIds: questionIds.slice(0, 8) },
      { stage: 'APPLICATION', focus: 'Comparar propriedades e decidir sobre redução, reparo e reutilização.', questionIds: questionIds.slice(8, 20) },
      { stage: 'TRANSFER', focus: 'Avaliar alternativas de consumo e descarte em contextos diferentes.', questionIds: questionIds.slice(20, 28) },
      { stage: 'INTEGRATION', focus: 'Justificar decisões com segurança, acesso e limites dos dados.', questionIds: questionIds.slice(28, 34) },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Retomar origem, uso, destino e consumo consciente.', questionIds: questionIds.slice(34) },
    ],
    microExplanations: [
      { trigger: 'OBSERVE_BEFORE_EXPLAINING', text: 'Descreva primeiro o que está presente; só depois explique origem ou causa.' },
      { trigger: 'PROPERTY_AND_FUNCTION', text: 'A melhor propriedade depende do que o objeto precisa fazer.' },
      { trigger: 'LOCAL_DESTINATION', text: 'O destino depende do material, da condição do resíduo e da coleta disponível.' },
      { trigger: 'CONTEXT_LIMIT', text: 'Uma conclusão deve dizer onde, quando e com quais objetos foi observada.' },
    ],
    reviewWindowsDays: [1, 3, 7],
    reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
    estimatedMinutes: 35,
    sourceDossier: [{
      title: 'Base Nacional Comum Curricular: Educação Infantil e Ensino Fundamental, Ciências da Natureza',
      publisher: 'Ministério da Educação',
      url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
      page: 335,
      supports: ['Contexto oficial registrado para comparar materiais, origem, descarte e uso consciente.'],
      use: 'Contexto de autoria; não representa aprovação de mapeamento canônico nem revisão pedagógica humana.',
    }],
    copyrightNote: 'Questões, exemplos e atividades são autorais. A fonte oficial orienta o contexto; a revisão do texto-fonte, o mapeamento canônico e a aprovação pedagógica permanecem pendentes.',
  },
  questions,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(pack, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), questionCount: questions.length, purposeCounts, contextCount: pack.expectedContextCount }, null, 2));
