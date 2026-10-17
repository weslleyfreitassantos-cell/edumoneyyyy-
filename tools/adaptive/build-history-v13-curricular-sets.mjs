import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const purposeAt = (index) => index < 5 ? 'PROBE' : index < 20 ? 'PRACTICE' : index < 32 ? 'TRANSFER' : index < 40 ? 'LOCK_IN' : 'REVIEW';
const processFor = {
  PROBE: ['IDENTIFY', 'DISTINGUISH', 'LOCATE'],
  PRACTICE: ['COMPARE', 'INTERPRET', 'ANALYZE'],
  TRANSFER: ['SYNTHESIZE', 'EVALUATE', 'APPLY'],
  LOCK_IN: ['EVALUATE', 'REVISE_CLAIM'],
  REVIEW: ['SYNTHESIZE', 'EVALUATE', 'TRANSFER'],
};

const withAnswerAt = (correct, distractors, index) => {
  const options = [...distractors];
  options.splice(index % 4, 0, correct);
  return options;
};

const common = {
  stage: 'ENSINO_FUNDAMENTAL',
  gradeOrRange: '03',
  componentCode: 'HI',
  sourcePage: 413,
  sourceUrl: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
};

const sets = [
  {
    officialCode: 'EF03HI02',
    contentId: 'v13-history-time-sources',
    title: 'Fontes e acontecimentos da história local',
    topic: 'fontes_historicas_e_registros_locais',
    canonicalSkillCode: 'AUTHORING_EF03HI02_HISTORY_SOURCES',
    proposalId: 'V8_PROPOSAL_ENSINO_FUNDAMENTAL_03_HI_SELECIONAR_HISTORY_TIME_SOURCES',
    descriptor: 'Selecionar, por meio da consulta de fontes de diferentes naturezas, e registrar acontecimentos ocorridos ao longo do tempo na cidade ou região em que vive.',
    objective: 'Selecionar fontes de diferentes naturezas e registrar acontecimentos da cidade ou região, indicando tempo, lugar, procedência e limites da evidência.',
    summary: 'A história local pode ser investigada com fotografias, mapas, relatos, objetos, jornais e outros registros. Cada fonte mostra um aspecto e precisa ser identificada antes de sustentar uma conclusão.',
    concepts: ['fonte histórica', 'procedência', 'data', 'registro', 'linha do tempo', 'evidência', 'limite da fonte'],
    priorKnowledge: ['Reconhecer antes e depois em uma sequência.', 'Localizar informação explícita em uma fonte curta.'],
    commonMistake: 'Tratar qualquer fonte como prova completa, esquecer sua data ou registrar uma hipótese como se fosse um acontecimento confirmado.',
    items: [
      { label: 'nature', context: 'Uma fotografia mostra a inauguração de uma ponte, e uma legenda informa o ano e o local.', question: 'Por que essa fotografia pode ser escolhida para investigar a ponte?', correct: 'Porque registra visualmente um acontecimento situado por data e local, conforme a legenda.', criterion: 'A fonte é útil quando o tipo, a data, o local e a informação que ela registra estão claros.', transfer: 'Aplique o critério a uma fotografia de uma praça do bairro.', overclaim: 'dizer que a fotografia explica sozinha todas as razões da construção', evidence: 'imagem, legenda, data e local informados', nextStep: 'anotar o que aparece e o que precisa de outra fonte', distractors: ['Porque toda fotografia prova todos os detalhes do passado.', 'Porque uma imagem não precisa de data nem de local.', 'Porque a ponte só pode ser estudada por fotografias.'] },
      { label: 'oral', context: 'Uma moradora relata que o mercado mudou de lugar depois de uma enchente, mas não informa o ano.', question: 'Como usar esse relato no registro?', correct: 'Registrar a mudança e indicar que o ano ainda precisa ser conferido em outra fonte.', criterion: 'Relatos orais preservam experiências, mas devem ser situados no tempo e identificados quanto a quem relata.', transfer: 'Aplique o procedimento a uma entrevista sobre a escola do bairro.', overclaim: 'afirmar a data exata apenas porque o relato parece detalhado', evidence: 'identificação da pessoa, conteúdo do relato e ausência do ano', nextStep: 'procurar jornal, fotografia, ata ou outro registro datado', distractors: ['Descartar o relato porque apenas documentos escritos valem.', 'Inventar um ano aproximado e registrá-lo como fato.', 'Concluir que a enchente mudou todos os mercados da região.'] },
      { label: 'map', context: 'Um mapa antigo apresenta o traçado de uma rua, enquanto um mapa atual mostra a rua alargada.', question: 'Que acontecimento pode ser registrado com esses mapas?', correct: 'A mudança no traçado ou na largura da rua entre os períodos representados.', criterion: 'Mapas ajudam a registrar configurações espaciais em momentos distintos, desde que suas datas e legendas sejam consultadas.', transfer: 'Compare mapas de uma praça, rio ou estrada.', overclaim: 'concluir quem decidiu a obra sem uma fonte sobre a decisão', evidence: 'datas, escala, legenda e elementos que mudaram', nextStep: 'descrever a diferença espacial antes de propor causas', distractors: ['A intenção de todos os moradores que usavam a rua.', 'A história completa do bairro sem consultar outras fontes.', 'Que mapas de épocas diferentes sempre mostram o mesmo espaço.'] },
      { label: 'object', context: 'Uma escola guarda um sino com uma etiqueta que informa que ele veio da primeira sede do bairro.', question: 'Que cuidado é necessário antes de registrar essa informação?', correct: 'Conferir a procedência da etiqueta e buscar outros registros que situem o objeto no tempo.', criterion: 'Objetos são fontes quando sua procedência, uso e relação com o acontecimento podem ser investigados.', transfer: 'Aplique o cuidado a uma placa, ferramenta ou caderno antigo.', overclaim: 'tratar a etiqueta como prova suficiente de toda a história do objeto', evidence: 'objeto, etiqueta, responsável pelo acervo e fontes de confirmação', nextStep: 'registrar o que é observado e a origem que ainda precisa ser confirmada', distractors: ['Descartar o objeto porque ele não tem texto longo.', 'Presumir a data pela aparência sem consultar o acervo.', 'Dizer que o objeto representa a experiência de todos os moradores.'] },
      { label: 'newspaper', context: 'Um jornal local noticia a abertura de uma biblioteca e cita a data da cerimônia.', question: 'Que registro esse jornal permite elaborar?', correct: 'Um registro do acontecimento noticiado, com data e informações atribuídas ao jornal.', criterion: 'Notícias registram um acontecimento segundo seu recorte, autoria e finalidade; não são relatos neutros de tudo o que ocorreu.', transfer: 'Use o mesmo critério em uma notícia sobre uma escola ou serviço público.', overclaim: 'afirmar que o jornal ouviu todas as pessoas envolvidas', evidence: 'data, autoria, texto da notícia e fontes citadas', nextStep: 'separar o fato noticiado das opiniões ou informações não verificadas', distractors: ['Uma lista completa de quem participou da cerimônia.', 'A opinião de toda a comunidade sobre a biblioteca.', 'A prova de que nenhuma pessoa discordou do projeto.'] },
      { label: 'chronology', context: 'Uma lista apresenta quatro eventos: chegada do ônibus, abertura da praça, construção da escola e reforma do mercado, com anos diferentes.', question: 'Como transformar a lista em um registro histórico útil?', correct: 'Organizar os eventos em ordem de tempo e manter o ano e o local de cada registro.', criterion: 'Uma linha do tempo precisa preservar a ordem, as datas e a identificação do acontecimento.', transfer: 'Organize uma sequência de mudanças em outra rua.', overclaim: 'dizer que o evento mais antigo causou todos os posteriores', evidence: 'anos, acontecimentos e local indicado para cada item', nextStep: 'marcar lacunas de data e registrar cada evento separadamente', distractors: ['Misturar os eventos para mostrar que todos são iguais.', 'Ordenar pela importância imaginada, sem olhar os anos.', 'Apagar os acontecimentos que não têm uma fotografia.'] },
      { label: 'conflict', context: 'Uma ata marca a inauguração da praça em março, enquanto um depoimento menciona abril sem indicar a fonte da lembrança.', question: 'Como registrar a divergência?', correct: 'Apresentar as duas informações, identificar as fontes e indicar que a data precisa de conferência.', criterion: 'Fontes divergentes devem ser comparadas sem escolher uma apenas por parecer mais convincente.', transfer: 'Aplique o procedimento a datas diferentes para a fundação de uma associação.', overclaim: 'escolher a data mais repetida sem comparar a procedência', evidence: 'ata, depoimento, autoria, data de produção e contexto', nextStep: 'buscar uma terceira fonte ou explicar a divergência no registro', distractors: ['Apagar o depoimento automaticamente.', 'Somar março e abril como se fossem uma única data.', 'Dizer que não existe acontecimento porque as fontes divergem.'] },
      { label: 'limits', context: 'Uma fotografia mostra uma rua cheia durante uma festa, mas não informa por que a festa foi organizada.', question: 'O que a fotografia permite afirmar com segurança?', correct: 'Que a rua aparece ocupada no momento registrado, sem explicar sozinha a razão da festa.', criterion: 'O limite da fonte é parte do registro: observar o que aparece não autoriza inventar o que não foi documentado.', transfer: 'Aplique o limite a uma fotografia de uma feira escolar.', overclaim: 'atribuir a causa do evento apenas pela quantidade de pessoas', evidence: 'elementos visíveis, data disponível e informações ausentes', nextStep: 'procurar convite, notícia ou relato sobre a finalidade', distractors: ['Que todos os moradores participaram da festa.', 'Que a rua estava sempre cheia naquele período.', 'Que a festa foi criada pela pessoa que tirou a foto.'] },
      { label: 'access', context: 'A turma consulta uma entrevista em áudio, uma transcrição ampliada e uma fotografia com descrição escrita.', question: 'Por que oferecer formatos diferentes é importante?', correct: 'Porque amplia o acesso às mesmas evidências sem mudar o acontecimento investigado.', criterion: 'Acessibilidade deve permitir que estudantes consultem e comparem fontes por meios adequados.', transfer: 'Planeje formatos acessíveis para um mapa ou documento curto.', overclaim: 'dizer que mudar o formato muda o conteúdo histórico da fonte', evidence: 'áudio, transcrição, fotografia e descrição correspondentes', nextStep: 'conferir se a transcrição e a descrição preservam as informações essenciais', distractors: ['Porque apenas o áudio contém a informação verdadeira.', 'Porque a descrição deve inventar detalhes que não aparecem.', 'Porque fontes acessíveis não precisam de procedência.'] },
      { label: 'synthesis', context: 'Uma pesquisa reúne mapa, entrevista e jornal sobre a mudança de uma feira para outra praça.', question: 'Como escrever a síntese?', correct: 'Relacionar o deslocamento às fontes, indicar o que cada uma registra e deixar abertas as causas não documentadas.', criterion: 'Uma boa síntese atribui cada afirmação à fonte e diferencia acontecimento observado de interpretação.', transfer: 'Faça uma síntese sobre a mudança de uma escola ou posto de saúde.', overclaim: 'afirmar uma causa única sem fonte que a sustente', evidence: 'mapa, entrevista, jornal, datas e informações que não coincidem', nextStep: 'montar uma tabela de fonte, informação, período e limite', distractors: ['Escolher apenas o jornal e ignorar as demais fontes.', 'Transformar uma lembrança em data oficial sem conferência.', 'Dizer que todas as fontes têm exatamente a mesma função.'] },
    ],
  },
  {
    officialCode: 'EF03HI03',
    contentId: 'v13-history-local-perspectives',
    title: 'Pontos de vista na história local',
    topic: 'perspectivas_de_grupos_e_culturas_na_historia_local',
    canonicalSkillCode: 'AUTHORING_EF03HI03_HISTORY_PERSPECTIVES',
    proposalId: 'V8_PROPOSAL_ENSINO_FUNDAMENTAL_03_HI_COMPARAR_SOCIETY_CULTURE',
    descriptor: 'Identificar e comparar pontos de vista em relação a eventos significativos do local em que vive, aspectos relacionados a condições sociais e à presença de diferentes grupos sociais e culturais, com especial destaque para as culturas africanas, indígenas e de migrantes.',
    objective: 'Identificar e comparar pontos de vista sobre acontecimentos locais, relacionando cada perspectiva ao grupo, às condições sociais e à fonte que a sustenta.',
    summary: 'Um mesmo acontecimento pode ser narrado de modos diferentes. Comparar perspectivas exige reconhecer quem fala, o que foi vivido, quais condições estão em jogo e quais vozes ainda faltam.',
    concepts: ['ponto de vista', 'perspectiva', 'grupo social', 'grupo cultural', 'condição social', 'experiência', 'generalização'],
    priorKnowledge: ['Identificar autoria e tema em um relato.', 'Separar informação observável de opinião.'],
    commonMistake: 'Confundir ponto de vista com verdade absoluta, tratar um grupo como homogêneo ou apagar culturas africanas, indígenas e de migrantes da história local.',
    items: [
      { label: 'same-event', context: 'Uma associação de moradores chama a abertura de uma praça de conquista; uma comerciante relata que a obra dificultou as entregas.', question: 'Como comparar os relatos?', correct: 'Relacionar cada avaliação à experiência e à posição de quem fala, reconhecendo que tratam de efeitos diferentes do mesmo evento.', criterion: 'Pontos de vista são situados: a comparação observa foco, experiência e evidência antes de julgar.', transfer: 'Compare opiniões sobre a reforma de uma rua.', overclaim: 'dizer que um relato invalida automaticamente o outro', evidence: 'autoridade de fala, finalidade da obra, efeitos descritos e período', nextStep: 'listar convergências, diferenças e informações ausentes', distractors: ['Escolher o relato mais positivo como verdadeiro para todos.', 'Concluir que pessoas diferentes não podem falar do mesmo evento.', 'Somar as opiniões como se formassem uma única voz.'] },
      { label: 'fact-opinion', context: 'Um texto registra que a escola foi construída em 1985 e afirma que ela é o melhor prédio do bairro.', question: 'Que diferença deve ser identificada?', correct: 'O ano da construção é uma informação verificável no registro; “melhor” expressa uma avaliação situada.', criterion: 'Comparar perspectivas exige diferenciar dados, interpretações e avaliações.', transfer: 'Aplique a distinção a um relato sobre um parque.', overclaim: 'tratar toda avaliação como fato apenas porque aparece escrita', evidence: 'data, verbo ou adjetivo avaliativo e autoria do texto', nextStep: 'buscar outra fonte para comparar a avaliação e confirmar o ano', distractors: ['Dizer que nenhum trecho pode ser conferido.', 'Transformar “melhor” em uma medida objetiva sem critério.', 'Concluir que a pessoa não conhece a escola.'] },
      { label: 'migrant', context: 'Uma família migrante descreve a festa que organiza no bairro, enquanto um calendário municipal apresenta outras celebrações.', question: 'O que a comparação pode revelar?', correct: 'Que diferentes grupos participam da vida cultural do bairro e podem valorizar celebrações distintas.', criterion: 'A presença de uma prática cultural deve ser reconhecida sem transformar uma família em representante de todos os migrantes.', transfer: 'Compare práticas de diferentes famílias sem coletar dados pessoais desnecessários.', overclaim: 'generalizar a prática da família para todas as pessoas migrantes', evidence: 'quem produziu o relato, prática descrita e alcance do calendário', nextStep: 'registrar semelhanças e diferenças com linguagem respeitosa', distractors: ['Que apenas a celebração do calendário é cultural.', 'Que famílias migrantes têm todas as mesmas práticas.', 'Que duas celebrações diferentes não podem coexistir.'] },
      { label: 'indigenous', context: 'Um texto escolar apresenta um nome indígena do rio, e uma entrevista de uma liderança explica seu significado para a comunidade.', question: 'Como tratar as fontes?', correct: 'Relacionar o nome ao contexto e à explicação da liderança, reconhecendo a voz indígena como parte da história do lugar.', criterion: 'A comparação deve preservar a autoria e o significado cultural, evitando substituir a explicação da comunidade por uma generalização externa.', transfer: 'Aplique o cuidado a um topônimo ou prática cultural de outra comunidade.', overclaim: 'usar uma fala isolada para descrever todos os povos indígenas', evidence: 'nome do rio, autoria, contexto da entrevista e significado explicado', nextStep: 'comparar o registro escolar com a fonte da comunidade', distractors: ['Ignorar a entrevista porque ela não é um documento oficial.', 'Dizer que o nome tem apenas valor turístico.', 'Escolher uma tradução sem consultar o contexto cultural.'] },
      { label: 'african', context: 'Um museu local apresenta uma exposição sobre a contribuição de pessoas negras para o trabalho e a cultura do município.', question: 'Que comparação é adequada?', correct: 'Comparar o recorte do museu com outras fontes, mantendo visíveis as contribuições e as condições históricas mencionadas.', criterion: 'A história local deve incluir contribuições afro-brasileiras sem reduzir pessoas negras a um único papel ou período.', transfer: 'Investigue outra contribuição cultural sem usar estereótipos.', overclaim: 'resumir toda a experiência negra do município à exposição', evidence: 'objetos, legendas, autoria, período e grupos representados', nextStep: 'identificar o que a exposição mostra e quais vozes exigem outras fontes', distractors: ['Excluir a exposição porque ela trata de um grupo específico.', 'Dizer que uma contribuição cultural prova igualdade em todas as épocas.', 'Tratar a exposição como descrição completa da cidade.'] },
      { label: 'conditions', context: 'Moradores de uma região sem transporte regular relatam dificuldades diferentes das de moradores próximos ao centro.', question: 'O que a comparação deve considerar?', correct: 'As condições sociais e espaciais que influenciam as experiências de cada grupo.', criterion: 'Pontos de vista não se explicam apenas por opinião individual; condições de acesso, trabalho e moradia também importam.', transfer: 'Compare experiências de acesso a uma biblioteca ou posto de saúde.', overclaim: 'culpar o grupo por uma dificuldade produzida por condições desiguais', evidence: 'localização, transporte, horários e relatos de cada grupo', nextStep: 'relacionar a opinião ao contexto material sem apagar diferenças internas', distractors: ['Dizer que todos têm as mesmas condições porque moram no mesmo município.', 'Tratar a dificuldade como escolha pessoal sem fonte.', 'Concluir que uma região não faz parte da história local.'] },
      { label: 'missing', context: 'Duas reportagens citam autoridades sobre a construção de um terminal, mas não apresentam passageiros nem trabalhadores.', question: 'Que limite deve ser apontado?', correct: 'As reportagens mostram a perspectiva das autoridades e deixam ausentes outras experiências que precisam ser investigadas.', criterion: 'Uma ausência no conjunto de fontes é uma lacuna, não prova de que o grupo ausente não participou.', transfer: 'Procure vozes ausentes em um relato sobre uma obra pública.', overclaim: 'afirmar que passageiros e trabalhadores concordaram com a obra', evidence: 'pessoas citadas, finalidade das reportagens e grupos não ouvidos', nextStep: 'buscar fontes éticas e públicas que ampliem o conjunto de perspectivas', distractors: ['Concluir que as autoridades representam todos.', 'Inventar depoimentos para preencher o silêncio.', 'Descartar as reportagens sem analisar o que elas registram.'] },
      { label: 'internal-diversity', context: 'Duas pessoas da mesma comunidade descrevem de forma diferente o uso de uma praça em dias de festa.', question: 'Como interpretar a diferença?', correct: 'Como experiências situadas dentro de um mesmo grupo, que podem ser comparadas sem presumir uma voz única.', criterion: 'Nenhum grupo é totalmente homogêneo; diferenças internas também são parte da análise histórica.', transfer: 'Aplique o cuidado a relatos de uma turma ou associação.', overclaim: 'dizer que uma pessoa representa toda a comunidade', evidence: 'identidade e posição de cada pessoa, situação observada e período', nextStep: 'registrar o que coincide e o que varia entre os relatos', distractors: ['Escolher o relato mais detalhado como voz oficial do grupo.', 'Concluir que o grupo não existe porque há divergência.', 'Apagar a diferença para produzir uma narrativa uniforme.'] },
      { label: 'respect', context: 'Uma entrevista usa uma palavra que a própria comunidade prefere para se identificar, enquanto um relatório antigo usa outro termo.', question: 'Que decisão melhora a comparação?', correct: 'Preservar a autodenominação da comunidade, contextualizar o termo antigo e evitar linguagem desrespeitosa.', criterion: 'Comparar fontes não significa repetir termos ofensivos sem explicação; a linguagem também comunica relações de poder.', transfer: 'Revise um texto escolar para respeitar nomes e formas de identificação.', overclaim: 'substituir a voz da comunidade por um rótulo externo sem contexto', evidence: 'termos usados, autoria, época e preferência de autodenominação', nextStep: 'consultar orientação da comunidade ou fonte confiável antes de publicar', distractors: ['Repetir sempre o termo mais antigo como se fosse neutro.', 'Apagar a entrevista para evitar a diferença.', 'Escolher o termo mais curto sem considerar significado.'] },
      { label: 'synthesis', context: 'Uma obra é celebrada por autoridades, questionada por comerciantes e avaliada por uma comunidade indígena afetada pelo local.', question: 'Como elaborar uma comparação responsável?', correct: 'Apresentar os três pontos de vista, relacioná-los às posições e condições de cada grupo e indicar as evidências usadas.', criterion: 'A síntese preserva diferenças, evita hierarquizar vozes automaticamente e não transforma opinião em fato universal.', transfer: 'Elabore uma comparação semelhante sobre uma mudança no bairro.', overclaim: 'escolher uma única perspectiva como a história completa', evidence: 'autoria, posição, efeitos, condições sociais e documentos de apoio', nextStep: 'escrever uma tabela de convergências, divergências e lacunas', distractors: ['Dizer que a autoridade sempre tem a única versão válida.', 'Apagar a perspectiva indígena por tratar de um local específico.', 'Concluir que conflito impede qualquer investigação histórica.'] },
    ],
  },
  {
    officialCode: 'EF03HI04',
    contentId: 'v13-history-local-heritage',
    title: 'Patrimônios históricos e culturais do lugar',
    topic: 'patrimonios_historicos_e_culturais_locais',
    canonicalSkillCode: 'AUTHORING_EF03HI04_HISTORY_HERITAGE',
    proposalId: 'V8_PROPOSAL_ENSINO_FUNDAMENTAL_03_HI_IDENTIFICAR_HISTORY_TIME_SOURCES',
    descriptor: 'Identificar os patrimônios históricos e culturais de sua cidade ou região e discutir as razões culturais, sociais e políticas para que assim sejam considerados.',
    objective: 'Identificar patrimônios históricos e culturais e discutir, com fontes e vozes da comunidade, razões culturais, sociais e políticas para seu reconhecimento.',
    summary: 'Patrimônio não é apenas um prédio antigo. É uma referência reconhecida por pessoas e grupos, material ou imaterial, cujo significado e preservação envolvem memória, cultura, escolhas políticas e participação.',
    concepts: ['patrimônio material', 'patrimônio imaterial', 'memória', 'reconhecimento', 'preservação', 'participação', 'política cultural'],
    priorKnowledge: ['Descrever elementos de um lugar.', 'Comparar usos do mesmo espaço em épocas diferentes.'],
    commonMistake: 'Considerar patrimônio apenas o que é antigo ou oficialmente tombado, ignorando práticas culturais, grupos responsáveis e disputas de significado.',
    items: [
      { label: 'material', context: 'Uma estação ferroviária antiga conserva a fachada e possui relatos sobre sua importância para o município.', question: 'Por que ela pode ser investigada como patrimônio?', correct: 'Porque reúne características materiais e memórias sobre sua importância histórica para grupos do município.', criterion: 'Reconhecer patrimônio exige relacionar o bem, sua história, os grupos que o valorizam e as evidências disponíveis.', transfer: 'Aplique o critério a um mercado ou ponte antiga.', overclaim: 'dizer que todo prédio antigo é patrimônio automaticamente', evidence: 'fachada, registros históricos, usos e memórias identificadas', nextStep: 'consultar fontes sobre significado e reconhecimento do lugar', distractors: ['Porque qualquer prédio antigo tem o mesmo valor.', 'Porque a idade elimina a necessidade de participação da comunidade.', 'Porque apenas a aparência define o patrimônio.'] },
      { label: 'intangible', context: 'Uma comunidade realiza todos os anos uma celebração com música, comida e histórias ensinadas entre gerações.', question: 'Que dimensão do patrimônio aparece?', correct: 'Uma prática cultural imaterial, mantida por pessoas que compartilham conhecimentos e significados.', criterion: 'Patrimônios culturais podem ser práticas, saberes, celebrações e formas de expressão, não apenas objetos.', transfer: 'Investigue uma prática cultural sem expor dados pessoais de participantes.', overclaim: 'reduzir a celebração a uma atração para visitantes', evidence: 'prática, transmissão de saberes, participantes e significado atribuído', nextStep: 'registrar quem reconhece a prática e como ela é cuidada', distractors: ['Um patrimônio material porque toda celebração precisa de um prédio.', 'Uma tradição sem relação com a história do lugar.', 'Uma atividade igual em todas as comunidades.'] },
      { label: 'reasons', context: 'Um monumento lembra uma luta por moradia, mas algumas pessoas discutem se sua placa conta a história de modo completo.', question: 'Que discussão o caso permite fazer?', correct: 'Discutir razões sociais e políticas do reconhecimento e quais memórias aparecem ou ficam ausentes.', criterion: 'Patrimônio envolve escolhas: é importante perguntar quem reconhece, que memória é preservada e como ela é apresentada.', transfer: 'Aplique perguntas semelhantes a uma praça com monumento.', overclaim: 'dizer que o monumento representa igualmente todas as experiências', evidence: 'monumento, placa, grupos envolvidos e memórias ausentes', nextStep: 'comparar a placa com fontes e vozes da comunidade', distractors: ['Concluir que toda placa é neutra.', 'Dizer que apenas a idade do monumento importa.', 'Apagar a discussão porque o monumento já existe.'] },
      { label: 'official', context: 'Uma prefeitura reconhece uma casa como patrimônio, enquanto moradores usam o quintal para uma prática comunitária não citada no documento.', question: 'Como analisar os reconhecimentos?', correct: 'Comparar o reconhecimento oficial com o uso comunitário e registrar que cada fonte destaca uma dimensão.', criterion: 'O reconhecimento oficial é uma fonte importante, mas não substitui as experiências e significados da comunidade.', transfer: 'Compare um inventário público com relatos sobre um espaço cultural.', overclaim: 'assumir que o documento oficial esgota o significado do lugar', evidence: 'decreto, inventário, prática comunitária e autoria dos relatos', nextStep: 'identificar convergências e lacunas entre as fontes', distractors: ['Descartar o uso comunitário porque não está no decreto.', 'Dizer que qualquer uso transforma automaticamente o local em patrimônio.', 'Tratar documentos oficiais e relatos como fontes idênticas.'] },
      { label: 'age', context: 'Uma ponte foi construída há poucos anos e se tornou referência para encontros e festas de um bairro.', question: 'O que o caso ensina sobre patrimônio?', correct: 'Que o significado cultural e social não depende apenas de grande antiguidade; é preciso investigar reconhecimento e usos.', criterion: 'Idade pode ser uma informação, mas não é o único critério para compreender patrimônio.', transfer: 'Aplique o raciocínio a um mural recente.', overclaim: 'dizer que algo recente nunca pode ter valor cultural', evidence: 'data, usos, grupos envolvidos e razões apresentadas', nextStep: 'registrar como a comunidade atribui significado ao lugar', distractors: ['Que toda construção recente já é patrimônio.', 'Que apenas especialistas podem atribuir valor.', 'Que festas não têm relação com história cultural.'] },
      { label: 'preserve', context: 'Uma biblioteca histórica precisa de reparos, mas a obra deve manter elementos que ajudam a reconhecer sua história.', question: 'Que decisão é coerente com a preservação?', correct: 'Planejar os reparos com participação e cuidado para manter elementos significativos, garantindo acesso e segurança.', criterion: 'Preservar não é congelar um lugar nem impedir seu uso; envolve escolhas, manutenção e participação.', transfer: 'Planeje cuidados para uma praça ou centro cultural.', overclaim: 'preservar significa proibir qualquer uso do espaço', evidence: 'elementos significativos, necessidades de segurança e usos da comunidade', nextStep: 'consultar especialistas e usuários sobre alternativas de cuidado', distractors: ['Remover tudo que é antigo para facilitar a obra.', 'Manter o prédio fechado indefinidamente.', 'Escolher a reforma mais barata sem avaliar a memória do lugar.'] },
      { label: 'access', context: 'Um centro cultural reconhecido como patrimônio tem escadas e não oferece descrição de suas exposições.', question: 'Que aspecto deve entrar na discussão?', correct: 'A preservação deve ser articulada à acessibilidade para que diferentes pessoas possam conhecer e participar do patrimônio.', criterion: 'Acesso cultural é parte da participação social e não deve ser tratado como detalhe posterior.', transfer: 'Proponha uma solução acessível para uma exposição local.', overclaim: 'dizer que acessibilidade ameaça a preservação automaticamente', evidence: 'barreira física, recursos de comunicação e formas de uso', nextStep: 'planejar recursos acessíveis sem alterar o significado das fontes', distractors: ['Impedir visitas para proteger o prédio.', 'Oferecer apenas uma fotografia e encerrar o acesso.', 'Dizer que patrimônio pertence somente a quem já consegue entrar.'] },
      { label: 'diversity', context: 'Um roteiro turístico destaca um edifício colonial, mas não menciona o trabalho de pessoas negras e indígenas ligado à história do local.', question: 'Que revisão é necessária?', correct: 'Ampliar as fontes e as vozes para discutir como diferentes grupos participaram e foram afetados pela história do edifício.', criterion: 'Reconhecer patrimônio requer examinar relações sociais e evitar narrativas que apaguem grupos fundamentais.', transfer: 'Revise outro roteiro local procurando ausências e fontes responsáveis.', overclaim: 'tratar o edifício como história de um único grupo', evidence: 'roteiro, registros de trabalho, memórias e fontes de grupos envolvidos', nextStep: 'incluir contextos e vozes documentadas com linguagem respeitosa', distractors: ['Excluir o edifício por ter uma história complexa.', 'Dizer que apenas a arquitetura importa.', 'Inventar uma versão para preencher qualquer ausência.'] },
      { label: 'conflict', context: 'Uma praça é valorizada por uma comunidade e também é usada para uma atividade que ameaça uma árvore protegida no local.', question: 'Como tratar a situação?', correct: 'Reconhecer os valores culturais e discutir alternativas de uso e cuidado com evidências e participação.', criterion: 'Conflitos de uso não anulam o patrimônio; exigem negociação, proteção e consideração das diferentes razões envolvidas.', transfer: 'Aplique o método a um campo, rio ou feira tradicional.', overclaim: 'escolher um grupo e ignorar todos os demais efeitos', evidence: 'uso cultural, risco à árvore, regras de proteção e propostas da comunidade', nextStep: 'comparar alternativas e seus impactos antes de decidir', distractors: ['Proibir toda atividade sem ouvir a comunidade.', 'Dizer que a árvore não faz parte da história do lugar.', 'Manter a atividade exatamente igual porque é tradicional.'] },
      { label: 'synthesis', context: 'Uma pesquisa reúne decreto, entrevistas, fotografias e registros de uma festa para estudar um antigo mercado e a prática cultural ao redor dele.', question: 'Que conclusão é mais adequada?', correct: 'O mercado e a festa podem ter dimensões patrimoniais diferentes, reconhecidas por fontes e grupos que devem ser identificados.', criterion: 'A conclusão deve discutir razões culturais, sociais e políticas sem reduzir o patrimônio a uma etiqueta.', transfer: 'Elabore uma ficha de patrimônio para outro lugar com fontes identificadas.', overclaim: 'declarar patrimônio oficial apenas com base em uma entrevista', evidence: 'decreto, entrevistas, fotografias, festa e procedência de cada registro', nextStep: 'separar reconhecimento oficial, significado comunitário e perguntas abertas', distractors: ['Dizer que só o decreto vale como história.', 'Concluir que uma prática é patrimônio para todas as cidades.', 'Escolher o mercado ou a festa sem explicar as razões.'] },
    ],
  },
];

function makeQuestion(set, item, caseIndex, variant) {
  const index = caseIndex * 5 + variant;
  const purpose = purposeAt(index);
  const variants = [
    [item.question, item.correct],
    ['Que critério deve orientar a análise?', `Considere ${item.criterion}`],
    ['Como transferir esse raciocínio?', item.transfer],
    ['Qual conclusão deve ser evitada?', `Evite ${item.overclaim}.`],
    ['Que evidência deve ser conferida primeiro?', `Confira ${item.evidence}.`],
  ];
  const [prompt, correct] = variants[variant];
  return {
    id: `${set.contentId}-${String(index + 1).padStart(3, '0')}`,
    purpose,
    difficulty: index < 5 ? 'EASY' : index < 30 ? 'MEDIUM' : 'HARD',
    cognitiveProcess: processFor[purpose][index % processFor[purpose].length],
    contextFamily: `${set.contentId.toUpperCase()}_${item.label.toUpperCase()}_${String(variant + 1).padStart(2, '0')}`,
    statement: `${item.context} ${prompt}`,
    options: withAnswerAt(correct, item.distractors, index),
    correctAnswer: correct,
    explanation: `A análise histórica deve respeitar o recorte da fonte e o ponto de vista envolvido. ${item.criterion}`,
    hint: 'Separe o que a fonte registra, quem fala, em que período e qual conclusão ainda depende de outra evidência.',
    errorFocus: `HISTORY_${set.officialCode}_EVIDENCE_SCOPE_AND_CONTEXT`,
    misconceptions: { [item.distractors[0]]: [`HISTORY_${set.officialCode}_EVIDENCE_SCOPE_AND_CONTEXT`] },
  };
}

function makeLesson(set, questions) {
  const byPurpose = new Map(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).map((question) => question.id)]));
  return {
    title: set.title,
    objective: set.objective,
    summary: set.summary,
    explanation: `## O que investigar\n${set.descriptor}\n\n## Como trabalhar\nComece identificando o acontecimento, o lugar, o período e quem produziu cada fonte. Depois compare as informações, reconheça perspectivas e registre apenas o que a evidência sustenta.\n\n## Como avançar\nUse observações simples no início, passe para comparações e termine com sínteses que indicam convergências, diferenças, lacunas e próximos passos. A ausência de uma informação deve permanecer visível; não invente detalhes para completar a narrativa.`,
    workedExample: 'Uma fonte registra a data de uma obra, outra descreve a experiência de um grupo e uma terceira mostra a transformação do espaço. O registro cuidadoso atribui cada informação à fonte, compara os recortes e evita afirmar uma causa ou uma opinião como se fossem fatos universais.',
    commonMistake: set.commonMistake,
    tips: ['Defina lugar, acontecimento e período antes de comparar.', 'Identifique autoria, tipo e procedência de cada fonte.', 'Separe observação, interpretação e avaliação.', 'Registre lacunas e procure fontes complementares responsáveis.', 'Respeite a autodenominação e a diversidade dos grupos envolvidos.'],
    estimatedMinutes: 35,
    priorKnowledge: set.priorKnowledge,
    keyConcepts: set.concepts,
    progression: [
      { stage: 'DIAGNOSTIC', focus: 'Reconhecer fontes, grupos e informações explícitas.', questionIds: byPurpose.get('PROBE') },
      { stage: 'PRACTICE', focus: 'Interpretar, comparar e delimitar evidências.', questionIds: byPurpose.get('PRACTICE') },
      { stage: 'TRANSFER', focus: 'Aplicar os critérios a novos casos locais.', questionIds: byPurpose.get('TRANSFER') },
      { stage: 'LOCK_IN', focus: 'Revisar conclusões excessivas e corrigir generalizações.', questionIds: byPurpose.get('LOCK_IN') },
      { stage: 'SPACED_REVIEW_CANDIDATE', focus: 'Retomar fontes, perspectivas e limites em sínteses.', questionIds: byPurpose.get('REVIEW') },
    ],
    microExplanations: [
      { trigger: 'SOURCE_SCOPE', text: 'Toda fonte mostra um recorte: identifique o que ela registra e o que ela não pode provar sozinha.' },
      { trigger: 'PERSPECTIVE', text: 'Pergunte quem fala, de qual posição e sobre qual experiência antes de transformar um relato em generalização.' },
      { trigger: 'LOCAL_CONTEXT', text: 'Ligue o acontecimento ao lugar e ao tempo, preservando as vozes e os significados dos grupos envolvidos.' },
    ],
    remediations: [
      { id: 'SOURCE_TABLE', misconception: 'Misturar fonte, fato e hipótese.', prompt: 'Preencha uma tabela com fonte, autor, data, informação sustentada e limite.' },
      { id: 'PERSPECTIVE_TABLE', misconception: 'Tratar um grupo como uma voz única.', prompt: 'Liste quem fala, quais experiências aparecem e quais vozes ainda precisam ser buscadas.' },
      { id: 'CLAIM_REVIEW', misconception: 'Escrever conclusão maior que a evidência.', prompt: 'Sublinhe cada afirmação e indique a fonte que a sustenta; reescreva as que não têm apoio.' },
    ],
    authenticActivities: [{
      id: `${set.contentId}-local-inquiry`,
      title: 'Investigação acessível da história local',
      objective: set.objective,
      context: 'Atividade mediada pelo docente com fontes públicas ou materiais didáticos identificados; não exige relatos familiares nem dados pessoais.',
      materials: ['Duas ou três fontes com data e procedência', 'Tabela ou linha do tempo acessível', 'Mapa, imagem ou áudio com descrição/transcrição'],
      instructions: 'Escolha um acontecimento do lugar, identifique as fontes, registre convergências e diferenças e escreva uma conclusão proporcional ao que foi documentado.',
      evidence: 'Registro com fonte, autoria, período, evidência, limite e uma pergunta ainda aberta.',
      safety: 'Usar linguagem respeitosa, não expor origem familiar e oferecer alternativas de participação e formato.',
      privacyGuard: 'Não coletar endereço, nacionalidade, origem familiar ou relatos pessoais identificáveis dos estudantes.',
      ageRange: '3º ano do Ensino Fundamental, com mediação e linguagem adequadas.',
      mediation: 'O docente confere procedência e acessibilidade, ajuda a diferenciar observação e hipótese e mantém a autoria em revisão.',
      rubric: [
        { criterion: 'Fontes', emerging: 'Não identifica a procedência.', developing: 'Identifica parte das fontes com apoio.', proficient: 'Registra tipo, autoria, período e procedência.' },
        { criterion: 'Comparação', emerging: 'Mistura informações de fontes diferentes.', developing: 'Compara alguns aspectos após orientação.', proficient: 'Explica convergências, diferenças e lacunas.' },
        { criterion: 'Conclusão', emerging: 'Generaliza além do registro.', developing: 'Limita a conclusão com apoio.', proficient: 'Sustenta a síntese e explicita o que permanece aberto.' },
      ],
    }],
    sourceDossier: [{
      sourceType: 'OFFICIAL_CURRICULUM',
      sourceId: 'BNCC_EI_EF_2018',
      documentVersion: 'BNCC Educação Infantil e Ensino Fundamental, versão final 2018',
      url: common.sourceUrl,
      page: common.sourcePage,
      officialCode: set.officialCode,
      descriptor: set.descriptor,
      usage: 'Contexto oficial para autoria independente; não é aprovação do mapeamento canônico.',
    }],
  };
}

function buildPack(set) {
  const questions = set.items.flatMap((item, caseIndex) => Array.from({ length: 5 }, (_, variant) => makeQuestion(set, item, caseIndex, variant)));
  const expectedPurposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const expectedAnswerPositionCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map((label, position) => [label, questions.filter((question) => question.options.indexOf(question.correctAnswer) === position).length]));
  return {
    packVersion: 'tec-escola-core-v5-question-first',
    contentId: set.contentId,
    subject: 'HISTORY',
    domain: 'HISTORICAL_INTERPRETATION',
    topic: set.topic,
    canonicalSkillCode: set.canonicalSkillCode,
    contentVersion: 13,
    lessonVersion: 13,
    expectedQuestionCount: questions.length,
    expectedContextCount: questions.length,
    expectedPurposeCounts,
    expectedAnswerPositionCounts,
    active: false,
    officialMappingStatus: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
    contentAuthoringStatus: 'AUTHORED',
    sourceReconciliation: { sourceQuestionCount: 0, newQuestions: questions.length, reusedQuestionsCountedAsNew: false, expansionStatus: 'AUTHORIAL_V13_WITH_PENDING_CANONICAL_REVIEW' },
    sourceContext: {
      officialCode: set.officialCode,
      sourceVerificationRecord: `BNCC_${set.officialCode}_MEC_P413_V1`,
      proposalId: set.proposalId,
      mappingStatus: 'CANONICAL_GAP',
      relation: 'AUTHORING_CONTEXT_ONLY',
      relationDecision: 'NOT_ASSERTED',
      authoringPurpose: `Desenvolver materiais autorais sobre ${set.title.toLocaleLowerCase('pt-BR')} para revisão humana.`,
      evidenceBoundary: 'O pacote não declara que o código oficial corresponde a uma skill canônica; a proposta permanece pendente.',
    },
    lesson: makeLesson(set, questions),
    questions,
  };
}

function updateSourceVerification() {
  const file = resolve(ROOT, 'content/bncc/authoring/source-verification-v2.json');
  const document = JSON.parse(readFileSync(file, 'utf8'));
  const records = document.records ?? [];
  const missingSets = sets.filter((set) => !records.some((record) => record.officialCode === set.officialCode));
  if (missingSets.length === 0) return;
  for (const set of missingSets) {
    const record = {
      verificationId: `BNCC_${set.officialCode}_MEC_P413_V1`,
      officialCode: set.officialCode,
      stage: common.stage,
      kind: 'SKILL',
      componentCode: common.componentCode,
      gradeOrRange: common.gradeOrRange,
      descriptor: set.descriptor,
      officialSource: {
        id: 'BNCC_EI_EF_2018',
        documentVersion: 'BNCC Educação Infantil e Ensino Fundamental, versão final 2018',
        url: common.sourceUrl,
        page: common.sourcePage,
      },
      localCatalogMatch: 'EXACT_DESCRIPTOR_AND_CODE_AFTER_PAGE_OFFSET_NORMALIZATION',
      sourcePageNote: 'O catálogo local registra a habilidade na página 413 da BNCC; a ocorrência foi conferida no PDF oficial do MEC.',
      technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
      mappingStatus: 'CANONICAL_GAP',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      studentPublicationStatus: 'STAGING_INACTIVE',
      contentDecision: 'AUTHORING_CONTEXT_ONLY_UNTIL_CANONICAL_REVIEW',
      evidenceCheckedAt: '2026-10-17',
    };
    records.push(record);
  }
  document.records = records;
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
}

function main() {
  updateSourceVerification();
  const result = [];
  for (const set of sets) {
    const pack = buildPack(set);
    const validation = validateQuestionFirstPack(pack);
    if (!validation.valid) throw new Error(`${set.contentId.toUpperCase()}_INVALID:${validation.errors.join(',')}`);
    const output = resolve(ROOT, `content/adaptive/tec-escola-core-v5/${set.contentId}.json`);
    writeFileSync(output, `${JSON.stringify(pack, null, 2)}\n`);
    result.push({ contentId: set.contentId, officialCode: set.officialCode, questionCount: validation.questionCount, purposeCounts: validation.counts, answerPositionCounts: validation.answerPositionCounts, publicationStatus: pack.publicationStatus, pedagogicalReviewStatus: pack.pedagogicalReviewStatus, officialMappingStatus: pack.officialMappingStatus });
  }
  process.stdout.write(`${JSON.stringify({ valid: true, sourceRecordsAdded: sets.length, migrationsCreated: 0, packages: result }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

export { buildPack, sets };
