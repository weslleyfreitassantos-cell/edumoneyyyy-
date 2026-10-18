import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCurriculumPackageRubric } from './curriculum-package-rubric.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const QUEUE_PATH = 'content/bncc/authoring/completion-queue-v14.json';
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';
const REPORT_PATH = 'content/bncc/authoring/legacy-package-recovery-v1.json';

const PHASE_BY_STAGE = {
  PROBE: 'PROBE',
  FOUNDATION: 'PROBE',
  DIAGNOSTIC: 'PROBE',
  PRACTICE: 'PRACTICE',
  APPLICATION: 'PRACTICE',
  TRANSFER: 'TRANSFER',
  LOCK_IN: 'LOCK_IN',
  INTEGRATION: 'LOCK_IN',
  CONSOLIDATION: 'LOCK_IN',
  REVIEW: 'REVIEW',
  SPACED_REVIEW_CANDIDATE: 'REVIEW',
};

const RECIPES = {
  EF01CI01: {
    file: 'content/adaptive/tec-escola-core-v5/science-materials-conscious-use-fi-v8.json',
    notes: ['Mantida a explicação progressiva existente e complementada com uma síntese acessível no campo padrão da aula.', 'Criadas etapas observáveis para a investigação segura de materiais.', 'Distribuídas as posições das respostas corretas sem alterar alternativas ou gabaritos.'],
    explanation: 'Compare primeiro uma propriedade que possa ser observada; depois relacione-a ao uso do objeto. Para falar de origem, procure informação de fonte confiável em vez de adivinhar pela aparência. Ao discutir descarte, considere orientação local e alternativas de reduzir, reutilizar ou reparar, sem concluir que todo material segue o mesmo destino.',
    commonMistake: 'Inferir a origem ou o destino de um material apenas pela aparência, ou tratar uma regra local de descarte como universal.',
    activity: {
      title: 'Investigar materiais de objetos cotidianos',
      context: 'Objetos seguros disponibilizados pela escola e fontes locais de orientação para reutilização ou descarte.',
      steps: ['Escolha dois objetos seguros e registre o que é observável em cada material, sem presumir sua origem.', 'Compare uma propriedade relacionada ao uso e consulte uma fonte local ou um adulto sobre a origem ou destinação quando a informação não estiver no objeto.', 'Apresente uma decisão de uso consciente e indique o que a observação, sozinha, não permite concluir.'],
      evidence: 'Registro multimodal que compara dois objetos por uma propriedade observável, atribui a informação de origem ou descarte à fonte consultada e limita a conclusão ao que foi observado.',
      rubric: [{ criterion: 'Observação e comparação', emerging: 'Nomeia objetos sem apontar propriedades observáveis.', developing: 'Compara uma propriedade com apoio.', proficient: 'Compara uma propriedade relevante e liga a evidência ao uso.' }, { criterion: 'Origem e destinação', emerging: 'Adivinha a origem ou o descarte pela aparência.', developing: 'Consulta uma fonte, mas não distingue dado de hipótese.', proficient: 'Atribui a informação à fonte e explicita limites.' }, { criterion: 'Escolha consciente', emerging: 'Propõe uma ação sem justificativa.', developing: 'Propõe reduzir, reutilizar, reparar ou encaminhar com apoio.', proficient: 'Justifica uma ação adequada ao contexto sem generalizar a regra local.' }],
    },
    accessibilitySupports: ['Oferecer objetos com propriedades perceptíveis por mais de um canal e descrever verbalmente o que não puder ser tocado com segurança.', 'Aceitar registro por desenho, fala, comunicação alternativa, tabela ou texto; fornecer instruções curtas e fonte em formato legível.'],
    remediations: [{ errorFocus: 'Deduzir a origem do material somente pela aparência.', action: 'Separe o que foi observado da informação obtida em fonte e marque cada afirmação como observação, fonte ou hipótese.' }, { errorFocus: 'Generalizar o descarte de um material para todos os municípios.', action: 'Consulte a orientação local disponível e compare-a com a recomendação geral, registrando qual fonte sustenta cada decisão.' }, { errorFocus: 'Confundir propriedade do material com finalidade do objeto.', action: 'Compare a propriedade observada com o uso do objeto e explique a relação sem afirmar que ela é a única possível.' }],
  },
  EF01CI02: {
    file: 'content/adaptive/tec-escola-core-v5/v1-science-body-parts-fi.json',
    notes: ['Tornadas explícitas as etapas da representação corporal já proposta.', 'Acrescentados apoios de acesso e estratégias de retomada sem exigir que todos expressem ou movimentem o corpo da mesma forma.'],
    activity: {
      title: 'Representar partes do corpo e funções observáveis',
      context: 'Silhueta ou personagem fictício, cartões de partes do corpo e formas variadas de comunicação.',
      steps: ['Escolha uma silhueta ou personagem fictício e marque partes do corpo sem comparar corpos reais da turma.', 'Associe cada parte a uma função observável usando fala, desenho, cartões, gesto ou comunicação alternativa.', 'Revise uma associação com apoio de fonte ou demonstração segura e registre uma adaptação de participação possível.'],
      evidence: 'Mapa multimodal que nomeia e representa pelo menos seis partes, associa funções justificáveis e registra uma forma acessível de participação.',
      rubric: [{ criterion: 'Localização e nomeação', emerging: 'Marca partes sem nomeá-las.', developing: 'Nomeia partes com apoio visual.', proficient: 'Localiza e nomeia partes usando a representação escolhida.' }, { criterion: 'Relação entre parte e função', emerging: 'Associa uma função sem relação observável.', developing: 'Relaciona parte e função com apoio.', proficient: 'Explica relações observáveis e reconhece que ações podem envolver mais de uma parte.' }, { criterion: 'Participação respeitosa', emerging: 'Pressupõe que todos realizem o mesmo movimento.', developing: 'Aceita uma forma alternativa após mediação.', proficient: 'Escolhe e reconhece diferentes formas de representar ou participar.' }],
    },
    accessibilitySupports: ['Permitir representação por personagem, silhueta, cartões, objetos táteis, descrição oral ou comunicação alternativa, sem tocar no corpo de colegas.', 'Usar imagens nítidas com contraste, linguagem direta e tempo de resposta flexível; não inferir capacidade a partir da aparência ou do movimento.'],
    remediations: [{ errorFocus: 'Confundir o nome de uma parte com a função que ela pode desempenhar.', action: 'Use cartões de parte e ação, explique uma associação com evidência e indique quando mais de uma parte participa.' }, { errorFocus: 'Tratar uma ação como se dependesse de uma única parte do corpo.', action: 'Observe ou represente a ação em etapas e registre as partes envolvidas sem exigir demonstração corporal do estudante.' }, { errorFocus: 'Supor que todas as pessoas percebem ou se movimentam da mesma forma.', action: 'Compare duas formas de participação representadas e descreva adaptações sem classificar uma como melhor.' }],
  },
  EF01CI04: {
    file: 'content/adaptive/tec-escola-core-v5/v1-science-human-diversity-fi.json',
    notes: ['Mantido o uso de personagens fictícios e explicitados passos de observação e convivência sem comparação entre estudantes.', 'Acrescentados apoios de acessibilidade e recuperação alinhados ao objetivo de respeito às diferenças.'],
    activity: {
      title: 'Observar diversidade com personagens fictícios',
      context: 'Cartões de personagens fictícios e situações de convivência construídas para a atividade, sem fotos ou relatos pessoais.',
      steps: ['Escolha dois cartões fictícios e registre características que aparecem de forma direta, distinguindo observação de suposição.', 'Identifique uma semelhança e uma diferença sem criar ranking, diagnóstico ou previsão de capacidade.', 'Proponha uma ação de convivência que permita participação e respeito à escolha de não responder.'],
      evidence: 'Registro que separa observação de suposição, compara personagens sem hierarquia e propõe uma ação de convivência com participação voluntária.',
      rubric: [{ criterion: 'Observação', emerging: 'Apresenta suposição como fato visível.', developing: 'Separa observação e suposição com apoio.', proficient: 'Sustenta a descrição em evidência da representação.' }, { criterion: 'Comparação respeitosa', emerging: 'Cria ranking ou generaliza capacidades.', developing: 'Compara sem ranking após mediação.', proficient: 'Reconhece diferenças sem atribuir valor ou capacidade não observada.' }, { criterion: 'Convivência e autonomia', emerging: 'Propõe participação obrigatória.', developing: 'Propõe uma ação respeitosa com apoio.', proficient: 'Inclui alternativas e respeita a opção de não participar ou responder.' }],
    },
    accessibilitySupports: ['Disponibilizar cartões em formatos legíveis, descrição verbal e personagens com variedade de características sem caricatura.', 'Permitir resposta por desenho, seleção de cartões, fala, escrita ou comunicação alternativa; não solicitar autorretratos, comparação entre colegas ou dados pessoais.'],
    remediations: [{ errorFocus: 'Inferir personalidade ou capacidade a partir de uma característica física.', action: 'Sublinhe o que está visível e risque a inferência; reescreva usando apenas a evidência da cena.' }, { errorFocus: 'Transformar diferenças em ranking ou padrão de valor.', action: 'Reformule a comparação como descrição neutra e identifique uma atividade compartilhada sem exigir que todos participem.' }, { errorFocus: 'Pressupor que uma personagem deseja ajuda ou exposição.', action: 'Revise a situação e proponha uma pergunta ou alternativa que preserve escolha, privacidade e autonomia.' }],
  },
  EF01CI05: {
    file: 'content/adaptive/tec-escola-core-v5/v1-science-time-scales-fi.json',
    notes: ['Explicitadas etapas de trabalho com rotina e calendário fictícios.', 'Acrescentadas alternativas visuais e de resposta para diferentes formas de leitura e organização temporal.'],
    activity: {
      title: 'Organizar períodos e unidades de tempo',
      context: 'Cartões de rotina fictícia e calendário didático sem datas ou compromissos reais de estudantes.',
      steps: ['Ordene acontecimentos fictícios dentro de um dia e nomeie manhã, tarde ou noite quando a informação permitir.', 'Use um calendário didático para mostrar a sucessão de dias, semanas e meses, apontando a escala adequada à pergunta.', 'Registre uma informação ausente ou incerta em vez de completar o calendário por suposição.'],
      evidence: 'Sequência multimodal que organiza períodos do dia e unidades maiores, nomeia a escala temporal e distingue informação dada de informação ausente.',
      rubric: [{ criterion: 'Períodos do dia', emerging: 'Nomeia períodos sem relacioná-los à sequência apresentada.', developing: 'Ordena períodos com apoio visual.', proficient: 'Nomeia e ordena manhã, tarde e noite quando sustentado pelo contexto.' }, { criterion: 'Escala temporal', emerging: 'Mistura dia, semana, mês e ano.', developing: 'Agrupa unidades com apoio do calendário.', proficient: 'Escolhe e explica a escala adequada à situação.' }, { criterion: 'Uso de evidência', emerging: 'Completa lacunas por suposição.', developing: 'Reconhece uma informação ausente com ajuda.', proficient: 'Registra o que está dado e o que não pode concluir.' }],
    },
    accessibilitySupports: ['Usar calendário de alto contraste, cartões com símbolos e texto ampliado; permitir ordenar objetos físicos ou cartões sem depender de leitura fluente.', 'Oferecer resposta oral, visual, tátil ou escrita e tempo adicional para sequenciar; usar apenas rotinas fictícias, sem dados pessoais.'],
    remediations: [{ errorFocus: 'Misturar períodos do dia com unidades como semana ou mês.', action: 'Separe cartões por escala temporal e explique qual pergunta cada escala ajuda a responder.' }, { errorFocus: 'Tratar o calendário como se revelasse uma rotina pessoal não informada.', action: 'Marque somente datas e sequências presentes no material e sinalize explicitamente qualquer dado ausente.' }, { errorFocus: 'Ordenar dias ou meses sem observar a sucessão.', action: 'Use a sequência visual para localizar o anterior e o seguinte antes de responder e confira o ciclo do calendário.' }],
  },
  EF03HI01: {
    file: 'content/adaptive/tec-escola-core-v5/v31-history-population-groups-expansion-v31.json',
    notes: ['Substituída atividade genérica por investigação de fontes sobre grupos, migrações e formação municipal, sem requisitar histórias familiares.', 'Personalizados critérios de síntese e apoios de acessibilidade.'],
    example: 'Exemplo hipotético: uma fotografia registra novas moradias depois da abertura de uma estrada e um relatório municipal descreve o período. As fontes permitem investigar mudança e deslocamento, mas não provam que a estrada foi a única causa nem representam todas as famílias.',
    activity: { title: 'Investigar grupos e transformações do município', context: 'Conjunto didático de fontes públicas ou hipotéticas sobre mudanças em um município, sem solicitar memórias familiares.', steps: ['Identifique autoria, data, lugar e propósito de duas fontes sobre a formação ou transformação do município.', 'Compare afirmações sobre o mesmo aspecto e registre grupos, deslocamentos ou eventos somente quando sustentados pelas fontes.', 'Produza uma síntese com convergências, divergências e uma lacuna; não atribua uma causa única sem evidência.'], evidence: 'Matriz de fontes e síntese que atribui afirmações às fontes, registra limites e evita generalizar experiências de grupos.', rubric: [{ criterion: 'Identificação de grupos', emerging: 'Nomeia grupos sem evidência ou contexto.', developing: 'Localiza grupos em uma fonte com apoio.', proficient: 'Relaciona grupos e contexto às fontes consultadas.' }, { criterion: 'Relações e mudanças', emerging: 'Afirma uma causa única sem apoio.', developing: 'Aponta relação possível com apoio.', proficient: 'Distingue evento, relação sustentada e hipótese.' }, { criterion: 'Limites e diversidade', emerging: 'Generaliza um relato para toda a população.', developing: 'Reconhece uma lacuna após mediação.', proficient: 'Limita a conclusão e reconhece que fontes não representam todos os grupos.' }] },
    additionalActivities: [{
      steps: ['Liste eventos documentados e associe a cada um a fonte, o período, o lugar e o grupo citado.', 'Ordene os eventos sem converter sequência temporal em causalidade automática.', 'Marque uma relação sustentada e uma pergunta que as fontes ainda não respondem.'],
      evidence: 'Linha do tempo com eventos atribuídos às fontes, uma relação sustentada e uma lacuna registrada.',
      rubric: [{ criterion: 'Ordenação e atribuição', emerging: 'Lista eventos sem período ou fonte.', developing: 'Ordena eventos com apoio.', proficient: 'Ordena e atribui cada evento à fonte correspondente.' }, { criterion: 'Relação histórica', emerging: 'Afirma causalidade pela ordem dos eventos.', developing: 'Aponta relação possível com mediação.', proficient: 'Distingue sequência, relação sustentada e hipótese.' }, { criterion: 'Lacuna', emerging: 'Completa informação ausente por suposição.', developing: 'Marca uma pergunta em aberto com apoio.', proficient: 'Registra uma lacuna que delimita a interpretação.' }],
    }],
    accessibilitySupports: ['Disponibilizar fontes em texto ampliado, leitura em voz alta, descrição de imagens e quadro de autoria/data/lugar.', 'Aceitar matriz por cartões, áudio sem dados pessoais, desenho ou texto; não pedir relatos familiares ou informações sensíveis.'],
    remediations: [{ errorFocus: 'Generalizar uma fonte individual para todos os grupos populacionais.', action: 'Identifique quem produziu a fonte, quem aparece e quem não aparece antes de formular uma conclusão limitada.' }, { errorFocus: 'Afirmar que um evento causou uma mudança sem evidência suficiente.', action: 'Separe sequência temporal de relação causal e procure qual fonte sustenta cada afirmação.' }, { errorFocus: 'Usar migração como explicação única para a formação do município.', action: 'Organize eventos e grupos em uma matriz e registre outras causas possíveis apenas como hipóteses a verificar.' }],
  },
  EF03HI02: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-time-sources.json',
    notes: ['Reescrito o exemplo para selecionar fontes e registrar data, procedência e limites.', 'Atividade passou a exigir comparação de fontes de naturezas distintas.'],
    example: 'Exemplo hipotético: para estudar a inauguração de uma ponte, uma fotografia pode mostrar a cerimônia, um documento pode informar a data e um relato pode descrever uma experiência. Cada fonte responde a perguntas diferentes e nenhuma, sozinha, conta toda a história.',
    activity: { title: 'Selecionar e registrar fontes históricas', context: 'Fontes didáticas de tipos distintos sobre um acontecimento local, fornecidas pelo professor ou por acervo público.', steps: ['Formule uma pergunta sobre o acontecimento e escolha duas fontes de naturezas distintas que possam respondê-la.', 'Registre tipo, autoria, data, lugar, informação sustentada e limite de cada fonte.', 'Compare convergências e diferenças e escreva uma conclusão que deixe explícita uma pergunta ainda aberta.'], evidence: 'Ficha comparativa com pergunta, procedência, informação sustentada e limite de cada fonte.', rubric: [{ criterion: 'Seleção e procedência', emerging: 'Escolhe fonte sem identificar sua origem.', developing: 'Registra parte da procedência.', proficient: 'Relaciona a escolha da fonte à pergunta e registra autoria, tipo e data disponíveis.' }, { criterion: 'Evidência e limite', emerging: 'Trata a fonte como registro completo.', developing: 'Identifica uma informação e um limite com apoio.', proficient: 'Distingue informação sustentada, silêncio da fonte e inferência.' }, { criterion: 'Síntese', emerging: 'Mistura fontes sem atribuição.', developing: 'Compara um aspecto após orientação.', proficient: 'Atribui afirmações e conclui proporcionalmente às evidências.' }] },
    accessibilitySupports: ['Oferecer fontes em texto ampliado, áudio, descrição de imagem ou transcrição, mantendo visíveis autoria e data.', 'Permitir quadro, mapa visual, resposta oral ou escrita e fornecer vocabulário de apoio para procedência, evidência e limite.'],
    remediations: [{ errorFocus: 'Confundir fonte, acontecimento e hipótese.', action: 'Preencha três colunas separadas: o que a fonte mostra, o que o acontecimento sugere e o que ainda é hipótese.' }, { errorFocus: 'Tratar toda fonte como prova completa.', action: 'Registre quem produziu a fonte, quando e para qual público antes de indicar o que ela pode ou não sustentar.' }, { errorFocus: 'Combinar duas fontes sem comparar o mesmo aspecto.', action: 'Escolha um aspecto comum às fontes e compare apenas as informações que tratam desse recorte.' }],
  },
  EF03HI03: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-local-perspectives.json',
    notes: ['Atividade diferencia perspectivas situadas sem tratar grupos como homogêneos.', 'Exemplo e recuperação foram alinhados à comparação de pontos de vista.'],
    example: 'Exemplo hipotético: uma associação chama a abertura de uma praça de conquista, enquanto uma comerciante relata dificuldade temporária de acesso. Compare o que cada fonte destaca, seu lugar de fala e o recorte; não transforme nenhuma experiência em opinião de todo um grupo.',
    activity: { title: 'Comparar perspectivas sobre um acontecimento', context: 'Dois relatos didáticos ou públicos com perspectivas distintas sobre o mesmo acontecimento local.', steps: ['Leia os relatos e identifique autoria, posição, público e informação que cada um destaca.', 'Compare um aspecto comum e marque convergências, divergências e elementos ausentes.', 'Escreva uma síntese que atribua cada ponto de vista à sua fonte e reconheça diferenças internas.'], evidence: 'Quadro de perspectivas com atribuição das afirmações, comparação do mesmo aspecto e síntese sem generalização.', rubric: [{ criterion: 'Atribuição de perspectiva', emerging: 'Apresenta opinião como fato sem indicar autoria.', developing: 'Identifica uma perspectiva com apoio.', proficient: 'Relaciona cada perspectiva à fonte e ao contexto disponível.' }, { criterion: 'Comparação', emerging: 'Declara uma fonte correta sem comparar.', developing: 'Aponta semelhança ou diferença com apoio.', proficient: 'Compara o mesmo aspecto e distingue divergência de contradição.' }, { criterion: 'Pluralidade', emerging: 'Trata um grupo como homogêneo.', developing: 'Reconhece uma diferença após mediação.', proficient: 'Limita a conclusão e reconhece que uma fonte não representa todas as pessoas.' }] },
    accessibilitySupports: ['Disponibilizar relatos em formatos equivalentes, com autoria claramente identificada e linguagem acessível.', 'Permitir organizador gráfico, resposta oral ou escrita e tempo para releitura; não solicitar que estudantes revelem sua posição pessoal.'],
    remediations: [{ errorFocus: 'Confundir perspectiva com verdade absoluta.', action: 'Atribua cada afirmação à sua fonte e identifique qual evidência poderia confirmá-la ou limitá-la.' }, { errorFocus: 'Tratar um grupo social como se todos compartilhassem a mesma experiência.', action: 'Reescreva a síntese com referência às fontes específicas e registre quem não está representado.' }, { errorFocus: 'Interpretar diferenças de relato como contradição automática.', action: 'Compare data, lugar e aspecto descrito antes de decidir se os relatos divergem ou tratam de recortes diferentes.' }],
  },
  EF03HI04: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-local-heritage.json',
    notes: ['Exemplo e prática agora investigam razões e vozes envolvidas no reconhecimento de patrimônio.', 'Mantida a distinção entre conteúdo autoral e vínculo canônico não reivindicado.'],
    example: 'Exemplo hipotético: um antigo mercado conserva a fachada e também aparece em relatos de trabalhadores e moradores. A investigação pode comparar valor arquitetônico, usos e memórias, sem presumir que apenas um bem oficialmente protegido seja patrimônio para todos.',
    activity: { title: 'Investigar reconhecimento e sentidos do patrimônio', context: 'Caso didático ou fonte pública sobre um bem, espaço ou prática cultural local.', steps: ['Escolha um caso documentado e identifique que fonte registra sua história, uso ou reconhecimento.', 'Compare duas razões para sua importância e registre quais pessoas ou grupos aparecem nas fontes.', 'Proponha uma forma de cuidado ou documentação e indique que vozes ainda precisam ser consultadas.'], evidence: 'Dossiê breve com fontes, razões de reconhecimento, diversidade de vozes e uma lacuna de consulta.', rubric: [{ criterion: 'Fontes e razões', emerging: 'Chama algo de patrimônio sem justificar.', developing: 'Aponta uma razão com apoio.', proficient: 'Relaciona razões culturais, sociais ou históricas a fontes específicas.' }, { criterion: 'Vozes e reconhecimento', emerging: 'Supõe consenso ou representação completa.', developing: 'Identifica algumas vozes após orientação.', proficient: 'Indica quem aparece, quem falta e que limites existem.' }, { criterion: 'Cuidado e documentação', emerging: 'Propõe ação sem considerar contexto.', developing: 'Propõe cuidado com apoio.', proficient: 'Propõe ação respeitosa e proporcional às evidências e às pessoas envolvidas.' }] },
    accessibilitySupports: ['Fornecer imagens descritas, relatos transcritos e fontes curtas em formatos legíveis, sem exigir visita a locais.', 'Aceitar mapa de ideias, fala, desenho ou texto e permitir análise de caso fictício quando acesso físico não for possível.'],
    remediations: [{ errorFocus: 'Considerar patrimônio apenas o que é antigo ou tombado.', action: 'Compare registros oficiais com relatos de usos e memórias, distinguindo critérios em vez de escolher uma única definição.' }, { errorFocus: 'Supor que uma fonte representa todas as pessoas da comunidade.', action: 'Liste quem produziu cada fonte e formule uma pergunta de consulta para uma voz ainda ausente.' }, { errorFocus: 'Propor preservação sem considerar usos e cuidado das pessoas envolvidas.', action: 'Relacione a proposta a uma evidência e indique quem deve participar da decisão.' }],
  },
  EF03HI05: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-local-landmarks.json',
    notes: ['Exemplo distingue marco histórico de objeto antigo e apresenta significado situado.', 'Atividade agora pede fonte, contexto, interpretação e limite.'],
    example: 'Exemplo hipotético: uma placa registra a abertura de uma escola em certo ano. Ela pode ser um marco para investigar mudanças no acesso à educação, mas a placa, sozinha, não informa quem frequentava a escola nem como diferentes pessoas viveram aquele período.',
    activity: { title: 'Interpretar um marco histórico com fontes', context: 'Placa, edifício, registro ou caso didático fornecido pelo professor, sem exigir deslocamento ou coleta de endereço.', steps: ['Identifique o marco e registre o lugar e o período informados pela fonte.', 'Compare seu significado declarado com outra fonte ou relato que amplie o contexto.', 'Explique por que pode ser considerado marco e registre o que ainda não é possível afirmar.'], evidence: 'Ficha de interpretação com identificação, fonte, significado sustentado e limite explícito.', rubric: [{ criterion: 'Identificação e contexto', emerging: 'Chama qualquer objeto antigo de marco.', developing: 'Identifica um marco com apoio.', proficient: 'Relaciona o marco a evento, período e fonte.' }, { criterion: 'Significado', emerging: 'Atribui sentido sem evidência.', developing: 'Aponta um significado documentado.', proficient: 'Compara significados situados e atribui cada um à fonte.' }, { criterion: 'Limite', emerging: 'Generaliza a partir de uma placa ou objeto.', developing: 'Reconhece uma lacuna após mediação.', proficient: 'Distingue o que a fonte informa do que permanece desconhecido.' }] },
    accessibilitySupports: ['Oferecer descrição textual e visual do marco, fonte em formato acessível e glossário de período, registro e significado.', 'Permitir resposta em ficha visual, áudio, desenho ou texto e usar casos didáticos sem exigir visita ou localização real.'],
    remediations: [{ errorFocus: 'Confundir objeto antigo com marco histórico.', action: 'Procure a relação documentada entre o objeto, um acontecimento, um período e seu significado para a pergunta.' }, { errorFocus: 'Atribuir um único significado a todas as pessoas.', action: 'Compare duas fontes situadas e marque qual grupo ou autoria sustenta cada interpretação.' }, { errorFocus: 'Concluir que uma placa descreve toda a experiência histórica.', action: 'Registre uma informação que a placa fornece e outra que exigiria fonte adicional.' }],
  },
  EF03HI06: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-memory-records.json',
    notes: ['Atividade analisa seleção e ausência em registros de memória.', 'Acrescentados apoios de acesso e recuperação sobre autoria, escolha e representação.'],
    example: 'Exemplo hipotético: um conselho escolhe nomes para duas ruas e a ata explica critérios usados. A ata documenta a decisão e seus autores, mas não prova que todos concordaram nem reúne todas as memórias relacionadas ao lugar.',
    activity: { title: 'Analisar registros públicos de memória', context: 'Ata, placa, nome de espaço ou fonte didática sobre uma decisão de memória pública.', steps: ['Identifique quem produziu ou escolheu o registro e quando essa decisão ocorreu.', 'Compare o registro com outra fonte que apresente uso, memória ou perspectiva diferente.', 'Descreva o que foi preservado, o que ficou ausente e que consulta respeitosa poderia ampliar o registro.'], evidence: 'Registro comparativo que atribui a decisão à fonte e explicita presença, ausência e limite sem presumir consenso.', rubric: [{ criterion: 'Autoria e escolha', emerging: 'Trata o registro como espontâneo ou neutro.', developing: 'Identifica autores com apoio.', proficient: 'Explica quem selecionou o registro e quais critérios aparecem.' }, { criterion: 'Memória e ausência', emerging: 'Supõe que o registro representa todos.', developing: 'Nomeia uma ausência após orientação.', proficient: 'Distingue memória registrada, grupos representados e lacunas.' }, { criterion: 'Consulta e respeito', emerging: 'Propõe exposição de relatos pessoais sem cuidado.', developing: 'Sugere outra fonte com apoio.', proficient: 'Propõe consulta voluntária, pública e respeitosa, sem pressionar pessoas.' }] },
    accessibilitySupports: ['Disponibilizar transcrição, áudio, fonte em alto contraste e quadro para autoria, decisão e período.', 'Permitir resposta por diagrama, fala, texto ou cartões e trabalhar com exemplos públicos ou fictícios, sem coletar memórias pessoais.'],
    remediations: [{ errorFocus: 'Tratar um registro de memória como representação completa de uma comunidade.', action: 'Separe quem aparece no registro de quem poderia estar ausente e formule uma pergunta de pesquisa sem presumir resposta.' }, { errorFocus: 'Confundir a data do registro com a data do acontecimento lembrado.', action: 'Marque em colunas diferentes quando ocorreu o acontecimento e quando o registro foi produzido.' }, { errorFocus: 'Supor consenso sobre monumentos ou nomes públicos.', action: 'Identifique a fonte da decisão e procure evidência de participação ou de divergência antes de afirmar consenso.' }],
  },
  EF03HI07: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-community-comparisons.json',
    notes: ['Atividade compara práticas comunitárias sem estereotipar ou homogeneizar grupos.', 'Exemplo passa a distinguir contexto, semelhanças e diferenças internas.'],
    example: 'Exemplo hipotético: duas comunidades usam a mesma praça, mas organizam feira, leitura ou esporte em horários diferentes. A comparação pode descrever usos documentados sem afirmar que todos os moradores participam ou pensam da mesma maneira.',
    activity: { title: 'Comparar comunidades sem generalizar', context: 'Dois estudos de caso didáticos, fontes públicas ou registros autorizados sobre comunidades distintas.', steps: ['Defina um aspecto comum a comparar e identifique lugar, período e autoria de cada fonte.', 'Registre semelhanças e diferenças apoiadas nas fontes, incluindo variações dentro de cada comunidade quando disponíveis.', 'Escreva uma síntese que preserve contexto e indique o que as fontes não permitem generalizar.'], evidence: 'Quadro comparativo com recorte explícito, evidências atribuídas e limites de representação.', rubric: [{ criterion: 'Recorte comparativo', emerging: 'Compara comunidades sem definir aspecto ou período.', developing: 'Define um aspecto com apoio.', proficient: 'Compara o mesmo aspecto em contextos identificados.' }, { criterion: 'Diversidade interna', emerging: 'Generaliza uma prática a todos os membros.', developing: 'Reconhece variação com mediação.', proficient: 'Evita homogeneização e usa evidência para descrever variações.' }, { criterion: 'Síntese', emerging: 'Atribui valor superior a uma comunidade.', developing: 'Registra diferença sem hierarquia após orientação.', proficient: 'Explica semelhanças e diferenças sem ranking e explicita limites.' }] },
    accessibilitySupports: ['Apresentar os casos em fontes equivalentes e acessíveis, com legenda de lugar, período e autoria.', 'Permitir tabela visual, cartões, áudio ou resposta escrita; não pedir que estudantes representem ou falem em nome de comunidades.'],
    remediations: [{ errorFocus: 'Generalizar uma prática observada para toda a comunidade.', action: 'Acrescente o recorte de lugar, período e fonte e reescreva a conclusão sem quantificadores absolutos não sustentados.' }, { errorFocus: 'Comparar comunidades por um critério implícito ou desigual.', action: 'Escolha o mesmo aspecto para os dois casos e indique quais informações faltam para uma comparação justa.' }, { errorFocus: 'Tratar diferença cultural como hierarquia.', action: 'Descreva a função contextual de cada prática sem classificar uma como melhor ou mais desenvolvida.' }],
  },
  EF03HI08: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-city-country-life.json',
    notes: ['Atividade compara modos de vida sem representar cidade e campo como opostos fixos.', 'Exemplo e critérios foram ligados a fontes e condições de vida situadas.'],
    example: 'Exemplo hipotético: uma fonte descreve uma horta próxima à cidade e outra mostra o transporte de alimentos entre áreas rurais e urbanas. A comparação pode investigar relações e mudanças sem afirmar que todo trabalho rural ou urbano é igual.',
    activity: { title: 'Comparar modos de vida em diferentes contextos', context: 'Fontes históricas ou atuais sobre práticas urbanas e rurais em períodos identificados.', steps: ['Escolha uma prática documentada e identifique lugar, período, autoria e condições descritas.', 'Compare fontes sobre cidade e campo no mesmo aspecto e registre relações, mudanças e permanências.', 'Produza síntese que evite opor os contextos como se fossem uniformes e indique limites das fontes.'], evidence: 'Comparação contextualizada que descreve prática, relação entre espaços, mudança ou permanência e limite documental.', rubric: [{ criterion: 'Contexto', emerging: 'Apresenta cidade ou campo como cenário genérico.', developing: 'Localiza uma prática com apoio.', proficient: 'Identifica período, lugar e condições de vida relevantes.' }, { criterion: 'Mudança e relação', emerging: 'Trata os contextos como opostos fixos.', developing: 'Aponta uma relação com apoio.', proficient: 'Compara mudanças, permanências e conexões sustentadas.' }, { criterion: 'Diversidade', emerging: 'Generaliza uma fonte para todas as pessoas.', developing: 'Limita a conclusão após orientação.', proficient: 'Reconhece variação interna e limita afirmações ao recorte.' }] },
    accessibilitySupports: ['Oferecer imagens descritas, mapas acessíveis e fontes em formatos equivalentes, com lugar e período visíveis.', 'Permitir quadro comparativo, fala, desenho ou texto e evitar pressupor experiência pessoal urbana ou rural.'],
    remediations: [{ errorFocus: 'Tratar cidade e campo como realidades opostas e imutáveis.', action: 'Procure uma conexão entre os contextos e compare a prática no período e lugar indicados pela fonte.' }, { errorFocus: 'Usar uma imagem como retrato de todas as pessoas de um período.', action: 'Identifique o recorte da imagem e liste uma informação que exigiria fonte adicional.' }, { errorFocus: 'Hierarquizar modos de vida sem evidência.', action: 'Reescreva a comparação em termos de práticas, recursos e condições observáveis, sem usar ranking.' }],
  },
  EF03HI09: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-public-spaces-map.json',
    notes: ['Atividade produz mapa funcional com legenda e limite, sem coletar endereços residenciais.', 'Acessibilidade e recuperação incluem diferentes formas de orientação espacial.'],
    example: 'Exemplo hipotético: um mapa escolar usa símbolos distintos para praça, escola e unidade de saúde. A legenda ajuda a interpretar funções, mas o mapa não informa sozinho horários, acessibilidade de todas as entradas ou a experiência de quem usa cada lugar.',
    activity: { title: 'Mapear espaços públicos e suas funções', context: 'Mapa público simplificado ou planta didática autorizada, sem endereços residenciais nem trajetos pessoais.', steps: ['Escolha um mapa autorizado e identifique escala, legenda, fonte e data quando disponíveis.', 'Marque espaços públicos e descreva suas funções usando os símbolos de forma consistente.', 'Registre uma informação de acessibilidade observável e um limite do mapa, sem inferir dados não representados.'], evidence: 'Mapa com legenda e fonte, espaços públicos classificados por função, nota de acessibilidade e limite explícito.', rubric: [{ criterion: 'Leitura cartográfica', emerging: 'Marca pontos sem usar legenda.', developing: 'Usa alguns símbolos com apoio.', proficient: 'Aplica legenda e referência espacial de modo consistente.' }, { criterion: 'Funções públicas', emerging: 'Confunde local e função.', developing: 'Nomeia funções com apoio.', proficient: 'Relaciona espaços a funções documentadas.' }, { criterion: 'Acessibilidade e limites', emerging: 'Afirma acesso sem evidência.', developing: 'Registra uma condição observada.', proficient: 'Distingue observação, fonte e dado ausente, protegendo informações pessoais.' }] },
    accessibilitySupports: ['Fornecer mapa de alto contraste, símbolos táteis ou ampliados e descrição verbal das relações espaciais.', 'Permitir uso de mapa digital acessível, modelo físico ou resposta oral; não solicitar endereço de casa ou rota individual.'],
    remediations: [{ errorFocus: 'Ler símbolos sem consultar a legenda.', action: 'Compare cada símbolo à legenda e confirme uma função na fonte antes de classificar o espaço.' }, { errorFocus: 'Confundir localização com função do espaço.', action: 'Registre separadamente onde o espaço aparece e qual função a fonte ou sinalização informa.' }, { errorFocus: 'Inferir acessibilidade completa a partir de um mapa simples.', action: 'Marque o que está representado, o que foi observado e o que precisaria de verificação adicional.' }],
  },
  EF03HI10: {
    file: 'content/adaptive/tec-escola-core-v5/v13-history-space-distinctions.json',
    notes: ['Atividade diferencia espaço doméstico, público e área de conservação por regras e funções.', 'Exemplo preserva o caráter contextual do acesso e das normas.'],
    example: 'Exemplo hipotético: uma casa tem áreas de uso doméstico; uma praça é espaço público com regras de convivência; uma área de conservação pode ter visitação regulada para proteger espécies e ambientes. A classificação depende de função, regime de acesso e normas, não apenas de estar ao ar livre.',
    activity: { title: 'Distinguir espaços, funções e regras de uso', context: 'Cartões de lugares fictícios e fontes públicas sobre uso, acesso e conservação.', steps: ['Classifique cada caso com base em função, acesso e regra documentada, não apenas na aparência.', 'Compare um espaço doméstico, um público e uma área de conservação e registre quem define ou aplica suas regras.', 'Justifique uma decisão de cuidado e indique quando as fontes não permitem concluir quem pode acessar.'], evidence: 'Quadro de classificação com função, regra, tipo de espaço e fonte ou limite de cada decisão.', rubric: [{ criterion: 'Classificação', emerging: 'Classifica pelo aspecto visual apenas.', developing: 'Usa função ou acesso com apoio.', proficient: 'Considera função, acesso e regra documentada.' }, { criterion: 'Regras e cuidado', emerging: 'Confunde uso público com entrada irrestrita.', developing: 'Identifica uma regra com apoio.', proficient: 'Relaciona regra à finalidade e ao cuidado do espaço.' }, { criterion: 'Evidência', emerging: 'Apresenta conclusão sem fonte.', developing: 'Aponta fonte após orientação.', proficient: 'Atribui a regra à fonte e explicita lacunas.' }] },
    accessibilitySupports: ['Apresentar casos por texto, imagem descrita, símbolos ou áudio e deixar claras as regras relevantes em linguagem direta.', 'Aceitar classificação em tabela, cartões, áudio ou texto; não pressupor acesso físico a espaços ou experiência prévia.'],
    remediations: [{ errorFocus: 'Tratar todo espaço aberto como público.', action: 'Verifique finalidade, propriedade ou gestão e regra de acesso antes de classificar o caso.' }, { errorFocus: 'Confundir direito de uso coletivo com entrada irrestrita.', action: 'Localize a regra de acesso e explique como ela se relaciona à função do espaço.' }, { errorFocus: 'Ignorar a finalidade de conservação ambiental.', action: 'Identifique qual ambiente ou bem a regra pretende proteger e relacione a conclusão à fonte.' }],
  },
  EF03HI11: {
    file: 'content/adaptive/tec-escola-core-v5/v14-history-work-technology.json',
    notes: ['Atividade compara tarefas e tecnologias sem hierarquizar campo e cidade nem reduzir tecnologia a aparelhos digitais.', 'Critérios agora observam saberes, organização e evidências.'],
    example: 'Exemplo hipotético: uma pessoa usa ferramenta manual em uma horta e outra usa sistema de refrigeração em um centro de distribuição. A análise pode comparar tarefas, saberes, organização e efeitos da tecnologia, sem concluir que uma atividade é mais simples ou mais avançada.',
    activity: { title: 'Comparar trabalho, ferramentas e tecnologias', context: 'Casos didáticos ou fontes públicas sobre atividades de trabalho em contextos urbanos e rurais.', steps: ['Identifique tarefa, contexto, ferramenta ou tecnologia e fonte de cada caso.', 'Compare como ferramentas, organização e saberes participam do trabalho, registrando semelhanças e diferenças.', 'Explique um efeito documentado e evite atribuir valor ou eliminar o papel das pessoas sem evidência.'], evidence: 'Matriz comparativa que relaciona tarefa, tecnologia, saberes, contexto e efeito observado.', rubric: [{ criterion: 'Descrição do trabalho', emerging: 'Nomeia local sem descrever a tarefa.', developing: 'Descreve tarefa com apoio.', proficient: 'Relaciona tarefa, organização e saberes indicados pela fonte.' }, { criterion: 'Tecnologia', emerging: 'Considera apenas aparelho eletrônico.', developing: 'Identifica ferramenta ou processo.', proficient: 'Explica como ferramenta ou processo modifica ou apoia a tarefa.' }, { criterion: 'Comparação responsável', emerging: 'Hierarquiza cidade e campo sem evidência.', developing: 'Compara um aspecto com apoio.', proficient: 'Compara contextos sem hierarquia e limita conclusões às fontes.' }] },
    accessibilitySupports: ['Fornecer descrições de ferramentas e processos em áudio, texto ampliado ou imagens com legenda.', 'Permitir matriz visual, fala, desenho ou texto; não exigir acesso a local de trabalho nem presumir experiências laborais familiares.'],
    remediations: [{ errorFocus: 'Reduzir tecnologia a aparelhos eletrônicos.', action: 'Liste ferramentas, técnicas e sistemas usados na tarefa e verifique quais aparecem na fonte.' }, { errorFocus: 'Concluir que uma ferramenta substituiu todo o trabalho humano.', action: 'Separe a tarefa modificada das decisões, saberes e atividades que a fonte ainda atribui às pessoas.' }, { errorFocus: 'Tratar cidade e campo como categorias de trabalho homogêneas.', action: 'Acrescente o contexto específico e compare tarefas concretas em vez de generalizar sobre o lugar.' }],
  },
  EF03HI12: {
    file: 'content/adaptive/tec-escola-core-v5/v14-history-work-leisure-change.json',
    notes: ['Atividade distingue mudanças e permanências em trabalho e lazer a partir de fontes de tempos e espaços definidos.', 'Exemplo explicita que mudanças não beneficiam todos da mesma forma.'],
    example: 'Exemplo hipotético: uma fotografia antiga registra trabalhadores em um domingo e uma fonte atual descreve o uso de um parque. A comparação pode investigar horários e acesso ao lazer, mas exige outras fontes para afirmar como as condições mudaram para diferentes grupos.',
    activity: { title: 'Comparar trabalho e lazer em tempos distintos', context: 'Fontes didáticas ou públicas de dois períodos e espaços identificados sobre trabalho ou lazer.', steps: ['Identifique período, lugar, autoria e grupo retratado em cada fonte.', 'Compare um aspecto de trabalho e/ou lazer e registre mudanças e permanências sustentadas.', 'Considere condições de acesso e indique quem ou que período não está representado.'], evidence: 'Quadro temporal com fontes atribuídas, mudança, permanência, condições de acesso e limite documental.', rubric: [{ criterion: 'Contexto temporal', emerging: 'Compara passado e presente sem identificar períodos.', developing: 'Localiza os períodos com apoio.', proficient: 'Usa período e espaço para contextualizar cada fonte.' }, { criterion: 'Mudança e permanência', emerging: 'Supõe que tudo mudou ou permaneceu igual.', developing: 'Identifica um aspecto com apoio.', proficient: 'Distingue mudança e permanência apoiadas nas fontes.' }, { criterion: 'Acesso e diversidade', emerging: 'Generaliza a experiência de um grupo.', developing: 'Reconhece uma diferença após mediação.', proficient: 'Considera condições de acesso e limita a conclusão aos grupos documentados.' }] },
    accessibilitySupports: ['Oferecer linha do tempo visual e fontes em formatos equivalentes com data, lugar e autoria destacados.', 'Permitir síntese oral, escrita ou visual e disponibilizar vocabulário de apoio sem solicitar relatos pessoais ou familiares.'],
    remediations: [{ errorFocus: 'Imaginar que todas as pessoas viveram o passado da mesma maneira.', action: 'Identifique quem aparece em cada fonte e limite a descrição ao grupo e período documentados.' }, { errorFocus: 'Tratar uma mudança tecnológica como benefício igual para todos.', action: 'Compare condições de acesso nos dois períodos e registre quais grupos ou evidências ainda faltam.' }, { errorFocus: 'Confundir mudança de cenário com mudança comprovada nas relações de trabalho ou lazer.', action: 'Escolha um aspecto comum às fontes e compare evidências desse aspecto antes de concluir.' }],
  },
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function applyRecipe(code, pack, source, recipe) {
  const sourceContext = pack.sourceContext ?? {};
  pack.sourceContext = {
    ...sourceContext,
    officialCode: code,
    sourceVerificationRecord: source.verificationId,
    sourceStatus: source.technicalVerificationStatus,
    descriptor: source.descriptor,
    officialSource: source.officialSource,
    relation: sourceContext.relation ?? 'AUTHORING_CONTEXT_ONLY',
    mappingStatus: sourceContext.mappingStatus ?? 'CANONICAL_GAP',
  };
  pack.active = false;
  pack.publicationStatus = 'STAGING_INACTIVE';
  pack.pedagogicalReviewStatus = 'PEDAGOGICAL_REVIEW_PENDING';
  pack.officialMappingStatus = 'NOT_CLAIMED';

  const lesson = pack.lesson;
  if (recipe.explanation) lesson.explanation = [lesson.progressiveExplanation, recipe.explanation].filter((part) => typeof part === 'string' && part.trim()).join('\n\n');
  else if (!lesson.explanation && typeof lesson.progressiveExplanation === 'string') lesson.explanation = lesson.progressiveExplanation;
  if (recipe.commonMistake) lesson.commonMistake = recipe.commonMistake;
  const phaseCounts = new Map();
  const phaseByName = new Map();
  for (const phase of lesson.progression ?? []) {
    const mapped = PHASE_BY_STAGE[phase.phase ?? phase.stage];
    if (!mapped) throw new Error(`${code}_UNKNOWN_PROGRESS_STAGE:${phase.phase ?? phase.stage}`);
    phase.phase = mapped;
    phase.questionIds = [];
    phaseByName.set(mapped, phase);
    phaseCounts.set(mapped, (phaseCounts.get(mapped) ?? 0) + 1);
  }
  if (phaseCounts.size !== 5 || [...phaseCounts.values()].some((count) => count !== 1)) throw new Error(`${code}_PROGRESSION_PHASES_INCOMPLETE`);
  for (const question of pack.questions ?? []) {
    const phase = phaseByName.get(question.purpose);
    if (!phase) throw new Error(`${code}_QUESTION_PURPOSE_NOT_MAPPED:${question.id}:${question.purpose}`);
    phase.questionIds.push(question.id);
  }

  const activities = lesson.authenticActivities ?? [];
  if (!activities.length) throw new Error(`${code}_ACTIVITY_MISSING`);
  for (const [index, activity] of activities.entries()) {
    const authored = index === 0 ? recipe.activity : recipe.additionalActivities?.[index - 1];
    if (!authored) continue;
    Object.assign(activity, authored);
    activity.instructions = authored.steps.join(' ');
  }
  if (recipe.example && !String(lesson.workedExample ?? '').includes(recipe.example)) {
    lesson.workedExample = [lesson.workedExample, recipe.example].filter(Boolean).join('\n\n');
  }
  lesson.accessibilitySupports = recipe.accessibilitySupports;
  const previousRemediations = lesson.remediations ?? [];
  lesson.remediations = previousRemediations.map((item, index) => {
    const authored = recipe.remediations[index % recipe.remediations.length];
    return { ...item, errorFocus: authored.errorFocus, action: authored.action };
  });

  if (code === 'EF01CI01') {
    for (const [index, question] of pack.questions.entries()) {
      const options = [...question.options];
      const correctIndex = options.indexOf(question.correctAnswer);
      if (correctIndex < 0) throw new Error(`${code}_ANSWER_NOT_IN_OPTIONS:${question.id}`);
      const answer = options.splice(correctIndex, 1)[0];
      options.splice(index % 4, 0, answer);
      question.options = options;
    }
  }
}

export function repairLegacyAuthoringPackages({ checkOnly = false } = {}) {
  const queue = readJson(QUEUE_PATH);
  const sourceVerification = readJson(SOURCE_PATH);
  const previousReport = fs.existsSync(path.join(ROOT, REPORT_PATH)) ? readJson(REPORT_PATH) : null;
  const previousByCode = new Map((previousReport?.packages ?? []).map((item) => [item.officialCode, item]));
  const sourceByCode = new Map((sourceVerification.records ?? []).map((record) => [record.officialCode, record]));
  const taskByCode = new Map((queue.tasks ?? []).map((task) => [task.officialCode, task]));
  const report = {
    schemaVersion: 'tec-escola.bncc.legacy-package-recovery.v1',
    campaign: 'TECESCOLA_BNCC_AUTOPILOT_RECOVERY_AND_SCALE',
    snapshotDate: previousReport?.snapshotDate ?? new Date().toISOString().slice(0, 10),
    rubricVersion: 'tec-escola.bncc.technical-completeness.v2',
    humanApprovalGranted: false,
    publicationAuthorized: false,
    packages: [],
  };

  for (const [code, recipe] of Object.entries(RECIPES)) {
    const task = taskByCode.get(code);
    const queueArtifact = task?.evidence?.stagedPackages?.find((item) => item.file === recipe.file);
    if (!queueArtifact) throw new Error(`${code}_NOT_PRESENT_AS_STAGED_LEGACY_PACKAGE`);
    const source = sourceByCode.get(code);
    if (!source || source.technicalVerificationStatus !== 'OFFICIAL_SOURCE_VERIFIED_EXACT') throw new Error(`${code}_EXACT_OFFICIAL_SOURCE_REQUIRED`);
    const pack = readJson(recipe.file);
    const before = evaluateCurriculumPackageRubric(pack, { requirements: task.requirements, officialSourceRecord: source });
    applyRecipe(code, pack, source, recipe);
    const after = evaluateCurriculumPackageRubric(pack, { requirements: task.requirements, officialSourceRecord: source });
    if (!checkOnly) writeJson(recipe.file, pack);
    report.packages.push({
      officialCode: code,
      file: recipe.file,
      status: after.status,
      beforeIncompleteChecks: previousByCode.get(code)?.beforeIncompleteChecks ?? before.incomplete,
      afterIncompleteChecks: after.incomplete,
      repairNotes: recipe.notes,
      questionCount: pack.questions?.length ?? 0,
      active: pack.active,
      publicationStatus: pack.publicationStatus,
      officialMappingStatus: pack.officialMappingStatus,
      humanPedagogicalReviewStatus: after.humanPedagogicalApprovalStatus,
    });
    console.log(`${code} ${checkOnly ? 'CHECKED' : 'REPAIRED'} ${after.status} remaining=${after.incomplete.join(',') || 'none'} questions=${pack.questions?.length ?? 0}`);
  }

  report.packages.sort((left, right) => left.officialCode.localeCompare(right.officialCode));
  if (!checkOnly) writeJson(REPORT_PATH, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  repairLegacyAuthoringPackages({ checkOnly: process.argv.includes('--check') });
}
