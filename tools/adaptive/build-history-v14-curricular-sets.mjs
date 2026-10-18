import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildPack } from './build-history-v13-curricular-sets.mjs';
import { validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_URL = 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf';
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];

const item = (label, context, question, correct, criterion, transfer, overclaim, evidence, nextStep, distractors) => ({
  label,
  context,
  question,
  correct,
  criterion,
  transfer,
  overclaim,
  evidence,
  nextStep,
  distractors,
});

const sets = [
  {
    officialCode: 'EF03HI11',
    contentId: 'v14-history-work-technology',
    title: 'Trabalho, cidade, campo e tecnologia',
    topic: 'formas_de_trabalho_cidade_campo_e_tecnologia',
    canonicalSkillCode: 'AUTHORING_EF03HI11_HISTORY_WORK_TECHNOLOGY',
    proposalId: 'V14_AUTHORING_EF03HI11_HISTORY_WORK_TECHNOLOGY',
    descriptor: 'Identificar diferenças entre formas de trabalho realizadas na cidade e no campo, considerando também o uso da tecnologia nesses diferentes contextos.',
    objective: 'Identificar e comparar formas de trabalho na cidade e no campo, relacionando ferramentas, organização, saberes e mudanças tecnológicas sem hierarquizar os contextos.',
    summary: 'O trabalho acontece em diferentes lugares e depende de conhecimentos, ferramentas, relações e condições. A tecnologia pode mudar tarefas e ritmos, mas não torna um contexto automaticamente melhor ou mais simples.',
    concepts: ['trabalho', 'cidade', 'campo', 'tecnologia', 'ferramenta', 'organização', 'mudança', 'permanência'],
    priorKnowledge: ['Reconhecer diferenças entre cidade e campo.', 'Descrever a função de ferramentas em uma atividade.'],
    commonMistake: 'Tratar cidade e campo como opostos fixos, considerar tecnologia apenas como aparelho eletrônico ou concluir que uma ferramenta elimina todo o conhecimento do trabalhador.',
    items: [
      item('place', 'Uma pessoa trabalha em uma horta próxima à cidade, enquanto outra organiza entregas em um galpão urbano.', 'O que a comparação deve considerar?', 'As tarefas, os lugares, os recursos e a organização do trabalho, sem concluir que um trabalho pertence somente a um tipo de espaço.', 'Cidade e campo podem se relacionar; o local da atividade não explica sozinho todas as formas de trabalho.', 'Compare uma feira, uma oficina e uma horta.', 'dizer que toda atividade da cidade é industrial e toda atividade do campo é manual', 'local, tarefa, recursos, pessoas envolvidas e destino da produção', 'registrar semelhanças e diferenças antes de classificar', ['O nome do bairro basta para explicar o trabalho.', 'A cidade não depende do campo.', 'Toda horta é trabalho doméstico.']),
      item('tool', 'Uma agricultora usa enxada, sementes selecionadas e um aplicativo que informa a previsão do tempo.', 'Como identificar a tecnologia nessa atividade?', 'Reconhecer ferramentas, conhecimentos e recursos digitais como meios que apoiam decisões e tarefas diferentes.', 'Tecnologia inclui técnicas, ferramentas, conhecimentos e sistemas, não apenas telas ou máquinas novas.', 'Identifique tecnologias em uma padaria ou oficina.', 'dizer que somente o aplicativo é tecnologia', 'função de cada recurso e decisão que ele apoia', 'separar ferramenta, conhecimento e informação usada', ['A enxada não envolve tecnologia.', 'A previsão decide tudo sozinha.', 'Tecnologia só existe em fábricas.']),
      item('organization', 'Uma cooperativa divide etapas entre plantio, colheita, transporte e venda de alimentos.', 'O que a divisão das etapas mostra?', 'Que diferentes pessoas e tarefas podem se organizar para produzir e fazer circular um produto.', 'Formas de trabalho também se diferenciam pela organização das tarefas e pelas relações entre quem participa.', 'Compare etapas de um alimento ou objeto usado na escola.', 'afirmar que apenas quem produz diretamente realiza trabalho', 'etapas, participantes, ferramentas e circulação do produto', 'montar uma sequência com responsabilidades sem hierarquizar ocupações', ['Transporte não faz parte do trabalho.', 'A venda acontece antes do plantio.', 'Uma cooperativa tem uma única tarefa.']),
      item('continuity', 'Um artesão mantém uma técnica aprendida com a família e usa uma ferramenta elétrica para preparar parte da peça.', 'Que mudança e permanência podem ser identificadas?', 'A técnica e os saberes podem permanecer enquanto uma ferramenta modifica parte do modo de fazer.', 'Mudanças tecnológicas podem coexistir com conhecimentos e práticas que continuam sendo transmitidos.', 'Analise uma receita ou prática artesanal com ferramentas atuais.', 'dizer que uma ferramenta apaga todo o saber anterior', 'etapas mantidas, etapa modificada e finalidade do recurso', 'separar o que mudou do que continuou', ['Nada mudou porque a técnica permanece.', 'Tudo mudou porque existe uma ferramenta elétrica.', 'O saber familiar impede qualquer inovação.']),
      item('conditions', 'Uma trabalhadora rural relata que a irrigação reduziu o tempo de rega, mas exige manutenção e treinamento.', 'Como interpretar esse relato?', 'Reconhecer um benefício e também as condições necessárias para usar e manter a tecnologia.', 'Uma mudança tecnológica pode criar possibilidades e novas responsabilidades; não deve ser descrita apenas como ganho automático.', 'Avalie uma tecnologia usada na escola.', 'concluir que a irrigação resolveu todos os problemas do trabalho', 'tempo, manutenção, treinamento, acesso e efeito relatado', 'registrar vantagens, limites e condições de uso', ['Manutenção não é parte do trabalho.', 'Toda tecnologia reduz qualquer esforço.', 'O relato prova que todos tiveram o mesmo resultado.']),
      item('comparison', 'Uma fábrica urbana usa máquinas para embalar alimentos, e uma família rural usa instrumentos para preparar o solo.', 'Qual comparação é responsável?', 'Comparar a finalidade, a escala, os recursos e a organização de cada atividade, evitando medir todos os trabalhos por um único critério.', 'A comparação histórica precisa explicar diferenças sem transformar uma forma de trabalho em modelo universal.', 'Compare duas atividades com escalas diferentes.', 'dizer que máquinas tornam o trabalho sempre mais importante', 'finalidade, escala, ritmo, ferramentas e pessoas envolvidas', 'escrever uma tabela com critérios iguais para os dois casos', ['Basta contar as máquinas.', 'O trabalho rural não usa organização.', 'Escala e finalidade são a mesma coisa.']),
      item('gender', 'Em um registro antigo, mulheres aparecem como responsáveis pelo cultivo e pelo cuidado; em uma notícia atual, essas tarefas são divididas de outro modo.', 'O que pode ser investigado?', 'Mudanças na divisão das tarefas e permanências nos conhecimentos e responsabilidades, considerando a fonte e o período.', 'Comparar trabalho exige evitar estereótipos e observar quem aparece, quem é omitido e como a fonte foi produzida.', 'Analise uma lista de tarefas de uma atividade coletiva.', 'concluir que uma fonte representa todas as famílias', 'autoria, data, tarefas descritas e pessoas visíveis ou ausentes', 'perguntar quais vozes e períodos ainda precisam de outras fontes', ['A divisão é natural e não muda.', 'A fonte prova como todas as mulheres trabalham.', 'Cuidado nunca é trabalho.']),
      item('environment', 'Uma comunidade utiliza uma máquina para retirar água, mas acompanha o nível do poço para evitar desperdício.', 'Que relação deve ser registrada?', 'A relação entre tecnologia, necessidade de trabalho e cuidado com os recursos disponíveis.', 'O uso de uma ferramenta deve ser analisado junto de seus efeitos e das regras de cuidado do contexto.', 'Avalie o uso de água em uma atividade escolar.', 'dizer que a máquina permite retirar água sem limite', 'finalidade, quantidade, regra de uso e efeito observado', 'relacionar ferramenta, decisão e responsabilidade ambiental', ['Tecnologia elimina qualquer limite.', 'O poço é inesgotável.', 'Cuidado ambiental não tem relação com trabalho.']),
      item('voices', 'Um vídeo mostra apenas a máquina de uma empresa, mas não informa quem opera, conserta ou decide seu uso.', 'Que limite a fonte apresenta?', 'Ela permite observar a máquina, mas não sustenta conclusões sobre todas as pessoas e decisões envolvidas.', 'Uma fonte visual tem recorte; o que não aparece precisa ser investigado com outras evidências.', 'Aponte limites em uma fotografia de uma oficina.', 'afirmar que a máquina funciona sozinha', 'elementos visíveis, autoria, data e pessoas ausentes', 'registrar uma pergunta para outra fonte', ['O vídeo mostra toda a organização.', 'A máquina é a única trabalhadora.', 'O silêncio prova que ninguém opera o equipamento.']),
      item('synthesis', 'A turma compara relatos, fotografias e dados sobre uma atividade de produção em cidade e campo.', 'Como escrever uma síntese adequada?', 'Relacionar formas de trabalho, tecnologia, permanências e mudanças, atribuindo cada afirmação à fonte correspondente.', 'Uma síntese histórica distingue observação, comparação e interpretação, sem generalizar a partir de um único caso.', 'Faça uma síntese sobre transporte ou comércio.', 'afirmar que toda tecnologia produz o mesmo efeito em qualquer lugar', 'fontes, períodos, tarefas, recursos, mudanças e limites', 'revisar a conclusão e explicitar o que ainda precisa ser investigado', ['Escolher a fonte mais recente e ignorar as demais.', 'Transformar um exemplo em regra geral.', 'Dizer que cidade e campo não se relacionam.']),
    ],
  },
  {
    officialCode: 'EF03HI12',
    contentId: 'v14-history-work-leisure-change',
    title: 'Trabalho, lazer, mudanças e permanências',
    topic: 'relacoes_de_trabalho_e_lazer_no_tempo',
    canonicalSkillCode: 'AUTHORING_EF03HI12_HISTORY_WORK_LEISURE_CHANGE',
    proposalId: 'V14_AUTHORING_EF03HI12_HISTORY_WORK_LEISURE_CHANGE',
    descriptor: 'Comparar as relações de trabalho e lazer do presente com as de outros tempos e espaços, analisando mudanças e permanências.',
    objective: 'Comparar relações de trabalho e lazer em diferentes tempos e espaços, identificando mudanças, permanências, condições de acesso e limites das fontes.',
    summary: 'Trabalho e lazer se organizam de acordo com tempo, espaço, recursos e condições sociais. Comparar épocas exige observar tanto o que mudou quanto o que permaneceu, sem idealizar o passado ou generalizar o presente.',
    concepts: ['trabalho', 'lazer', 'tempo', 'espaço', 'mudança', 'permanência', 'acesso', 'fonte'],
    priorKnowledge: ['Organizar acontecimentos em ordem temporal.', 'Distinguir informação de avaliação em um relato.'],
    commonMistake: 'Imaginar que o passado foi igual para todas as pessoas ou que toda mudança tecnológica ampliou o lazer de todos.',
    items: [
      item('routine', 'Uma fotografia mostra pessoas reunidas em uma praça no domingo; um relato atual descreve um parque usado no mesmo dia.', 'O que pode ser comparado?', 'As formas de uso do tempo e do espaço de lazer, considerando as datas, as atividades e as condições registradas.', 'Comparar lazer exige situar a fonte e observar práticas concretas, não apenas dizer que as pessoas “se divertiam”.', 'Compare dois lugares de convivência.', 'dizer que as duas imagens provam que todos tinham o mesmo lazer', 'data, local, atividades, participantes visíveis e informações ausentes', 'organizar semelhanças e diferenças em uma tabela', ['Domingo tem sempre o mesmo significado.', 'Uma fotografia mostra todos os moradores.', 'Lazer não depende do espaço.']),
      item('worktime', 'Um depoimento antigo menciona longas jornadas e um registro atual informa horários de uma ocupação.', 'Que relação pode ser investigada?', 'Mudanças e permanências na duração e na organização do trabalho, respeitando as fontes e seus contextos.', 'Horários são evidências situadas; não permitem concluir sozinhos sobre todas as ocupações.', 'Compare horários de duas atividades sem usar dados pessoais.', 'afirmar que a jornada de uma pessoa representa todos os trabalhadores', 'data, ocupação, jornada, autoria e contexto do registro', 'buscar outra fonte para ampliar a comparação', ['Toda ocupação tem o mesmo horário.', 'O relato antigo não tem valor.', 'Horário explica sozinho as condições de trabalho.']),
      item('access', 'Um clube do passado cobrava entrada, enquanto uma praça atual oferece atividades gratuitas em alguns horários.', 'Que aspecto da comparação é importante?', 'Analisar as condições de acesso e as regras de cada espaço, além das atividades oferecidas.', 'Lazer não se define apenas pela existência de uma atividade; acesso, custo e regras também fazem parte da experiência.', 'Compare biblioteca, praça e clube.', 'dizer que uma atividade gratuita é acessível para todas as pessoas', 'custo, horário, localização, regras e atividades', 'separar oferta de lazer de possibilidade real de participação', ['Entrada gratuita resolve todas as barreiras.', 'Clube e praça têm as mesmas regras.', 'A atividade é igual para todos.']),
      item('technology', 'Uma família registrava encontros por carta; hoje seus integrantes usam chamadas de vídeo para conversar.', 'O que mudou e o que permaneceu?', 'Mudou o meio e o ritmo da comunicação, enquanto permaneceu a intenção de manter relações entre pessoas distantes.', 'Uma comparação equilibrada identifica função e tecnologia sem supor que o novo meio produza a mesma experiência.', 'Compare outras formas de comunicação.', 'dizer que a carta e a chamada de vídeo têm exatamente o mesmo uso', 'meio, tempo de espera, participantes e finalidade', 'descrever função, diferença e permanência', ['A tecnologia não muda nenhuma relação.', 'Carta nunca foi forma de lazer.', 'Chamada de vídeo elimina distância física.']),
      item('work-leisure', 'Uma pessoa trabalha em casa e participa de um curso on-line à noite, mas precisa compartilhar o mesmo equipamento com familiares.', 'Que condição deve ser considerada?', 'Que os limites entre trabalho, estudo e lazer dependem de tempo, espaço, equipamento e condições de acesso.', 'As categorias ajudam a analisar a atividade, mas a experiência concreta depende das condições sociais e materiais.', 'Analise outra rotina sem pedir relatos íntimos.', 'concluir que trabalhar em casa sempre aumenta o lazer', 'tempo disponível, equipamento, espaço e finalidade da atividade', 'comparar condições sem expor dados pessoais', ['Casa garante tempo livre.', 'Todo uso de tela é lazer.', 'A atividade tem o mesmo sentido para todos.']),
      item('past-ideal', 'Um texto afirma que no passado as pessoas tinham mais tempo livre porque não havia internet.', 'Como avaliar essa afirmação?', 'Indicar que a frase é uma hipótese limitada e buscar dados sobre trabalho, tarefas, deslocamento e lazer em diferentes grupos.', 'A ausência de uma tecnologia não prova que havia mais lazer; é preciso comparar condições e fontes.', 'Avalie outra afirmação sobre o passado.', 'aceitar a idealização sem examinar o trabalho e o acesso', 'autoria, período, grupos considerados e evidências de tempo livre', 'reformular a frase com limites explícitos', ['O passado é sempre mais tranquilo.', 'Internet é a única causa da falta de lazer.', 'Uma lembrança basta para todos os grupos.']),
      item('space', 'Uma quadra escolar era usada apenas por uma turma em um registro antigo e hoje possui horários compartilhados.', 'Que mudança pode ser identificada?', 'Uma mudança na organização e no acesso ao espaço, mantendo a função de prática e convivência.', 'O mesmo espaço pode conservar uma função e mudar suas regras de uso.', 'Compare horários de uma biblioteca ou laboratório.', 'dizer que a função permaneceu exatamente igual', 'registros de uso, horários, regras e atividades', 'separar função, acesso e organização', ['Horário não é parte da história.', 'Compartilhar elimina a função da quadra.', 'A turma antiga usava o espaço inteiro.']),
      item('missing', 'Um álbum mostra apenas festas de uma família em uma década, sem registrar dias de trabalho ou pessoas que não participavam.', 'Que limite deve ser apontado?', 'O álbum documenta momentos escolhidos de lazer e não representa todas as experiências da época.', 'Fontes pessoais são úteis, mas têm recorte de autoria, seleção e memória.', 'Aponte limites em um álbum ou postagem pública.', 'generalizar o conteúdo para toda a comunidade', 'autoria, seleção das imagens, período e pessoas ausentes', 'procurar outras fontes públicas e contextualizadas', ['Álbuns não são fontes.', 'Toda festa aparece no álbum.', 'O que não foi fotografado não aconteceu.']),
      item('synthesis', 'Uma pesquisa reúne horários de trabalho, relatos de lazer e mapas de espaços de convivência de duas épocas.', 'Como apresentar a conclusão?', 'Apontar mudanças e permanências, relacionar acesso e organização e indicar quais conclusões dependem de novas fontes.', 'A conclusão deve ser proporcional ao conjunto de evidências e explicitar diferenças entre grupos e períodos.', 'Revise uma conclusão sobre transporte e tempo livre.', 'dizer que uma época foi melhor para todas as pessoas', 'fontes, períodos, atividades, acesso, mudanças e lacunas', 'revisar generalizações antes de divulgar', ['Uma fonte basta para comparar épocas.', 'Mudança significa melhora para todos.', 'Lazer não tem relação com trabalho.']),
    ],
  },
];

function appendSourceVerification() {
  const file = resolve(ROOT, 'content/bncc/authoring/source-verification-v2.json');
  const document = JSON.parse(readFileSync(file, 'utf8'));
  const records = document.records ?? [];
  const missing = sets.filter((set) => !records.some((record) => record.officialCode === set.officialCode));
  if (missing.length === 0) return 0;
  const additions = missing.map((set) => ({
    verificationId: `BNCC_${set.officialCode}_MEC_P413_V1`,
    officialCode: set.officialCode,
    stage: 'ENSINO_FUNDAMENTAL',
    kind: 'SKILL',
    componentCode: 'HI',
    gradeOrRange: '03',
    descriptor: set.descriptor,
    officialSource: {
      id: 'BNCC_EI_EF_2018',
      documentVersion: 'BNCC Educação Infantil e Ensino Fundamental, versão final 2018',
      url: SOURCE_URL,
      page: 413,
    },
    localCatalogMatch: 'EXACT_DESCRIPTOR_AND_CODE_AFTER_PAGE_OFFSET_NORMALIZATION',
    sourcePageNote: 'O catálogo local registra a habilidade na página 413 da BNCC; a ocorrência foi conferida no registro oficial local congelado.',
    technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
    mappingStatus: 'CANONICAL_GAP',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    studentPublicationStatus: 'STAGING_INACTIVE',
    contentDecision: 'AUTHORING_CONTEXT_ONLY_UNTIL_CANONICAL_REVIEW',
    evidenceCheckedAt: '2026-10-17',
  }));
  document.records = [...records, ...additions];
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
  return additions.length;
}

function main() {
  const sourceRecordsAdded = appendSourceVerification();
  const packages = sets.map((set) => {
    const pack = buildPack(set);
    pack.contentVersion = 14;
    pack.lessonVersion = 14;
    pack.sourceReconciliation.expansionStatus = 'AUTHORIAL_V14_WITH_PENDING_CANONICAL_REVIEW';
    const validation = validateQuestionFirstPack(pack);
    if (!validation.valid) throw new Error(`${set.contentId.toUpperCase()}_INVALID:${validation.errors.join(',')}`);
    const output = resolve(ROOT, `content/adaptive/tec-escola-core-v5/${set.contentId}.json`);
    writeFileSync(output, `${JSON.stringify(pack, null, 2)}\n`);
    return {
      contentId: set.contentId,
      officialCode: set.officialCode,
      questionCount: validation.questionCount,
      purposeCounts: validation.counts,
      answerPositionCounts: validation.answerPositionCounts,
      publicationStatus: pack.publicationStatus,
      pedagogicalReviewStatus: pack.pedagogicalReviewStatus,
      officialMappingStatus: pack.officialMappingStatus,
    };
  });
  process.stdout.write(`${JSON.stringify({ valid: true, sourceRecordsAdded, migrationsCreated: 0, packages }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

export { sets };
