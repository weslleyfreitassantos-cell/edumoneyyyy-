export interface V3AuthoredContentRow {
  id: string;
  subject: string;
  domain: string;
  targetSkill: string;
  topic: string;
  statement: string;
  options: readonly string[];
  correctAnswer: string;
  explanation: string;
  misconception: { option: string; code: string; confidenceWeight: number };
  secondaryLinks: readonly { skillCode: string; role: 'SUPPORTING' | 'PREREQUISITE' | 'TRANSFER'; evidenceBearing: boolean; attributionConfidence: number }[];
}

export const V3_AUTHORED_CONTENT: Readonly<Record<string, readonly V3AuthoredContentRow[]>> = {
  "PORTUGUESE": [
    {
      "id": "v3-portuguese-reading_argument-1",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "editorial e tese",
      "statement": "Um editorial defende a ampliacao de bibliotecas de bairro e apresenta dados de emprestimos. Qual e a tese central?",
      "options": [
        "Bibliotecas de bairro ampliam o acesso a leitura.",
        "Todo livro deve ser digital.",
        "Emprestimos substituem escolas.",
        "Dados de emprestimos nao podem ser usados."
      ],
      "correctAnswer": "Bibliotecas de bairro ampliam o acesso a leitura.",
      "explanation": "A tese e a ideia que o editorial procura sustentar com os dados.",
      "misconception": {
        "option": "Todo livro deve ser digital.",
        "code": "THESIS_CONFUSED_WITH_DETAIL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-2",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "noticia e fato",
      "statement": "Uma noticia informa que a escola abriu uma horta e cita data, local e numero de mudas. Qual trecho funciona como informacao verificavel?",
      "options": [
        "A horta foi aberta na segunda-feira.",
        "A horta e a mais bonita da cidade.",
        "Todos adoraram a iniciativa.",
        "A medida vai mudar o mundo."
      ],
      "correctAnswer": "A horta foi aberta na segunda-feira.",
      "explanation": "Data e local podem ser conferidos; os demais trechos sao avaliacao ou previsao.",
      "misconception": {
        "option": "A horta e a mais bonita da cidade.",
        "code": "FACT_CONFUSED_WITH_OPINION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-3",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "campanha de leitura",
      "statement": "Uma campanha apresenta o slogan Leia dez minutos por dia e uma imagem de estudantes lendo. Qual recurso reforca o argumento?",
      "options": [
        "O slogan transforma a proposta em uma acao concreta.",
        "A imagem prova que todos gostam de ler.",
        "O slogan elimina a necessidade de livros.",
        "A imagem substitui os dados da campanha."
      ],
      "correctAnswer": "O slogan transforma a proposta em uma acao concreta.",
      "explanation": "O slogan traduz a tese em uma pratica simples sem provar mais do que afirma.",
      "misconception": {
        "option": "A imagem prova que todos gostam de ler.",
        "code": "SLOGAN_TREATED_AS_PROOF",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-4",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "carta de opiniao",
      "statement": "Na carta, Joana afirma que o recreio deve ter mais arvores porque a sombra reduz o calor. Qual evidencia apoia melhor a conclusao?",
      "options": [
        "Medidas de temperatura com e sem sombra.",
        "A cor preferida dos estudantes.",
        "O numero de cartazes no patio.",
        "A opiniao de um estudante sobre musica."
      ],
      "correctAnswer": "Medidas de temperatura com e sem sombra.",
      "explanation": "A evidencia mede diretamente a relacao entre sombra e temperatura.",
      "misconception": {
        "option": "A cor preferida dos estudantes.",
        "code": "UNRELATED_EVIDENCE_USED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-5",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "comparacao de fontes",
      "statement": "Duas fontes descrevem a mesma feira: uma e da organizacao e outra de um jornal. O que uma leitura critica deve fazer?",
      "options": [
        "Comparar perspectivas e evidencias das duas fontes.",
        "Escolher a fonte mais curta.",
        "Aceitar apenas a fonte com fotografia.",
        "Somar todas as opinioes como fatos."
      ],
      "correctAnswer": "Comparar perspectivas e evidencias das duas fontes.",
      "explanation": "Fontes podem ter finalidades diferentes; a comparacao ajuda a avaliar seus recortes.",
      "misconception": {
        "option": "Escolher a fonte mais curta.",
        "code": "SOURCE_AUTHORITY_REPLACES_COMPARISON",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-6",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "inferencia no conto",
      "statement": "No conto, o personagem guarda o guarda-chuva mesmo com o ceu aberto e olha varias vezes para a janela. Que inferencia e sustentada?",
      "options": [
        "Ele espera uma mudanca no tempo ou alguem chegar.",
        "Ele certamente perdeu a chave.",
        "Ele nunca saiu de casa.",
        "A janela esta quebrada."
      ],
      "correctAnswer": "Ele espera uma mudanca no tempo ou alguem chegar.",
      "explanation": "A inferencia combina os sinais do comportamento sem afirmar uma causa que o texto nao apresenta.",
      "misconception": {
        "option": "Ele certamente perdeu a chave.",
        "code": "INFERENCE_TREATED_AS_CERTAINTY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-7",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "argumento e razao",
      "statement": "Uma proposta diz que o laboratorio deve abrir a tarde porque a procura por esse horario dobrou. Qual e a razao apresentada?",
      "options": [
        "O aumento da procura pelo horario da tarde.",
        "A cor das paredes do laboratorio.",
        "A existencia de outros laboratorios.",
        "A preferencia do autor por ciencias."
      ],
      "correctAnswer": "O aumento da procura pelo horario da tarde.",
      "explanation": "A razao e o dado usado para apoiar a proposta.",
      "misconception": {
        "option": "A cor das paredes do laboratorio.",
        "code": "REASON_CONFUSED_WITH_PROPOSAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-8",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "contraponto",
      "statement": "Um texto defende uniformes, mas reconhece que algumas familias teriam custo inicial maior. Qual e a funcao desse trecho?",
      "options": [
        "Apresentar uma dificuldade e abrir espaco para resposta.",
        "Provar que uniformes sao sempre baratos.",
        "Mudar o assunto para transporte.",
        "Encerrar o argumento sem justificativa."
      ],
      "correctAnswer": "Apresentar uma dificuldade e abrir espaco para resposta.",
      "explanation": "O contraponto torna o argumento mais completo porque reconhece uma objecao.",
      "misconception": {
        "option": "Provar que uniformes sao sempre baratos.",
        "code": "COUNTERARGUMENT_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-9",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "anuncio publico",
      "statement": "Um aviso informa que a quadra ficara fechada na quarta para manutencao e indica outro local. Qual e a finalidade principal?",
      "options": [
        "Orientar a comunidade sobre uma mudanca de uso.",
        "Narrar a historia da quadra.",
        "Vender materiais esportivos.",
        "Avaliar o desempenho dos alunos."
      ],
      "correctAnswer": "Orientar a comunidade sobre uma mudanca de uso.",
      "explanation": "Avisos publicos organizam uma acao ou expectativa do leitor.",
      "misconception": {
        "option": "Narrar a historia da quadra.",
        "code": "GENRE_PURPOSE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-10",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "evidencia e conclusao",
      "statement": "Uma pesquisa ouviu 80 alunos de uma turma sobre o horario de estudo. Qual conclusao e mais cuidadosa?",
      "options": [
        "Na turma pesquisada, a maioria prefere estudar no inicio da noite.",
        "Todos os alunos da cidade preferem esse horario.",
        "O horario causa melhores notas.",
        "Nenhum aluno estuda pela manha."
      ],
      "correctAnswer": "Na turma pesquisada, a maioria prefere estudar no inicio da noite.",
      "explanation": "A conclusao respeita a amostra e nao cria causalidade sem evidencia.",
      "misconception": {
        "option": "Todos os alunos da cidade preferem esse horario.",
        "code": "SAMPLE_GENERALIZED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-11",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "linguagem persuasiva",
      "statement": "Um texto usa a expressao juntos podemos transformar o patio e apresenta etapas de plantio. O uso de juntos produz qual efeito?",
      "options": [
        "Convoca o leitor para uma acao coletiva.",
        "Prova que o plantio ja terminou.",
        "Indica que apenas gestores podem agir.",
        "Substitui todas as etapas do plano."
      ],
      "correctAnswer": "Convoca o leitor para uma acao coletiva.",
      "explanation": "A primeira pessoa do plural aproxima leitor e proposta, mas nao prova que a acao ocorreu.",
      "misconception": {
        "option": "Prova que o plantio ja terminou.",
        "code": "PERSUASION_CONFUSED_WITH_EVIDENCE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-portuguese-reading_argument-12",
      "subject": "PORTUGUESE",
      "domain": "ARGUMENTACAO",
      "targetSkill": "READING_ARGUMENT",
      "topic": "sintese argumentativa",
      "statement": "Um texto apresenta problema de descarte, dados de coleta e proposta de pontos de entrega. Qual sintese preserva sua linha argumentativa?",
      "options": [
        "A coleta melhora quando o problema e medido e a comunidade recebe uma alternativa.",
        "O texto apenas descreve lixeiras coloridas.",
        "A proposta elimina a necessidade de coleta.",
        "Os dados mostram que todo descarte e ilegal."
      ],
      "correctAnswer": "A coleta melhora quando o problema e medido e a comunidade recebe uma alternativa.",
      "explanation": "A sintese mantem problema, evidencia e proposta sem acrescentar uma acusacao.",
      "misconception": {
        "option": "O texto apenas descreve lixeiras coloridas.",
        "code": "SUMMARY_ADDS_UNSUPPORTED_CLAIM",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "MATHEMATICS": [
    {
      "id": "v3-mathematics-percentage-1",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "desconto",
      "statement": "Uma mochila custa R$ 240 e recebe 25% de desconto. Qual e o valor do desconto?",
      "options": [
        "R$ 60",
        "R$ 180",
        "R$ 215",
        "R$ 225"
      ],
      "correctAnswer": "R$ 60",
      "explanation": "25% de 240 corresponde a R$ 60.",
      "misconception": {
        "option": "R$ 180",
        "code": "DISCOUNT_CONFUSED_WITH_FINAL_PRICE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-2",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "aumento",
      "statement": "Um ingresso de R$ 80 teve aumento de 15%. Qual e o novo preco?",
      "options": [
        "R$ 92",
        "R$ 95",
        "R$ 68",
        "R$ 15"
      ],
      "correctAnswer": "R$ 92",
      "explanation": "O aumento e R$ 12; somado a R$ 80, resulta em R$ 92.",
      "misconception": {
        "option": "R$ 95",
        "code": "PERCENT_AS_ABSOLUTE_VALUE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-3",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "parte e todo",
      "statement": "Em uma turma de 40 alunos, 30 entregaram a atividade. Qual percentual entregou?",
      "options": [
        "75%",
        "30%",
        "70%",
        "133%"
      ],
      "correctAnswer": "75%",
      "explanation": "30 dividido por 40 equivale a 75%.",
      "misconception": {
        "option": "30%",
        "code": "PERCENT_DENOMINATOR_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-4",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "taxa equivalente",
      "statement": "Uma taxa de 0,08 pode ser escrita como qual percentual?",
      "options": [
        "8%",
        "0,8%",
        "80%",
        "0,08%"
      ],
      "correctAnswer": "8%",
      "explanation": "Multiplicar 0,08 por 100 transforma a taxa em 8%.",
      "misconception": {
        "option": "0,8%",
        "code": "DECIMAL_PERCENT_SHIFT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-5",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "proporcao",
      "statement": "Tres cadernos custam R$ 27. Mantendo o preco unitario, quanto custam cinco?",
      "options": [
        "R$ 45",
        "R$ 30",
        "R$ 54",
        "R$ 90"
      ],
      "correctAnswer": "R$ 45",
      "explanation": "Cada caderno custa R$ 9; cinco custam R$ 45.",
      "misconception": {
        "option": "R$ 30",
        "code": "PROPORTION_NOT_SCALED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": [
        {
          "skillCode": "RATIO_PROPORTION",
          "role": "SUPPORTING",
          "evidenceBearing": true,
          "attributionConfidence": 0.65
        }
      ]
    },
    {
      "id": "v3-mathematics-percentage-6",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "percentual acumulado",
      "statement": "Uma assinatura de R$ 100 sobe 10% e depois recebe desconto de 10%. Qual valor final?",
      "options": [
        "R$ 99",
        "R$ 100",
        "R$ 90",
        "R$ 110"
      ],
      "correctAnswer": "R$ 99",
      "explanation": "Os percentuais incidem sobre bases diferentes: 110 vezes 0,9 = 99.",
      "misconception": {
        "option": "R$ 100",
        "code": "SUCCESSIVE_PERCENTAGES_CANCELLED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-7",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "fracao percentual",
      "statement": "Qual fracao representa 40% de uma quantidade?",
      "options": [
        "2/5",
        "4/5",
        "1/4",
        "40/1"
      ],
      "correctAnswer": "2/5",
      "explanation": "40/100 simplifica para 2/5.",
      "misconception": {
        "option": "4/5",
        "code": "PERCENT_NOT_SIMPLIFIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-8",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "grafico",
      "statement": "Um grafico mostra 12 livros em abril e 18 em maio. Qual foi o aumento percentual?",
      "options": [
        "50%",
        "6%",
        "30%",
        "150%"
      ],
      "correctAnswer": "50%",
      "explanation": "O aumento foi 6 sobre a base 12: 50%.",
      "misconception": {
        "option": "6%",
        "code": "INCREASE_USES_NEW_BASE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-9",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "juros simples",
      "statement": "Uma aplicacao de R$ 500 rende 2% ao mes por um mes. Qual e o rendimento?",
      "options": [
        "R$ 10",
        "R$ 20",
        "R$ 502",
        "R$ 100"
      ],
      "correctAnswer": "R$ 10",
      "explanation": "2% de 500 e igual a R$ 10.",
      "misconception": {
        "option": "R$ 20",
        "code": "RATE_TREATED_AS_AMOUNT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-10",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "pesquisa",
      "statement": "Em uma pesquisa, 18 de 60 pessoas escolheram a opcao A. Qual percentual isso representa?",
      "options": [
        "30%",
        "18%",
        "42%",
        "60%"
      ],
      "correctAnswer": "30%",
      "explanation": "18 dividido por 60 resulta em 30%.",
      "misconception": {
        "option": "18%",
        "code": "PART_WHOLE_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-11",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "comissao",
      "statement": "Uma venda de R$ 1.200 gera comissao de 5%. Qual comissao sera paga?",
      "options": [
        "R$ 60",
        "R$ 240",
        "R$ 1.140",
        "R$ 5"
      ],
      "correctAnswer": "R$ 60",
      "explanation": "0,05 vezes 1.200 = 60.",
      "misconception": {
        "option": "R$ 240",
        "code": "COMMISSION_RATE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-mathematics-percentage-12",
      "subject": "MATHEMATICS",
      "domain": "NUMEROS",
      "targetSkill": "PERCENTAGE",
      "topic": "ofertas",
      "statement": "Oferta A da 20% de desconto em R$ 150; oferta B tira R$ 25. Qual oferece maior desconto?",
      "options": [
        "Oferta A, com R$ 30.",
        "Oferta B, com R$ 25.",
        "As duas, com R$ 20.",
        "Oferta B, com R$ 30."
      ],
      "correctAnswer": "Oferta A, com R$ 30.",
      "explanation": "20% de 150 e R$ 30, maior que R$ 25.",
      "misconception": {
        "option": "Oferta B, com R$ 25.",
        "code": "PERCENT_COMPARED_WITHOUT_BASE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "SCIENCE": [
    {
      "id": "v3-science-science_transformations-1",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "fusao",
      "statement": "Cubos de gelo deixados sobre a mesa viram agua liquida. Que transformacao ocorreu?",
      "options": [
        "Fusao",
        "Evaporacao",
        "Condensacao",
        "Solidificacao"
      ],
      "correctAnswer": "Fusao",
      "explanation": "Fusao e a passagem do solido para o liquido.",
      "misconception": {
        "option": "Evaporacao",
        "code": "STATE_CHANGE_DIRECTION_CONFUSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-2",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "combustao",
      "statement": "Uma vela acesa produz luz, calor e novos gases. Por que isso e uma transformacao quimica?",
      "options": [
        "Novas substancias sao formadas.",
        "A cera apenas muda de lugar.",
        "A vela fica mais fria.",
        "O pavio se torna agua."
      ],
      "correctAnswer": "Novas substancias sao formadas.",
      "explanation": "A combustao altera a composicao e forma gases.",
      "misconception": {
        "option": "A cera apenas muda de lugar.",
        "code": "CHEMICAL_CHANGE_CONFUSED_WITH_SHAPE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-3",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "ciclo da agua",
      "statement": "A agua de uma poca desaparece em um dia quente. Qual processo explica a mudanca?",
      "options": [
        "Evaporacao",
        "Fusao",
        "Precipitacao",
        "Congelamento"
      ],
      "correctAnswer": "Evaporacao",
      "explanation": "O calor favorece a passagem do liquido para vapor.",
      "misconception": {
        "option": "Fusao",
        "code": "EVAPORATION_CONFUSED_WITH_BOILING",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-4",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "mistura",
      "statement": "Agua e areia foram colocadas em um copo. Qual metodo separa melhor os componentes?",
      "options": [
        "Filtracao",
        "Fusao",
        "Combustao",
        "Imantacao"
      ],
      "correctAnswer": "Filtracao",
      "explanation": "A areia fica retida no filtro enquanto a agua atravessa.",
      "misconception": {
        "option": "Fusao",
        "code": "SEPARATION_METHOD_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-5",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "conducao",
      "statement": "Uma colher metalica esquenta dentro da sopa. Como o calor chegou a sua ponta?",
      "options": [
        "Por conducao pelo metal.",
        "Por fotossintese.",
        "Por evaporacao da colher.",
        "Por separacao magnetica."
      ],
      "correctAnswer": "Por conducao pelo metal.",
      "explanation": "O metal conduz energia termica ao longo do objeto.",
      "misconception": {
        "option": "Por fotossintese.",
        "code": "HEAT_TRANSFER_CONFUSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-6",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "mudanca fisica",
      "statement": "Uma folha de papel foi dobrada e depois desdobrada. Por que a mudanca e fisica?",
      "options": [
        "A composicao do papel permanece a mesma.",
        "Surge uma nova substancia.",
        "O papel vira liquido.",
        "A dobradura libera oxigenio."
      ],
      "correctAnswer": "A composicao do papel permanece a mesma.",
      "explanation": "A forma muda, mas a substancia continua sendo papel.",
      "misconception": {
        "option": "Surge uma nova substancia.",
        "code": "PHYSICAL_CHANGE_CONFUSED_WITH_CHEMICAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-7",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "densidade",
      "statement": "Dois blocos de mesmo volume: um pesa mais que o outro. O que se pode inferir?",
      "options": [
        "O mais pesado tem maior densidade.",
        "O mais leve tem maior densidade.",
        "Eles tem necessariamente a mesma massa.",
        "Volume nao participa da densidade."
      ],
      "correctAnswer": "O mais pesado tem maior densidade.",
      "explanation": "Com volumes iguais, maior massa implica maior densidade.",
      "misconception": {
        "option": "O mais leve tem maior densidade.",
        "code": "DENSITY_IGNORES_MASS",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-8",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "experimento",
      "statement": "Uma planta ficou em local claro e outra no escuro, com a mesma agua. O que a comparacao investiga?",
      "options": [
        "Efeito da luz sobre o crescimento.",
        "Efeito da agua sobre o metal.",
        "A massa do vaso.",
        "A temperatura de uma estrela."
      ],
      "correctAnswer": "Efeito da luz sobre o crescimento.",
      "explanation": "Manter a agua igual destaca a variavel luz.",
      "misconception": {
        "option": "Efeito da agua sobre o metal.",
        "code": "CONTROL_VARIABLE_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-9",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "oxidacao",
      "statement": "Um portao de ferro exposto a chuva enferruja. Qual condicao favorece o processo?",
      "options": [
        "Contato com agua e oxigenio.",
        "Ausencia completa de ar.",
        "Congelamento imediato.",
        "Filtracao da tinta."
      ],
      "correctAnswer": "Contato com agua e oxigenio.",
      "explanation": "A ferrugem resulta da reacao do ferro com oxigenio e agua.",
      "misconception": {
        "option": "Ausencia completa de ar.",
        "code": "OXIDATION_CAUSE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-10",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "pressao",
      "statement": "Ao apertar uma seringa tampada, o ar oferece resistencia. Qual explicacao e adequada?",
      "options": [
        "As particulas do ar ocupam espaco e colidem.",
        "O ar nao tem particulas.",
        "A seringa produz agua.",
        "A pressao desaparece ao reduzir o volume."
      ],
      "correctAnswer": "As particulas do ar ocupam espaco e colidem.",
      "explanation": "O modelo particulado explica a resistencia.",
      "misconception": {
        "option": "O ar nao tem particulas.",
        "code": "PARTICLE_MODEL_DENIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-11",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "reciclagem",
      "statement": "Separar vidro, papel e metal antes da coleta facilita qual etapa?",
      "options": [
        "Reaproveitamento de materiais.",
        "Evaporacao da agua.",
        "Formacao de combustivel fossil.",
        "Aumento da mistura."
      ],
      "correctAnswer": "Reaproveitamento de materiais.",
      "explanation": "A separacao reduz contaminacao e facilita a reciclagem.",
      "misconception": {
        "option": "Evaporacao da agua.",
        "code": "RECYCLING_GOAL_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-science-science_transformations-12",
      "subject": "SCIENCE",
      "domain": "TRANSFORMACOES",
      "targetSkill": "SCIENCE_TRANSFORMATIONS",
      "topic": "conversao de energia",
      "statement": "Uma placa solar transforma luz em energia eletrica. O que muda principalmente?",
      "options": [
        "A forma de energia disponivel.",
        "O material vira agua.",
        "A luz deixa de existir.",
        "A eletricidade vira massa."
      ],
      "correctAnswer": "A forma de energia disponivel.",
      "explanation": "O dispositivo converte energia luminosa em eletrica.",
      "misconception": {
        "option": "O material vira agua.",
        "code": "ENERGY_CONVERSION_DENIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "BIOLOGY": [
    {
      "id": "v3-biology-biology_genetics-1",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "alelo",
      "statement": "Em uma familia, diferentes alelos influenciam a cor dos olhos. O que e um alelo?",
      "options": [
        "Uma versao de um gene.",
        "Uma celula inteira.",
        "Um orgao do corpo.",
        "Uma especie diferente."
      ],
      "correctAnswer": "Uma versao de um gene.",
      "explanation": "Alelo e uma forma alternativa de um gene.",
      "misconception": {
        "option": "Uma celula inteira.",
        "code": "ALLELE_CONFUSED_WITH_CELL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-2",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "hereditariedade",
      "statement": "Pais com uma caracteristica podem ter filho sem ela. Qual explicacao e possivel?",
      "options": [
        "O filho recebeu outra combinacao de alelos.",
        "Caracteristicas nunca dependem de genes.",
        "Todos os filhos sao geneticamente identicos.",
        "O ambiente altera todo o DNA dos pais."
      ],
      "correctAnswer": "O filho recebeu outra combinacao de alelos.",
      "explanation": "A combinacao herdada pode diferir entre irmaos.",
      "misconception": {
        "option": "Caracteristicas nunca dependem de genes.",
        "code": "INHERITANCE_TREATED_AS_COPY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-3",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "dominancia",
      "statement": "Em um modelo, A domina a. Um individuo Aa apresenta qual alelo no fenotipo?",
      "options": [
        "A",
        "a apenas",
        "Nenhum alelo",
        "AA e aa ao mesmo tempo"
      ],
      "correctAnswer": "A",
      "explanation": "No modelo dado, o alelo dominante se expressa em Aa.",
      "misconception": {
        "option": "a apenas",
        "code": "DOMINANCE_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-4",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "probabilidade",
      "statement": "No cruzamento Aa x Aa, usando dominancia completa, qual proporcao esperada de aa?",
      "options": [
        "25%",
        "50%",
        "75%",
        "100%"
      ],
      "correctAnswer": "25%",
      "explanation": "As combinacoes incluem um aa em quatro.",
      "misconception": {
        "option": "50%",
        "code": "PUNNETT_COUNT_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-5",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "mutacao",
      "statement": "Uma mudanca no DNA pode nao alterar uma caracteristica observavel. Por que?",
      "options": [
        "Pode ocorrer em regiao sem efeito ou ser compensada.",
        "Toda mudanca no DNA e fatal.",
        "DNA nao participa das caracteristicas.",
        "A mutacao sempre altera o ambiente."
      ],
      "correctAnswer": "Pode ocorrer em regiao sem efeito ou ser compensada.",
      "explanation": "O efeito depende do gene, da regiao e do contexto.",
      "misconception": {
        "option": "Toda mudanca no DNA e fatal.",
        "code": "MUTATION_ALWAYS_VISIBLE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-6",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "selecao",
      "statement": "Uma populacao de insetos passa a ter mais individuos resistentes ao pesticida apos varias geracoes. Qual processo explica?",
      "options": [
        "Selecao de variantes resistentes.",
        "Treino individual dos insetos.",
        "Mudanca instantanea em todos os genes.",
        "Eliminacao da hereditariedade."
      ],
      "correctAnswer": "Selecao de variantes resistentes.",
      "explanation": "O pesticida favorece a sobrevivencia e reproducao de variantes resistentes.",
      "misconception": {
        "option": "Treino individual dos insetos.",
        "code": "SELECTION_CONFUSED_WITH_TRAINING",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-7",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "cromossomo",
      "statement": "Onde esta a maior parte do material genetico de uma celula animal?",
      "options": [
        "No nucleo.",
        "Na parede celular.",
        "No vacuolo de agua.",
        "No espaco extracelular."
      ],
      "correctAnswer": "No nucleo.",
      "explanation": "O nucleo abriga os cromossomos na maioria das celulas animais.",
      "misconception": {
        "option": "Na parede celular.",
        "code": "CELL_STRUCTURE_MISPLACED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-8",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "DNA e RNA",
      "statement": "Qual diferenca geral entre DNA e RNA e correta?",
      "options": [
        "O RNA costuma participar da leitura da informacao genetica.",
        "O DNA existe apenas fora das celulas.",
        "RNA nao possui nucleotideos.",
        "DNA e sempre uma proteina."
      ],
      "correctAnswer": "O RNA costuma participar da leitura da informacao genetica.",
      "explanation": "DNA armazena informacao e RNA atua em sua expressao.",
      "misconception": {
        "option": "O DNA existe apenas fora das celulas.",
        "code": "DNA_RNA_FUNCTIONS_SWAPPED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-9",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "caracteristica complexa",
      "statement": "Altura humana varia de forma continua. Qual ideia explica melhor?",
      "options": [
        "Muitos genes e ambiente podem contribuir.",
        "Apenas um alelo determina toda altura.",
        "Ambiente nunca afeta fenotipo.",
        "Altura nao tem relacao com heranca."
      ],
      "correctAnswer": "Muitos genes e ambiente podem contribuir.",
      "explanation": "Caracteristicas complexas resultam de varios fatores.",
      "misconception": {
        "option": "Apenas um alelo determina toda altura.",
        "code": "COMPLEX_TRAIT_SINGLE_CAUSE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-10",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "fenotipo",
      "statement": "Duas plantas com genotipos iguais crescem com alturas diferentes em ambientes distintos. O que isso mostra?",
      "options": [
        "Fenotipo resulta da interacao entre genes e ambiente.",
        "Genotipo muda a cada rega.",
        "Ambiente nao interfere.",
        "Fenotipo e sempre identico ao genotipo."
      ],
      "correctAnswer": "Fenotipo resulta da interacao entre genes e ambiente.",
      "explanation": "A expressao observada depende de fatores geneticos e ambientais.",
      "misconception": {
        "option": "Genotipo muda a cada rega.",
        "code": "GENOTYPE_EQUALS_PHENOTYPE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-11",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "heranca ligada ao X",
      "statement": "Uma caracteristica ligada ao cromossomo X pode aparecer mais em homens em certo modelo. Qual razao?",
      "options": [
        "Homens possuem uma unica copia de X.",
        "Homens nao possuem cromossomos.",
        "Mulheres sempre expressam todos os alelos.",
        "O cromossomo Y e uma copia de X."
      ],
      "correctAnswer": "Homens possuem uma unica copia de X.",
      "explanation": "Uma unica copia pode revelar um alelo recessivo ligado ao X.",
      "misconception": {
        "option": "Homens nao possuem cromossomos.",
        "code": "SEX_LINKAGE_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-biology-biology_genetics-12",
      "subject": "BIOLOGY",
      "domain": "GENETICA",
      "targetSkill": "BIOLOGY_GENETICS",
      "topic": "diversidade genetica",
      "statement": "Por que a diversidade genetica ajuda uma populacao diante de uma doenca?",
      "options": [
        "Aumenta a chance de existirem variantes resistentes.",
        "Faz todos os individuos iguais.",
        "Elimina a selecao natural.",
        "Impede qualquer mutacao."
      ],
      "correctAnswer": "Aumenta a chance de existirem variantes resistentes.",
      "explanation": "Variacao amplia as possibilidades de resposta da populacao.",
      "misconception": {
        "option": "Faz todos os individuos iguais.",
        "code": "DIVERSITY_REDUCES_SURVIVAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "PHYSICS": [
    {
      "id": "v3-physics-physics_average_speed-1",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "velocidade media",
      "statement": "Um carro percorre 120 km em 2 h. Qual e sua velocidade media?",
      "options": [
        "60 km/h",
        "240 km/h",
        "118 km/h",
        "2 km/h"
      ],
      "correctAnswer": "60 km/h",
      "explanation": "Velocidade media e distancia dividida pelo tempo: 120/2 = 60 km/h.",
      "misconception": {
        "option": "240 km/h",
        "code": "SPEED_MULTIPLIES_DISTANCE_TIME",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": [
        {
          "skillCode": "RATIO_PROPORTION",
          "role": "SUPPORTING",
          "evidenceBearing": true,
          "attributionConfidence": 0.65
        }
      ]
    },
    {
      "id": "v3-physics-physics_average_speed-2",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "unidades",
      "statement": "Uma bicicleta percorre 300 m em 60 s. Qual e a velocidade media em m/s?",
      "options": [
        "5 m/s",
        "18 m/s",
        "360 m/s",
        "0,2 m/s"
      ],
      "correctAnswer": "5 m/s",
      "explanation": "300 dividido por 60 resulta em 5 m/s.",
      "misconception": {
        "option": "18 m/s",
        "code": "SPEED_UNIT_CONVERSION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": [
        {
          "skillCode": "RATIO_PROPORTION",
          "role": "SUPPORTING",
          "evidenceBearing": true,
          "attributionConfidence": 0.65
        }
      ]
    },
    {
      "id": "v3-physics-physics_average_speed-3",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "distancia",
      "statement": "Um trem viaja a 80 km/h durante 3 h. Que distancia percorre?",
      "options": [
        "240 km",
        "83 km",
        "26,7 km",
        "80 km"
      ],
      "correctAnswer": "240 km",
      "explanation": "Distancia e velocidade vezes tempo: 80 x 3 = 240 km.",
      "misconception": {
        "option": "83 km",
        "code": "DISTANCE_DIVIDED_INSTEAD_OF_MULTIPLIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": [
        {
          "skillCode": "RATIO_PROPORTION",
          "role": "SUPPORTING",
          "evidenceBearing": true,
          "attributionConfidence": 0.65
        }
      ]
    },
    {
      "id": "v3-physics-physics_average_speed-4",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "tempo",
      "statement": "Uma viagem de 150 km ocorre a 50 km/h. Quanto tempo dura?",
      "options": [
        "3 h",
        "100 h",
        "200 h",
        "0,33 h"
      ],
      "correctAnswer": "3 h",
      "explanation": "Tempo e distancia dividida pela velocidade: 150/50 = 3 h.",
      "misconception": {
        "option": "100 h",
        "code": "TIME_MULTIPLIES_SPEED_DISTANCE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": [
        {
          "skillCode": "RATIO_PROPORTION",
          "role": "PREREQUISITE",
          "evidenceBearing": true,
          "attributionConfidence": 0.35
        }
      ]
    },
    {
      "id": "v3-physics-physics_average_speed-5",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "grafico posicao-tempo",
      "statement": "Em um grafico posicao-tempo, uma reta mais inclinada indica maior:",
      "options": [
        "Velocidade",
        "Massa",
        "Temperatura",
        "Tempo total parado"
      ],
      "correctAnswer": "Velocidade",
      "explanation": "A inclinacao representa a variacao da posicao por tempo.",
      "misconception": {
        "option": "Massa",
        "code": "GRAPH_SLOPE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physics-physics_average_speed-6",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "movimento uniforme",
      "statement": "Um objeto percorre distancias iguais em tempos iguais. Como e classificado o movimento?",
      "options": [
        "Uniforme",
        "Circular necessariamente",
        "Aleatorio",
        "Sem movimento"
      ],
      "correctAnswer": "Uniforme",
      "explanation": "A regularidade da razao distancia-tempo caracteriza movimento uniforme.",
      "misconception": {
        "option": "Circular necessariamente",
        "code": "UNIFORM_MOTION_DENIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physics-physics_average_speed-7",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "encontro",
      "statement": "Dois ciclistas saem de pontos separados por 30 km, com velocidades de 10 e 5 km/h em direcao um ao outro. Em quanto tempo se encontram?",
      "options": [
        "2 h",
        "3 h",
        "6 h",
        "15 h"
      ],
      "correctAnswer": "2 h",
      "explanation": "A velocidade relativa e 15 km/h; 30/15 = 2 h.",
      "misconception": {
        "option": "3 h",
        "code": "RELATIVE_SPEED_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": [
        {
          "skillCode": "RATIO_PROPORTION",
          "role": "SUPPORTING",
          "evidenceBearing": true,
          "attributionConfidence": 0.65
        }
      ]
    },
    {
      "id": "v3-physics-physics_average_speed-8",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "media de trechos",
      "statement": "Um estudante caminha 2 km em 30 min e depois 1 km em 30 min. Qual velocidade media total em km/h?",
      "options": [
        "3 km/h",
        "2 km/h",
        "1 km/h",
        "6 km/h"
      ],
      "correctAnswer": "3 km/h",
      "explanation": "Sao 3 km em 1 h, portanto 3 km/h.",
      "misconception": {
        "option": "2 km/h",
        "code": "AVERAGE_USES_AVERAGE_SPEEDS",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physics-physics_average_speed-9",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "conversao",
      "statement": "Uma velocidade de 72 km/h equivale a quantos m/s?",
      "options": [
        "20 m/s",
        "7,2 m/s",
        "72 m/s",
        "259,2 m/s"
      ],
      "correctAnswer": "20 m/s",
      "explanation": "Dividir por 3,6 converte km/h para m/s.",
      "misconception": {
        "option": "7,2 m/s",
        "code": "KMH_MS_CONVERSION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physics-physics_average_speed-10",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "area no grafico",
      "statement": "A area sob um grafico velocidade-tempo representa qual grandeza?",
      "options": [
        "Deslocamento",
        "Massa",
        "Aceleracao",
        "Temperatura"
      ],
      "correctAnswer": "Deslocamento",
      "explanation": "A area soma velocidade ao longo do tempo.",
      "misconception": {
        "option": "Massa",
        "code": "GRAPH_AREA_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physics-physics_average_speed-11",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "aceleracao",
      "statement": "Um carro passa de 10 para 20 m/s em 5 s. Qual aceleracao media?",
      "options": [
        "2 m/s2",
        "10 m/s2",
        "30 m/s2",
        "0,5 m/s2"
      ],
      "correctAnswer": "2 m/s2",
      "explanation": "Aceleracao media e variacao de velocidade por tempo: 10/5 = 2 m/s2.",
      "misconception": {
        "option": "10 m/s2",
        "code": "ACCELERATION_NOT_DIVIDED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physics-physics_average_speed-12",
      "subject": "PHYSICS",
      "domain": "VELOCIDADE",
      "targetSkill": "PHYSICS_AVERAGE_SPEED",
      "topic": "comparacao",
      "statement": "Dois trajetos tem a mesma distancia, mas um leva mais tempo. Qual trajeto tem menor velocidade media?",
      "options": [
        "O que leva mais tempo.",
        "O que leva menos tempo.",
        "Os dois sempre tem a mesma.",
        "Nenhum pode ser comparado."
      ],
      "correctAnswer": "O que leva mais tempo.",
      "explanation": "Com a mesma distancia, maior tempo reduz a razao distancia-tempo.",
      "misconception": {
        "option": "O que leva menos tempo.",
        "code": "SAME_DISTANCE_SAME_SPEED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "CHEMISTRY": [
    {
      "id": "v3-chemistry-chemistry_atoms-1",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "nucleo",
      "statement": "No modelo atual, o atomo possui nucleo e eletrosfera. Onde ficam proton e neutron?",
      "options": [
        "No nucleo.",
        "Na eletrosfera.",
        "Fora do atomo.",
        "Somente na ligacao."
      ],
      "correctAnswer": "No nucleo.",
      "explanation": "Protons e neutrons formam o nucleo atomico.",
      "misconception": {
        "option": "Na eletrosfera.",
        "code": "NUCLEUS_SHELL_SWAPPED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-2",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "numero atomico",
      "statement": "Um atomo com numero atomico 8 possui quantos protons?",
      "options": [
        "8",
        "16",
        "4",
        "0"
      ],
      "correctAnswer": "8",
      "explanation": "O numero atomico identifica a quantidade de protons.",
      "misconception": {
        "option": "16",
        "code": "ATOMIC_NUMBER_DOUBLED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-3",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "ion",
      "statement": "Quando um atomo neutro perde um eletron, ele se torna:",
      "options": [
        "Um cation.",
        "Um anion.",
        "Um neutron.",
        "Uma molecula neutra sempre."
      ],
      "correctAnswer": "Um cation.",
      "explanation": "Perder carga negativa deixa excesso relativo de carga positiva.",
      "misconception": {
        "option": "Um anion.",
        "code": "ION_CHARGE_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-4",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "isotopos",
      "statement": "Dois atomos com mesmo numero de protons e diferente numero de neutrons sao:",
      "options": [
        "Isotopos.",
        "Ions de cargas opostas.",
        "Moleculas.",
        "Elementos diferentes."
      ],
      "correctAnswer": "Isotopos.",
      "explanation": "Isotopos pertencem ao mesmo elemento e diferem no numero de neutrons.",
      "misconception": {
        "option": "Ions de cargas opostas.",
        "code": "ISOTOPE_CONFUSED_WITH_ION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-5",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "ligacao ionica",
      "statement": "Na formacao de cloreto de sodio, ocorre transferencia de eletron. Que tipo de ligacao se forma?",
      "options": [
        "Ionica.",
        "Metalica apenas.",
        "Ponte de hidrogenio.",
        "Nenhuma."
      ],
      "correctAnswer": "Ionica.",
      "explanation": "A transferencia gera ions atraidos eletrostaticamente.",
      "misconception": {
        "option": "Metalica apenas.",
        "code": "IONIC_BOND_MISNAMED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-6",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "ligacao covalente",
      "statement": "Na molecula de agua, os atomos compartilham eletrons. Isso caracteriza ligacao:",
      "options": [
        "Covalente.",
        "Ionica por transferencia total.",
        "Metalica.",
        "Nuclear."
      ],
      "correctAnswer": "Covalente.",
      "explanation": "Compartilhar pares de eletrons e caracteristico da ligacao covalente.",
      "misconception": {
        "option": "Ionica por transferencia total.",
        "code": "COVALENT_SHARING_DENIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-7",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "conservacao",
      "statement": "Na reacao 2H2 + O2 -> 2H2O, o que se conserva?",
      "options": [
        "A quantidade de atomos de cada elemento.",
        "O numero de moleculas sempre.",
        "A temperatura.",
        "A cor dos reagentes."
      ],
      "correctAnswer": "A quantidade de atomos de cada elemento.",
      "explanation": "A equacao balanceada conserva atomos de hidrogenio e oxigenio.",
      "misconception": {
        "option": "O numero de moleculas sempre.",
        "code": "REACTION_CONSERVES_MOLECULES",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-8",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "pH",
      "statement": "Uma solucao com pH 3 e classificada como:",
      "options": [
        "Acida.",
        "Basica.",
        "Neutra.",
        "Sem agua necessariamente."
      ],
      "correctAnswer": "Acida.",
      "explanation": "Valores menores que 7 indicam acidez em agua.",
      "misconception": {
        "option": "Basica.",
        "code": "PH_SCALE_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-9",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "solubilidade",
      "statement": "Ao aquecer a agua, certo soluto passa a dissolver mais. O que aumenta?",
      "options": [
        "A solubilidade desse soluto.",
        "A massa do soluto sem adicionar nada.",
        "O numero atomico.",
        "A carga do copo."
      ],
      "correctAnswer": "A solubilidade desse soluto.",
      "explanation": "Solubilidade indica quanto soluto se dissolve em uma condicao.",
      "misconception": {
        "option": "A massa do soluto sem adicionar nada.",
        "code": "SOLUBILITY_CONFUSED_WITH_MASS",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-10",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "separacao",
      "statement": "Uma mistura de agua e sal pode ser separada por evaporacao porque:",
      "options": [
        "A agua muda para vapor e o sal permanece.",
        "O sal vira gas primeiro.",
        "A agua se transforma em sal.",
        "Os atomos desaparecem."
      ],
      "correctAnswer": "A agua muda para vapor e o sal permanece.",
      "explanation": "A diferenca de volatilidade permite recuperar o sal.",
      "misconception": {
        "option": "O sal vira gas primeiro.",
        "code": "EVAPORATION_REMOVES_SOLUTE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-11",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "reacao",
      "statement": "Bolhas surgem ao misturar duas substancias e o recipiente esquenta. Esses sinais sugerem:",
      "options": [
        "Reacao quimica.",
        "Apenas mudanca de forma.",
        "Separacao mecanica.",
        "Congelamento."
      ],
      "correctAnswer": "Reacao quimica.",
      "explanation": "Gas e variacao de temperatura podem indicar novas substancias.",
      "misconception": {
        "option": "Apenas mudanca de forma.",
        "code": "REACTION_SIGNS_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-chemistry-chemistry_atoms-12",
      "subject": "CHEMISTRY",
      "domain": "ATOMOS",
      "targetSkill": "CHEMISTRY_ATOMS",
      "topic": "massa",
      "statement": "Em uma reacao fechada, a massa total permanece constante porque:",
      "options": [
        "Os atomos se reorganizam sem desaparecer.",
        "A materia sai do recipiente.",
        "Os atomos deixam de existir.",
        "A massa depende apenas da cor."
      ],
      "correctAnswer": "Os atomos se reorganizam sem desaparecer.",
      "explanation": "A conservacao da massa decorre da reorganizacao das particulas.",
      "misconception": {
        "option": "A materia sai do recipiente.",
        "code": "MASS_CONSERVATION_DENIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "HISTORY": [
    {
      "id": "v3-history-history_interpretation-1",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "fonte primaria",
      "statement": "Uma carta escrita por uma trabalhadora durante uma greve e uma fonte primaria porque:",
      "options": [
        "Foi produzida no contexto vivido pela autora.",
        "Foi escrita muitos seculos depois.",
        "Resume todos os livros sobre a greve.",
        "Nao possui perspectiva."
      ],
      "correctAnswer": "Foi produzida no contexto vivido pela autora.",
      "explanation": "A fonte registra o periodo, ainda que seja parcial.",
      "misconception": {
        "option": "Foi escrita muitos seculos depois.",
        "code": "PRIMARY_SOURCE_CONFUSED_WITH_NEUTRAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-2",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "contexto",
      "statement": "Para interpretar um discurso politico de 1930, e importante considerar:",
      "options": [
        "As disputas e valores daquele periodo.",
        "Somente o significado atual das palavras.",
        "A biografia de qualquer pessoa.",
        "A data de impressao do livro escolar."
      ],
      "correctAnswer": "As disputas e valores daquele periodo.",
      "explanation": "Contexto evita aplicar categorias atuais de modo anacronico.",
      "misconception": {
        "option": "Somente o significado atual das palavras.",
        "code": "ANACHRONISM_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-3",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "cronologia",
      "statement": "Se a abolicao ocorreu em 1888 e a Republica em 1889, qual ocorreu primeiro?",
      "options": [
        "A abolicao.",
        "A Republica.",
        "Ocorreram no mesmo ano.",
        "Nao e possivel ordenar."
      ],
      "correctAnswer": "A abolicao.",
      "explanation": "1888 antecede 1889.",
      "misconception": {
        "option": "A Republica.",
        "code": "CHRONOLOGY_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-4",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "causa",
      "statement": "Uma crise economica aumenta o desemprego e favorece protestos. Nessa frase, o desemprego e:",
      "options": [
        "Uma consequencia da crise.",
        "A causa unica da crise.",
        "Um evento sem relacao.",
        "Uma fonte primaria."
      ],
      "correctAnswer": "Uma consequencia da crise.",
      "explanation": "A relacao apresentada coloca a crise antes do desemprego.",
      "misconception": {
        "option": "A causa unica da crise.",
        "code": "CAUSE_EFFECT_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-5",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "multiperspectiva",
      "statement": "Um relato de colonizador e outro de comunidade indigena descrevem um encontro. O historiador deve:",
      "options": [
        "Comparar perspectivas, linguagem e contexto.",
        "Eliminar o relato indigena.",
        "Escolher o texto mais longo.",
        "Somar as narrativas como se fossem iguais."
      ],
      "correctAnswer": "Comparar perspectivas, linguagem e contexto.",
      "explanation": "Fontes revelam interesses e experiencias distintas.",
      "misconception": {
        "option": "Eliminar o relato indigena.",
        "code": "SINGLE_NARRATIVE_ASSUMED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-6",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "periodizacao",
      "statement": "Dividir a historia em periodos ajuda a:",
      "options": [
        "Organizar processos sem supor mudancas instantaneas.",
        "Provar que toda sociedade muda na mesma data.",
        "Apagar continuidades.",
        "Substituir a analise de fontes."
      ],
      "correctAnswer": "Organizar processos sem supor mudancas instantaneas.",
      "explanation": "Periodizacao e uma ferramenta de analise.",
      "misconception": {
        "option": "Provar que toda sociedade muda na mesma data.",
        "code": "PERIODIZATION_TREATED_AS_ABSOLUTE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-7",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "memoria",
      "statement": "Uma festa comemorativa preserva a memoria de um grupo, enquanto a pesquisa historica:",
      "options": [
        "Analisa memorias junto de outras evidencias.",
        "Repete a comemoracao sem critica.",
        "Ignora qualquer testemunho.",
        "Transforma memoria em prova unica."
      ],
      "correctAnswer": "Analisa memorias junto de outras evidencias.",
      "explanation": "Memoria e evidencia importante, mas precisa de contexto.",
      "misconception": {
        "option": "Repete a comemoracao sem critica.",
        "code": "MEMORY_EQUALS_COMPLETE_HISTORY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-8",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "mapa historico",
      "statement": "Um mapa de ferrovias de 1910 pode ajudar a investigar:",
      "options": [
        "Circulacao e integracao economica daquele periodo.",
        "A temperatura atual das cidades.",
        "A opiniao dos trabalhadores sem outras fontes.",
        "A idade do papel."
      ],
      "correctAnswer": "Circulacao e integracao economica daquele periodo.",
      "explanation": "A rede permite perguntas sobre fluxos historicos.",
      "misconception": {
        "option": "A temperatura atual das cidades.",
        "code": "MAP_DATA_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-9",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "fotografia",
      "statement": "Uma fotografia mostra uma rua movimentada, mas nao informa sozinha o motivo. O pesquisador deve:",
      "options": [
        "Cruzar a imagem com outras fontes.",
        "Inventar o motivo mais provavel.",
        "Considerar a foto falsa.",
        "Concluir que toda cidade era igual."
      ],
      "correctAnswer": "Cruzar a imagem com outras fontes.",
      "explanation": "A imagem documenta uma cena, mas o significado exige contexto.",
      "misconception": {
        "option": "Inventar o motivo mais provavel.",
        "code": "IMAGE_OVERINTERPRETED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-10",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "mudanca",
      "statement": "Uma lei pode mudar direitos formais enquanto praticas sociais continuam desiguais. Isso mostra:",
      "options": [
        "Mudanca e permanencia podem coexistir.",
        "Leis nunca alteram sociedades.",
        "Praticas sociais mudam no mesmo dia.",
        "Direitos formais nao tem historia."
      ],
      "correctAnswer": "Mudanca e permanencia podem coexistir.",
      "explanation": "Processos historicos tem ritmos diferentes.",
      "misconception": {
        "option": "Leis nunca alteram sociedades.",
        "code": "CHANGE_ERASES_CONTINUITY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-11",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "interpretacao",
      "statement": "Dois historiadores usam as mesmas fontes e defendem interpretacoes diferentes. Isso pode ocorrer porque:",
      "options": [
        "Selecionam perguntas e argumentos diferentes.",
        "A fonte fornece sempre uma unica leitura.",
        "Um deles nao pode usar conceitos.",
        "Interpretacao nao depende de evidencias."
      ],
      "correctAnswer": "Selecionam perguntas e argumentos diferentes.",
      "explanation": "Evidencias limitam, mas perguntas orientam a interpretacao.",
      "misconception": {
        "option": "A fonte fornece sempre uma unica leitura.",
        "code": "INTERPRETATION_IS_GUESS",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-history-history_interpretation-12",
      "subject": "HISTORY",
      "domain": "INTERPRETACAO",
      "targetSkill": "HISTORY_INTERPRETATION",
      "topic": "patrimonio",
      "statement": "Preservar um edificio historico contribui para:",
      "options": [
        "Manter vestigios e debates sobre experiencias passadas.",
        "Congelar a cidade sem uso.",
        "Provar que o passado foi perfeito.",
        "Apagar transformacoes posteriores."
      ],
      "correctAnswer": "Manter vestigios e debates sobre experiencias passadas.",
      "explanation": "Patrimonio conecta materialidade, memoria e interpretacao.",
      "misconception": {
        "option": "Congelar a cidade sem uso.",
        "code": "HERITAGE_ROMANTICIZED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "GEOGRAPHY": [
    {
      "id": "v3-geography-geography_territory-1",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "territorio",
      "statement": "Uma comunidade controla o uso de uma area e define regras de acesso. Esse espaco e analisado como:",
      "options": [
        "Territorio.",
        "Clima.",
        "Relevo apenas.",
        "Fuso horario."
      ],
      "correctAnswer": "Territorio.",
      "explanation": "Territorio envolve poder, controle e apropriacao do espaco.",
      "misconception": {
        "option": "Clima.",
        "code": "TERRITORY_CONFUSED_WITH_LOCATION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-2",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "paisagem",
      "statement": "Uma paisagem com predios, avenida e rio registra:",
      "options": [
        "Elementos naturais e transformacoes humanas.",
        "Somente clima.",
        "Apenas fronteiras politicas.",
        "Somente atividades rurais."
      ],
      "correctAnswer": "Elementos naturais e transformacoes humanas.",
      "explanation": "Paisagem reune elementos percebidos e suas marcas historicas.",
      "misconception": {
        "option": "Somente clima.",
        "code": "LANDSCAPE_NATURAL_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-3",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "escala",
      "statement": "Em um mapa de escala grande, uma quadra aparece com mais detalhes porque:",
      "options": [
        "A area representada e menor e o detalhamento e maior.",
        "Todo mapa grande mostra o planeta.",
        "A escala nao muda o detalhe.",
        "A legenda deixa de ser necessaria."
      ],
      "correctAnswer": "A area representada e menor e o detalhamento e maior.",
      "explanation": "Escala grande permite observar area menor com mais detalhe.",
      "misconception": {
        "option": "Todo mapa grande mostra o planeta.",
        "code": "MAP_SCALE_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-4",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "rede urbana",
      "statement": "Uma cidade ligada a outras por transporte, comercio e servicos participa de:",
      "options": [
        "Uma rede urbana.",
        "Um ecossistema fechado.",
        "Uma bacia hidrografica.",
        "Uma fronteira natural."
      ],
      "correctAnswer": "Uma rede urbana.",
      "explanation": "Fluxos entre cidades formam redes de relacoes.",
      "misconception": {
        "option": "Um ecossistema fechado.",
        "code": "URBAN_NETWORK_DENIED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-5",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "legenda",
      "statement": "A legenda de um mapa serve para:",
      "options": [
        "Explicar simbolos e cores usados na representacao.",
        "Indicar apenas a orientacao do norte.",
        "Substituir a escala.",
        "Mostrar dados que nao foram mapeados."
      ],
      "correctAnswer": "Explicar simbolos e cores usados na representacao.",
      "explanation": "A legenda permite interpretar sinais cartograficos.",
      "misconception": {
        "option": "Indicar apenas a orientacao do norte.",
        "code": "LEGEND_CONFUSED_WITH_SCALE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-6",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "fronteira",
      "statement": "Uma fronteira politica pode mudar por acordos ou conflitos. Isso mostra que:",
      "options": [
        "Fronteiras sao construcoes historicas e politicas.",
        "Fronteiras naturais nunca mudam.",
        "Todo limite e apenas fisico.",
        "Mapas nao expressam poder."
      ],
      "correctAnswer": "Fronteiras sao construcoes historicas e politicas.",
      "explanation": "Limites territoriais resultam de processos sociais e politicos.",
      "misconception": {
        "option": "Fronteiras naturais nunca mudam.",
        "code": "BORDER_TREATED_AS_NATURAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-7",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "uso do solo",
      "statement": "A substituicao de area verde por estacionamento altera principalmente:",
      "options": [
        "O uso do solo e a drenagem local.",
        "A rotacao da Terra.",
        "A distancia ao Sol.",
        "A composicao do nucleo terrestre."
      ],
      "correctAnswer": "O uso do solo e a drenagem local.",
      "explanation": "Cobertura e uso do solo influenciam escoamento e ocupacao.",
      "misconception": {
        "option": "A rotacao da Terra.",
        "code": "LAND_USE_EFFECT_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-8",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "populacao",
      "statement": "Um mapa mostra concentracao de moradores perto de corredores de onibus. Uma hipotese adequada e:",
      "options": [
        "Transporte influencia acessibilidade e ocupacao.",
        "Onibus determinam toda renda.",
        "Nao existe relacao espacial possivel.",
        "A populacao se distribui ao acaso."
      ],
      "correctAnswer": "Transporte influencia acessibilidade e ocupacao.",
      "explanation": "A concentracao sugere uma relacao a investigar.",
      "misconception": {
        "option": "Onibus determinam toda renda.",
        "code": "SPATIAL_PATTERN_OVERSTATED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-9",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "clima e tempo",
      "statement": "A previsao indica chuva amanha; a media de chuvas de uma regiao em trinta anos descreve:",
      "options": [
        "Clima.",
        "Tempo atmosferico de amanha.",
        "Latitude apenas.",
        "Relevo de uma rua."
      ],
      "correctAnswer": "Clima.",
      "explanation": "Clima e o comportamento medio em periodo longo.",
      "misconception": {
        "option": "Tempo atmosferico de amanha.",
        "code": "CLIMATE_TIME_CONFUSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-10",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "migracao",
      "statement": "Pessoas deixam uma regiao por falta de trabalho e procuram emprego em outra. Esse movimento e:",
      "options": [
        "Migracao motivada por fator economico.",
        "Rotacao terrestre.",
        "Erosao.",
        "Urbanizacao sem deslocamento."
      ],
      "correctAnswer": "Migracao motivada por fator economico.",
      "explanation": "A mudanca de lugar tem relacao com oportunidade de trabalho.",
      "misconception": {
        "option": "Rotacao terrestre.",
        "code": "MIGRATION_CAUSE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-11",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "alagamento",
      "statement": "A impermeabilizacao de muitas ruas pode aumentar alagamentos porque:",
      "options": [
        "A agua infiltra menos e escoa mais rapidamente.",
        "O solo passa a absorver mais agua.",
        "A chuva deixa de existir.",
        "O relevo desaparece."
      ],
      "correctAnswer": "A agua infiltra menos e escoa mais rapidamente.",
      "explanation": "Superficies impermeaveis reduzem infiltracao.",
      "misconception": {
        "option": "O solo passa a absorver mais agua.",
        "code": "IMPERMEABILITY_EFFECT_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-geography-geography_territory-12",
      "subject": "GEOGRAPHY",
      "domain": "TERRITORIO",
      "targetSkill": "GEOGRAPHY_TERRITORY",
      "topic": "desigualdade territorial",
      "statement": "Dois bairros tem a mesma distancia do centro, mas servicos diferentes. O que a analise deve considerar?",
      "options": [
        "Infraestrutura, renda, mobilidade e politicas territoriais.",
        "Somente a distancia em linha reta.",
        "Apenas o nome dos bairros.",
        "A altitude como unica causa."
      ],
      "correctAnswer": "Infraestrutura, renda, mobilidade e politicas territoriais.",
      "explanation": "Desigualdade territorial resulta de varios fatores articulados.",
      "misconception": {
        "option": "Somente a distancia em linha reta.",
        "code": "DISTANCE_EXPLAINS_ALL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "PHILOSOPHY": [
    {
      "id": "v3-philosophy-philosophy_argument-1",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "justica",
      "statement": "Uma escola debate se e justo distribuir recursos igualmente ou conforme a necessidade. Qual procedimento e adequado?",
      "options": [
        "Definir criterios e examinar suas consequencias.",
        "Escolher a opiniao mais popular.",
        "Encerrar o debate com um exemplo.",
        "Tratar justica como palavra sem sentido."
      ],
      "correctAnswer": "Definir criterios e examinar suas consequencias.",
      "explanation": "A analise conceitual explicita criterios antes de julgar.",
      "misconception": {
        "option": "Escolher a opiniao mais popular.",
        "code": "POPULARITY_REPLACES_ARGUMENT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-2",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "premissa e conclusao",
      "statement": "Em Se chove, o patio molha; chove; logo, o patio molha, qual e a conclusao?",
      "options": [
        "O patio molha.",
        "Se chove.",
        "Chove.",
        "O patio e coberto."
      ],
      "correctAnswer": "O patio molha.",
      "explanation": "A conclusao e o enunciado sustentado pelas premissas.",
      "misconception": {
        "option": "Se chove.",
        "code": "CONCLUSION_PREMISE_SWAPPED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-3",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "validade",
      "statement": "Um argumento pode ter forma valida e premissa falsa. O que isso significa?",
      "options": [
        "A conclusao segue a forma, mas o conteudo inicial precisa ser examinado.",
        "Toda conclusao valida e verdadeira.",
        "Premissas nunca importam.",
        "Forma e conteudo sao a mesma coisa."
      ],
      "correctAnswer": "A conclusao segue a forma, mas o conteudo inicial precisa ser examinado.",
      "explanation": "Validade trata da estrutura; verdade exige avaliar premissas.",
      "misconception": {
        "option": "Toda conclusao valida e verdadeira.",
        "code": "VALIDITY_EQUALS_TRUTH",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-4",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "dialogo",
      "statement": "Em um dialogo filosofico, responder a uma objecao relevante serve para:",
      "options": [
        "Testar e aperfeicoar o argumento.",
        "Evitar qualquer criterio.",
        "Trocar razoes por autoridade.",
        "Provar que discordancia e erro."
      ],
      "correctAnswer": "Testar e aperfeicoar o argumento.",
      "explanation": "Objecoes ajudam a identificar limites e fortalecer uma tese.",
      "misconception": {
        "option": "Evitar qualquer criterio.",
        "code": "OBJECTION_AS_ATTACK",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-5",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "etica",
      "statement": "Uma decisao pode beneficiar muitos, mas prejudicar um grupo vulneravel. Qual pergunta e pertinente?",
      "options": [
        "Como distribuir beneficios e danos de modo justificavel?",
        "Quantas pessoas concordam nas redes?",
        "Quem falou primeiro?",
        "Qual escolha e mais rapida?"
      ],
      "correctAnswer": "Como distribuir beneficios e danos de modo justificavel?",
      "explanation": "A avaliacao etica considera impactos e justificacao.",
      "misconception": {
        "option": "Quantas pessoas concordam nas redes?",
        "code": "MAJORITY_REPLACES_ETHICS",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-6",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "analogia",
      "statement": "Comparar uma regra escolar com uma regra de um jogo pode ajudar quando:",
      "options": [
        "As semelhancas relevantes e os limites da comparacao sao explicitados.",
        "Toda comparacao prova a conclusao.",
        "As diferencas sao ignoradas.",
        "Analogia dispensa razoes."
      ],
      "correctAnswer": "As semelhancas relevantes e os limites da comparacao sao explicitados.",
      "explanation": "Analogia orienta, mas precisa mostrar por que a relacao e pertinente.",
      "misconception": {
        "option": "Toda comparacao prova a conclusao.",
        "code": "ANALOGY_AS_PROOF",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-7",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "ceticismo",
      "statement": "Duvidar de uma afirmacao para pedir evidencia e diferente de negar tudo porque:",
      "options": [
        "A duvida metodica busca criterios para avaliar.",
        "Ceticismo impede qualquer investigacao.",
        "Toda evidencia e opiniao.",
        "Negacao sem razao e mais rigorosa."
      ],
      "correctAnswer": "A duvida metodica busca criterios para avaliar.",
      "explanation": "Questionar com metodo nao equivale a rejeitar todo conhecimento.",
      "misconception": {
        "option": "Ceticismo impede qualquer investigacao.",
        "code": "SKEPTICISM_AS_DENIAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-8",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "liberdade",
      "statement": "Se escolhas sao influenciadas por contexto social, ainda e relevante perguntar:",
      "options": [
        "Quais condicoes ampliam ou limitam a autonomia?",
        "Se contexto torna toda escolha falsa.",
        "Se liberdade so existe sem sociedade.",
        "Se responsabilidade desaparece sempre."
      ],
      "correctAnswer": "Quais condicoes ampliam ou limitam a autonomia?",
      "explanation": "A filosofia pode analisar graus e condicoes de autonomia.",
      "misconception": {
        "option": "Se contexto torna toda escolha falsa.",
        "code": "CONTEXT_ERASES_AGENCY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-9",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "conhecimento",
      "statement": "O que diferencia conhecimento de palpite em uma previsao de chuva?",
      "options": [
        "A justificacao e a possibilidade de exame da evidencia.",
        "A certeza absoluta em qualquer caso.",
        "A quantidade de pessoas que repetem a frase.",
        "A velocidade da resposta."
      ],
      "correctAnswer": "A justificacao e a possibilidade de exame da evidencia.",
      "explanation": "Conhecimento exige mais que opiniao: requer justificacao examinavel.",
      "misconception": {
        "option": "A certeza absoluta em qualquer caso.",
        "code": "BELIEF_EQUALS_KNOWLEDGE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-10",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "falacia",
      "statement": "Dizer que uma proposta e falsa apenas porque seu autor errou em outro assunto e:",
      "options": [
        "Ataque a pessoa em vez do argumento.",
        "Evidencia experimental.",
        "Definicao conceitual.",
        "Silogismo valido."
      ],
      "correctAnswer": "Ataque a pessoa em vez do argumento.",
      "explanation": "A origem pessoal nao refuta o conteudo da proposta.",
      "misconception": {
        "option": "Evidencia experimental.",
        "code": "PERSON_ATTACK_AS_REFUTATION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-11",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "pensamento critico",
      "statement": "Ao ouvir uma afirmacao viral, uma atitude filosofica e:",
      "options": [
        "Perguntar conceitos, razoes, evidencias e contraexemplos.",
        "Compartilhar antes de ler.",
        "Aceitar se for emocional.",
        "Rejeitar toda afirmacao."
      ],
      "correctAnswer": "Perguntar conceitos, razoes, evidencias e contraexemplos.",
      "explanation": "Pensamento critico organiza perguntas antes do julgamento.",
      "misconception": {
        "option": "Compartilhar antes de ler.",
        "code": "CRITICAL_THINKING_AS_CYNICISM",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-philosophy-philosophy_argument-12",
      "subject": "PHILOSOPHY",
      "domain": "ARGUMENTO",
      "targetSkill": "PHILOSOPHY_ARGUMENT",
      "topic": "anecdota",
      "statement": "Uma tese sobre transporte cita apenas um caso individual. Qual limite deve ser reconhecido?",
      "options": [
        "O caso ilustra, mas pode nao representar toda a cidade.",
        "Um caso prova qualquer generalizacao.",
        "Exemplos nunca tem valor.",
        "A tese se torna necessariamente falsa."
      ],
      "correctAnswer": "O caso ilustra, mas pode nao representar toda a cidade.",
      "explanation": "O argumento precisa ajustar a conclusao ao alcance da evidencia.",
      "misconception": {
        "option": "Um caso prova qualquer generalizacao.",
        "code": "ANECDOTE_GENERALIZED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "SOCIOLOGY": [
    {
      "id": "v3-sociology-sociology_institutions-1",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "instituicoes",
      "statement": "Familia, escola e Estado possuem regras e papeis que organizam a vida coletiva. Elas sao:",
      "options": [
        "Instituicoes sociais.",
        "Apenas grupos de amigos.",
        "Fenomenos naturais.",
        "Objetos sem normas."
      ],
      "correctAnswer": "Instituicoes sociais.",
      "explanation": "Instituicoes estruturam expectativas, papeis e praticas.",
      "misconception": {
        "option": "Apenas grupos de amigos.",
        "code": "INSTITUTION_CONFUSED_WITH_GROUP",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-2",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "socializacao",
      "statement": "Aprender regras de convivencia desde a infancia e parte do processo de:",
      "options": [
        "Socializacao.",
        "Industrializacao.",
        "Urbanizacao.",
        "Erosao."
      ],
      "correctAnswer": "Socializacao.",
      "explanation": "Socializacao transmite normas e formas de participar da sociedade.",
      "misconception": {
        "option": "Industrializacao.",
        "code": "SOCIALIZATION_MISNAMED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-3",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "norma e lei",
      "statement": "Uma norma social pode existir mesmo sem estar escrita em um codigo porque:",
      "options": [
        "Expectativas coletivas orientam comportamentos.",
        "Toda norma e natural.",
        "Leis nao influenciam costumes.",
        "Comportamentos nunca tem sancao social."
      ],
      "correctAnswer": "Expectativas coletivas orientam comportamentos.",
      "explanation": "Normas podem ser informais e produzir aprovacao ou reprovacao.",
      "misconception": {
        "option": "Toda norma e natural.",
        "code": "NORMS_ONLY_LAW",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-4",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "desigualdade",
      "statement": "Duas pessoas com o mesmo talento recebem oportunidades escolares diferentes por renda. Isso indica:",
      "options": [
        "Desigualdade de oportunidades.",
        "Igualdade plena.",
        "Apenas diferenca biologica.",
        "Ausencia de estrutura social."
      ],
      "correctAnswer": "Desigualdade de oportunidades.",
      "explanation": "Recursos economicos influenciam acesso e trajetorias.",
      "misconception": {
        "option": "Igualdade plena.",
        "code": "INEQUALITY_AS_EFFORT_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-5",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "cultura",
      "statement": "Uma pratica cultural muda ao entrar em contato com outras comunidades. Isso mostra que cultura:",
      "options": [
        "E aprendida, compartilhada e dinamica.",
        "E fixa biologicamente.",
        "E identica em todo lugar.",
        "Nao possui significados."
      ],
      "correctAnswer": "E aprendida, compartilhada e dinamica.",
      "explanation": "Cultura se transforma por interacao e disputas de significado.",
      "misconception": {
        "option": "E fixa biologicamente.",
        "code": "CULTURE_AS_FIXED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-6",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "trabalho",
      "statement": "A automacao pode substituir tarefas e criar novas qualificacoes. Qual analise e mais adequada?",
      "options": [
        "Considerar efeitos sobre ocupacoes, qualificacao e desigualdade.",
        "Concluir que todo trabalho desaparece.",
        "Ignorar tecnologia.",
        "Reduzir tudo a escolha individual."
      ],
      "correctAnswer": "Considerar efeitos sobre ocupacoes, qualificacao e desigualdade.",
      "explanation": "Mudancas do trabalho tem efeitos distribuidos de forma desigual.",
      "misconception": {
        "option": "Concluir que todo trabalho desaparece.",
        "code": "AUTOMATION_TOTALIZED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-7",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "movimentos",
      "statement": "Um movimento organiza pessoas para reivindicar transporte acessivel. Ele atua principalmente:",
      "options": [
        "Na disputa por direitos e politicas publicas.",
        "Apenas no consumo privado.",
        "Sem relacao com poder.",
        "Como fenomeno natural."
      ],
      "correctAnswer": "Na disputa por direitos e politicas publicas.",
      "explanation": "Movimentos sociais articulam demandas coletivas.",
      "misconception": {
        "option": "Apenas no consumo privado.",
        "code": "MOVEMENT_AS_PRIVATE_CHOICE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-8",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "identidade",
      "statement": "Uma pessoa participa de varios grupos e combina referencias diferentes. Isso indica que identidade:",
      "options": [
        "E plural e construida em relacoes sociais.",
        "E determinada por um unico grupo.",
        "Nao muda com experiencias.",
        "Nao tem dimensao coletiva."
      ],
      "correctAnswer": "E plural e construida em relacoes sociais.",
      "explanation": "Identidades sao formadas por pertencimentos e trajetorias.",
      "misconception": {
        "option": "E determinada por um unico grupo.",
        "code": "IDENTITY_AS_SINGLE_LABEL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-9",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "poder",
      "statement": "Uma regra define quem pode falar em uma reuniao e quais temas entram na pauta. Isso revela poder sobre:",
      "options": [
        "Participacao e agenda.",
        "Clima e relevo.",
        "Genes e celulas.",
        "Apenas linguagem privada."
      ],
      "correctAnswer": "Participacao e agenda.",
      "explanation": "Poder tambem opera definindo acesso e temas legitimados.",
      "misconception": {
        "option": "Clima e relevo.",
        "code": "POWER_AS_FORCE_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-10",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "pesquisa",
      "statement": "Uma pesquisa entrevista apenas pessoas de uma rede social. Qual cuidado e necessario?",
      "options": [
        "Reconhecer que a amostra pode nao representar toda a populacao.",
        "Tratar respostas como universais.",
        "Eliminar perguntas abertas.",
        "Concluir causalidade automaticamente."
      ],
      "correctAnswer": "Reconhecer que a amostra pode nao representar toda a populacao.",
      "explanation": "A selecao de participantes limita a generalizacao.",
      "misconception": {
        "option": "Tratar respostas como universais.",
        "code": "SAMPLE_REPRESENTATION_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-11",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "instituicao e mudanca",
      "statement": "Uma escola altera suas regras apos reivindicacoes de estudantes. Isso mostra que instituicoes:",
      "options": [
        "Podem reproduzir e tambem transformar normas.",
        "Sao imunes a conflitos.",
        "Existem sem participantes.",
        "Mudam apenas por causas naturais."
      ],
      "correctAnswer": "Podem reproduzir e tambem transformar normas.",
      "explanation": "Instituicoes sao historicas e disputadas.",
      "misconception": {
        "option": "Sao imunes a conflitos.",
        "code": "INSTITUTIONS_AS_IMMUTABLE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-sociology-sociology_institutions-12",
      "subject": "SOCIOLOGY",
      "domain": "INSTITUICOES",
      "targetSkill": "SOCIOLOGY_INSTITUTIONS",
      "topic": "midia",
      "statement": "Uma campanha viraliza e muda a pauta de uma reuniao municipal. A analise deve observar:",
      "options": [
        "Como comunicacao, poder e participacao se articulam.",
        "Somente o numero de curtidas.",
        "A tecnologia como causa unica.",
        "A ausencia de atores sociais."
      ],
      "correctAnswer": "Como comunicacao, poder e participacao se articulam.",
      "explanation": "Mediacoes digitais alteram circulacao de demandas sem explicar tudo sozinhas.",
      "misconception": {
        "option": "Somente o numero de curtidas.",
        "code": "MEDIA_TECHNOLOGY_DETERMINISM",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "ART": [
    {
      "id": "v3-art-art_interpretation-1",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "composicao",
      "statement": "Uma fotografia usa linhas diagonais para conduzir o olhar ate uma janela iluminada. Qual elemento esta em destaque?",
      "options": [
        "Direcao e composicao.",
        "Apenas o suporte fisico.",
        "O preco da fotografia.",
        "A biografia do observador."
      ],
      "correctAnswer": "Direcao e composicao.",
      "explanation": "Linhas podem organizar o percurso visual na imagem.",
      "misconception": {
        "option": "Apenas o suporte fisico.",
        "code": "FORM_IGNORED_FOR_CONTENT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-2",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "contraste",
      "statement": "Em uma pintura, azul escuro ao lado de amarelo intenso cria forte:",
      "options": [
        "Contraste de cor.",
        "Perspectiva linear.",
        "Textura sonora.",
        "Escala temporal."
      ],
      "correctAnswer": "Contraste de cor.",
      "explanation": "A oposicao de matizes aumenta a diferenca visual percebida.",
      "misconception": {
        "option": "Perspectiva linear.",
        "code": "CONTRAST_CONFUSED_WITH_TEXTURE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-3",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "contexto da obra",
      "statement": "Para interpretar um mural sobre trabalho urbano, e importante observar:",
      "options": [
        "Tema, local, periodo e escolhas visuais.",
        "Somente o tamanho do mural.",
        "A opiniao de um unico espectador.",
        "A tinta como prova de autoria."
      ],
      "correctAnswer": "Tema, local, periodo e escolhas visuais.",
      "explanation": "Contexto amplia a leitura sem substituir a observacao.",
      "misconception": {
        "option": "Somente o tamanho do mural.",
        "code": "ART_CONTEXT_REDUCED_TO_DATE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-4",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "abstracao",
      "statement": "Uma obra nao representa objetos reconheciveis, mas repete formas geometricas. Uma leitura adequada e:",
      "options": [
        "Analisar ritmo, forma, cor e relacoes visuais.",
        "Concluir que nao existe significado.",
        "Procurar uma fotografia escondida.",
        "Ignorar toda composicao."
      ],
      "correctAnswer": "Analisar ritmo, forma, cor e relacoes visuais.",
      "explanation": "Abstracao organiza sentidos por elementos visuais.",
      "misconception": {
        "option": "Concluir que nao existe significado.",
        "code": "ABSTRACTION_AS_MEANINGLESS",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-5",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "patrimonio",
      "statement": "Uma comunidade restaura um painel antigo e registra relatos de moradores. O projeto valoriza:",
      "options": [
        "Memoria, materialidade e participacao.",
        "Apenas o valor comercial.",
        "A obra sem contexto.",
        "A substituicao do painel por publicidade."
      ],
      "correctAnswer": "Memoria, materialidade e participacao.",
      "explanation": "Patrimonio envolve objeto e significados da comunidade.",
      "misconception": {
        "option": "Apenas o valor comercial.",
        "code": "HERITAGE_AS_COMMODITY_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-6",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "hierarquia visual",
      "statement": "Uma imagem mostra uma figura central maior que as demais. O tamanho pode sugerir:",
      "options": [
        "Hierarquia ou destaque.",
        "Somente distancia real.",
        "Ausencia de composicao.",
        "Um movimento sonoro."
      ],
      "correctAnswer": "Hierarquia ou destaque.",
      "explanation": "Escala visual orienta a atencao no conjunto.",
      "misconception": {
        "option": "Somente distancia real.",
        "code": "SCALE_AS_REAL_SIZE_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-7",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "arte e sociedade",
      "statement": "Um cartaz de campanha apresenta cores nacionais e pessoas diversas. Para interpreta-lo, vale perguntar:",
      "options": [
        "Que valores e identidades a imagem procura mobilizar.",
        "Apenas quem fabricou o papel.",
        "Se a cor e bonita sem contexto.",
        "Se toda campanha e neutra."
      ],
      "correctAnswer": "Que valores e identidades a imagem procura mobilizar.",
      "explanation": "Imagens publicas comunicam valores e pertencimentos.",
      "misconception": {
        "option": "Apenas quem fabricou o papel.",
        "code": "IMAGE_AS_NEUTRAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-8",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "tecnica",
      "statement": "Uma gravura apresenta marcas repetidas e areas de tinta mais espessas. A observacao pode investigar:",
      "options": [
        "Como a tecnica produz textura e contraste.",
        "Somente a idade do artista.",
        "O som emitido pela tinta.",
        "A ausencia de materialidade."
      ],
      "correctAnswer": "Como a tecnica produz textura e contraste.",
      "explanation": "Procedimentos materiais tambem participam do sentido visual.",
      "misconception": {
        "option": "Somente a idade do artista.",
        "code": "TECHNIQUE_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-9",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "perspectiva",
      "statement": "Linhas que parecem convergir ao longe criam efeito de:",
      "options": [
        "Perspectiva.",
        "Colagem sonora.",
        "Contraste termico.",
        "Textura tatil real."
      ],
      "correctAnswer": "Perspectiva.",
      "explanation": "A convergencia organiza profundidade na imagem.",
      "misconception": {
        "option": "Colagem sonora.",
        "code": "PERSPECTIVE_CONFUSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-10",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "interpretacao plural",
      "statement": "Duas pessoas interpretam uma obra de modos diferentes e apontam elementos observaveis. Isso mostra que:",
      "options": [
        "Leituras podem ser plurais quando justificadas pela obra.",
        "Qualquer leitura vale sem evidencia.",
        "A obra tem um unico significado obrigatorio.",
        "Observacao impede interpretacao."
      ],
      "correctAnswer": "Leituras podem ser plurais quando justificadas pela obra.",
      "explanation": "Interpretacao admite diversidade com argumentos visuais.",
      "misconception": {
        "option": "Qualquer leitura vale sem evidencia.",
        "code": "PLURALITY_AS_ANYTHING_GOES",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-11",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "processo criativo",
      "statement": "Um sketchbook mostra varias tentativas antes da obra final. O material evidencia:",
      "options": [
        "Decisoes e revisoes do processo criativo.",
        "Que a obra final foi automatica.",
        "Que rascunhos nao tem valor.",
        "A impossibilidade de planejar."
      ],
      "correctAnswer": "Decisoes e revisoes do processo criativo.",
      "explanation": "Rascunhos tornam visiveis escolhas e experimentacoes.",
      "misconception": {
        "option": "Que a obra final foi automatica.",
        "code": "PROCESS_HIDDEN",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-art-art_interpretation-12",
      "subject": "ART",
      "domain": "INTERPRETACAO",
      "targetSkill": "ART_INTERPRETATION",
      "topic": "curadoria",
      "statement": "Uma exposicao organiza obras por tema e explica os criterios em um texto. A curadoria:",
      "options": [
        "Cria um percurso de leitura para o publico.",
        "Define um unico sentido imutavel.",
        "Substitui as obras.",
        "Serve apenas para vender ingressos."
      ],
      "correctAnswer": "Cria um percurso de leitura para o publico.",
      "explanation": "Curadoria relaciona obras sem impedir leituras do visitante.",
      "misconception": {
        "option": "Define um unico sentido imutavel.",
        "code": "CURATION_AS_AUTHORITARIAN",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "PHYSICAL_EDUCATION": [
    {
      "id": "v3-physical_education-pe_sport_principles-1",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "ocupacao",
      "statement": "Em um jogo coletivo, manter a equipe espalhada pode criar linhas de passe. Qual principio aparece?",
      "options": [
        "Ocupacao de espacos.",
        "Imobilidade obrigatoria.",
        "Falta tecnica.",
        "Aquecimento passivo."
      ],
      "correctAnswer": "Ocupacao de espacos.",
      "explanation": "A distribuicao espacial amplia opcoes de passe e ataque.",
      "misconception": {
        "option": "Imobilidade obrigatoria.",
        "code": "SPACE_OCCUPATION_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-2",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "defesa",
      "statement": "Uma equipe marca a linha de passe e protege a area central. Essa acao busca:",
      "options": [
        "Reduzir opcoes do adversario.",
        "Aumentar o espaco adversario.",
        "Evitar qualquer comunicacao.",
        "Substituir o aquecimento."
      ],
      "correctAnswer": "Reduzir opcoes do adversario.",
      "explanation": "A defesa organiza cobertura e limita caminhos.",
      "misconception": {
        "option": "Aumentar o espaco adversario.",
        "code": "DEFENSE_AS_CHASING_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-3",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "fair play",
      "statement": "Dois jogadores discordam de uma falta e consultam a regra antes de retomar. A atitude expressa:",
      "options": [
        "Respeito as regras e ao dialogo.",
        "Vantagem a qualquer custo.",
        "Recusa da arbitragem.",
        "Ausencia de cooperacao."
      ],
      "correctAnswer": "Respeito as regras e ao dialogo.",
      "explanation": "Fair play inclui respeito mesmo em conflito.",
      "misconception": {
        "option": "Vantagem a qualquer custo.",
        "code": "FAIR_PLAY_AS_WINNING",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-4",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "aquecimento",
      "statement": "Antes de uma atividade intensa, a turma realiza movimentos graduais. A finalidade e:",
      "options": [
        "Preparar o corpo para a atividade.",
        "Garantir desempenho identico.",
        "Substituir todas as aulas.",
        "Evitar qualquer esforco."
      ],
      "correctAnswer": "Preparar o corpo para a atividade.",
      "explanation": "Aquecimento eleva gradualmente a demanda.",
      "misconception": {
        "option": "Garantir desempenho identico.",
        "code": "WARMUP_GUARANTEES_RESULT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-5",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "passe e apoio",
      "statement": "No futsal, um jogador passa e se desloca para oferecer nova linha de passe. Isso e:",
      "options": [
        "Criar apoio ao portador da bola.",
        "Abandonar a jogada.",
        "Impedir circulacao.",
        "Fazer uma falta."
      ],
      "correctAnswer": "Criar apoio ao portador da bola.",
      "explanation": "O deslocamento sem bola amplia possibilidades coletivas.",
      "misconception": {
        "option": "Abandonar a jogada.",
        "code": "OFF_BALL_MOVEMENT_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-6",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "ritmo",
      "statement": "Em uma corrida de resistencia, controlar o ritmo ajuda a:",
      "options": [
        "Sustentar o esforco ao longo do tempo.",
        "Aumentar a velocidade sem limite.",
        "Evitar qualquer respiracao.",
        "Garantir a mesma marca para todos."
      ],
      "correctAnswer": "Sustentar o esforco ao longo do tempo.",
      "explanation": "Ritmo relaciona intensidade e duracao.",
      "misconception": {
        "option": "Aumentar a velocidade sem limite.",
        "code": "ENDURANCE_AS_SPRINT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-7",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "inclusao",
      "statement": "Adaptar o tamanho da quadra e a regra de tempo para uma turma diversa favorece:",
      "options": [
        "Participacao com equidade.",
        "Exclusao de quem precisa de apoio.",
        "Competicao sem regras.",
        "Abolicao do objetivo da atividade."
      ],
      "correctAnswer": "Participacao com equidade.",
      "explanation": "A adaptacao remove barreiras sem retirar o sentido.",
      "misconception": {
        "option": "Exclusao de quem precisa de apoio.",
        "code": "EQUITY_CONFUSED_WITH_EQUALITY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-8",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "tatica",
      "statement": "Em um jogo, a equipe troca passes para deslocar a defesa antes de finalizar. A estrategia prioriza:",
      "options": [
        "Circulacao e criacao de espacos.",
        "Chutes aleatorios.",
        "Defesa individual parada.",
        "Interrupcao do jogo."
      ],
      "correctAnswer": "Circulacao e criacao de espacos.",
      "explanation": "Troca de passes pode abrir linhas.",
      "misconception": {
        "option": "Chutes aleatorios.",
        "code": "TACTIC_AS_INDIVIDUAL_SKILL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-9",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "regras",
      "statement": "No voleibol, a equipe deve respeitar o limite de toques antes de enviar a bola. A regra organiza:",
      "options": [
        "A continuidade e a participacao coletiva.",
        "Somente a altura da rede.",
        "A cor da bola.",
        "A velocidade do saque."
      ],
      "correctAnswer": "A continuidade e a participacao coletiva.",
      "explanation": "Limites de toque estruturam a dinamica.",
      "misconception": {
        "option": "Somente a altura da rede.",
        "code": "RULE_SCOPE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-10",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "saude",
      "statement": "Durante atividade intensa, perceber tontura e comunicar ao professor e importante porque:",
      "options": [
        "Permite interromper e avaliar a situacao.",
        "Prova falta de vontade.",
        "Garante melhor resultado.",
        "Substitui a hidratacao."
      ],
      "correctAnswer": "Permite interromper e avaliar a situacao.",
      "explanation": "Percepcao corporal e comunicacao ajudam na seguranca.",
      "misconception": {
        "option": "Prova falta de vontade.",
        "code": "BODY_SIGNAL_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-11",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "cooperacao",
      "statement": "Uma equipe reorganiza a estrategia para que todos participem de uma atividade. Isso demonstra:",
      "options": [
        "Cooperacao e responsabilidade coletiva.",
        "Apenas busca por recorde.",
        "Ausencia de objetivo.",
        "Competicao individual."
      ],
      "correctAnswer": "Cooperacao e responsabilidade coletiva.",
      "explanation": "Participacao de todos exige decisao coletiva.",
      "misconception": {
        "option": "Apenas busca por recorde.",
        "code": "COOPERATION_AS_NO_RULES",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-physical_education-pe_sport_principles-12",
      "subject": "PHYSICAL_EDUCATION",
      "domain": "ESPORTES",
      "targetSkill": "PE_SPORT_PRINCIPLES",
      "topic": "observacao",
      "statement": "Ao analisar um jogo, observar deslocamentos, passes e escolhas taticas permite:",
      "options": [
        "Compreender o desempenho sem reduzir a pessoa ao resultado.",
        "Medir apenas velocidade.",
        "Definir valor pessoal do jogador.",
        "Ignorar contexto e regras."
      ],
      "correctAnswer": "Compreender o desempenho sem reduzir a pessoa ao resultado.",
      "explanation": "Analise observacional considera comportamento e contexto.",
      "misconception": {
        "option": "Medir apenas velocidade.",
        "code": "PERFORMANCE_AS_PERSONAL_WORTH",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "ENGLISH": [
    {
      "id": "v3-english-english_reading-1",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "main idea",
      "statement": "Read: The school garden supplies herbs for the cafeteria and gives students a place to study insects. What is the main idea?",
      "options": [
        "The garden supports food and learning.",
        "The garden is used only for sports.",
        "Students avoid science.",
        "The cafeteria closed."
      ],
      "correctAnswer": "The garden supports food and learning.",
      "explanation": "The answer combines the two purposes in the text.",
      "misconception": {
        "option": "The garden is used only for sports.",
        "code": "MAIN_IDEA_CONFUSED_WITH_DETAIL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-2",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "literal detail",
      "statement": "Read: The workshop starts at 9 a.m. on Saturday. When does it start?",
      "options": [
        "At 9 a.m. on Saturday.",
        "At 8 p.m. on Friday.",
        "At noon on Sunday.",
        "At 10 a.m. on Monday."
      ],
      "correctAnswer": "At 9 a.m. on Saturday.",
      "explanation": "The answer repeats the explicit time and day.",
      "misconception": {
        "option": "At 8 p.m. on Friday.",
        "code": "EXPLICIT_DETAIL_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-3",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "vocabulary",
      "statement": "In The path is narrow, but safe, the word narrow means:",
      "options": [
        "Not wide.",
        "Very fast.",
        "Extremely loud.",
        "Full of water."
      ],
      "correctAnswer": "Not wide.",
      "explanation": "Narrow describes limited width.",
      "misconception": {
        "option": "Very fast.",
        "code": "VOCABULARY_LITERAL_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-4",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "inference",
      "statement": "Read: Maya took an umbrella after checking the dark clouds. What can we infer?",
      "options": [
        "She expected rain.",
        "She had lost her bicycle.",
        "She was going swimming.",
        "The sun was very strong."
      ],
      "correctAnswer": "She expected rain.",
      "explanation": "The action and clouds support this inference.",
      "misconception": {
        "option": "She had lost her bicycle.",
        "code": "INFERENCE_AS_CERTAINTY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-5",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "reference",
      "statement": "In The team planted trees because they wanted more shade, they refers to:",
      "options": [
        "The team.",
        "The trees.",
        "The shade.",
        "The street."
      ],
      "correctAnswer": "The team.",
      "explanation": "The pronoun agrees with the group doing the planting.",
      "misconception": {
        "option": "The trees.",
        "code": "PRONOUN_REFERENCE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-6",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "sequence",
      "statement": "First Ana measured the soil, then she added seeds. What happened first?",
      "options": [
        "She measured the soil.",
        "She added seeds.",
        "She watered flowers.",
        "She closed the garden."
      ],
      "correctAnswer": "She measured the soil.",
      "explanation": "First marks the initial action.",
      "misconception": {
        "option": "She added seeds.",
        "code": "SEQUENCE_REVERSED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-7",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "purpose",
      "statement": "A poster says Bring a reusable bottle to reduce waste. Its purpose is to:",
      "options": [
        "Encourage an action.",
        "Report yesterday weather.",
        "Tell a fictional story.",
        "Define a musical note."
      ],
      "correctAnswer": "Encourage an action.",
      "explanation": "The imperative invites the reader to act.",
      "misconception": {
        "option": "Report yesterday weather.",
        "code": "GENRE_PURPOSE_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-8",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "contrast",
      "statement": "The text says The bus is slower, but it is cheaper. What contrast is presented?",
      "options": [
        "Speed and cost.",
        "Weather and food.",
        "Age and height.",
        "Noise and color."
      ],
      "correctAnswer": "Speed and cost.",
      "explanation": "But connects two contrasting qualities.",
      "misconception": {
        "option": "Weather and food.",
        "code": "CONTRAST_CONNECTOR_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-9",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "evidence",
      "statement": "Read: The river level fell after three weeks without rain. Which statement is supported?",
      "options": [
        "Lack of rain was associated with a lower river level.",
        "Rain always increases pollution.",
        "The river disappeared forever.",
        "No one measured the river."
      ],
      "correctAnswer": "Lack of rain was associated with a lower river level.",
      "explanation": "The statement stays within the evidence.",
      "misconception": {
        "option": "Rain always increases pollution.",
        "code": "EVIDENCE_OVERGENERALIZED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-10",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "summary",
      "statement": "A paragraph describes a student reading, taking notes and comparing sources. Which summary is best?",
      "options": [
        "The student studies by reading and checking sources.",
        "The student only copies a title.",
        "The student avoids all evidence.",
        "The student writes a fictional poem."
      ],
      "correctAnswer": "The student studies by reading and checking sources.",
      "explanation": "The summary keeps the central actions.",
      "misconception": {
        "option": "The student only copies a title.",
        "code": "SUMMARY_ADDS_DETAIL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-11",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "prefix",
      "statement": "In unhappy, the prefix un- most likely means:",
      "options": [
        "Not.",
        "Again.",
        "Before.",
        "Very."
      ],
      "correctAnswer": "Not.",
      "explanation": "Un- commonly negates the adjective.",
      "misconception": {
        "option": "Again.",
        "code": "PREFIX_MEANING_MISREAD",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-english-english_reading-12",
      "subject": "ENGLISH",
      "domain": "LEITURA",
      "targetSkill": "ENGLISH_READING",
      "topic": "critical reading",
      "statement": "A post claims one drink improves every exam result but gives no source. What is the best response?",
      "options": [
        "Ask for evidence before accepting the claim.",
        "Share it because it sounds positive.",
        "Assume every claim is false.",
        "Ignore the wording and buy it."
      ],
      "correctAnswer": "Ask for evidence before accepting the claim.",
      "explanation": "Critical reading checks the claim and its support.",
      "misconception": {
        "option": "Share it because it sounds positive.",
        "code": "CLAIM_WITHOUT_EVIDENCE_ACCEPTED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "RELIGIOUS_EDUCATION": [
    {
      "id": "v3-religious_education-religious_diversity-1",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "traditions",
      "statement": "A class compares harvest celebrations from different communities. A respectful study should:",
      "options": [
        "Describe practices in their own contexts.",
        "Rank traditions as better or worse.",
        "Assume all practices are identical.",
        "Replace accounts with stereotypes."
      ],
      "correctAnswer": "Describe practices in their own contexts.",
      "explanation": "Contextual description avoids hierarchy and caricature.",
      "misconception": {
        "option": "Rank traditions as better or worse.",
        "code": "TRADITION_RANKING",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-2",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "diversity",
      "statement": "Students hear different beliefs about the origin of life. A plural dialogue asks them to:",
      "options": [
        "Listen, identify differences and discuss respectfully.",
        "Force one belief on everyone.",
        "Mock disagreement.",
        "Erase all religious vocabulary."
      ],
      "correctAnswer": "Listen, identify differences and discuss respectfully.",
      "explanation": "Plural education protects dialogue and dignity.",
      "misconception": {
        "option": "Force one belief on everyone.",
        "code": "DIALOGUE_CONFUSED_WITH_CONVERSION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-3",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "secular context",
      "statement": "A public school studies religion without requiring adherence. The educational approach is:",
      "options": [
        "Descriptive and non-confessional.",
        "A worship service.",
        "A test of personal faith.",
        "A ranking of families."
      ],
      "correctAnswer": "Descriptive and non-confessional.",
      "explanation": "The class studies phenomena without imposing belief.",
      "misconception": {
        "option": "A worship service.",
        "code": "DESCRIPTIVE_STUDY_AS_WORSHIP",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-4",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "ritual",
      "statement": "A ritual may include gestures, objects and words meaningful to a community. To understand it, one should:",
      "options": [
        "Ask what meanings participants attribute to it.",
        "Assume every ritual has the same meaning.",
        "Treat objects as decoration only.",
        "Ignore the community."
      ],
      "correctAnswer": "Ask what meanings participants attribute to it.",
      "explanation": "Meaning is connected to practice and community.",
      "misconception": {
        "option": "Assume every ritual has the same meaning.",
        "code": "RITUAL_REDUCED_TO_OBJECT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-5",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "respect",
      "statement": "A student asks a colleague about a tradition. Which question is respectful?",
      "options": [
        "Como voce interpreta essa pratica?",
        "Por que sua tradicao e estranha?",
        "Voce acredita em tudo sem pensar?",
        "Sua familia nao tem ciencia?"
      ],
      "correctAnswer": "Como voce interpreta essa pratica?",
      "explanation": "The question invites explanation without judgment.",
      "misconception": {
        "option": "Por que sua tradicao e estranha?",
        "code": "STEREOTYPE_AS_QUESTION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-6",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "internal diversity",
      "statement": "There can be different interpretations within the same tradition. This shows that traditions:",
      "options": [
        "Have internal diversity and historical change.",
        "Are identical for every member.",
        "Never change over time.",
        "Have no social context."
      ],
      "correctAnswer": "Have internal diversity and historical change.",
      "explanation": "Communities interpret and live traditions in varied ways.",
      "misconception": {
        "option": "Are identical for every member.",
        "code": "TRADITION_AS_MONOLITH",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-7",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "worldviews",
      "statement": "A worldview may connect ideas about meaning, nature and community. A careful study should:",
      "options": [
        "Examine how these ideas relate in a specific context.",
        "Assume every worldview rejects science.",
        "Reduce it to one slogan.",
        "Separate it from any lived practice."
      ],
      "correctAnswer": "Examine how these ideas relate in a specific context.",
      "explanation": "Worldviews are systems of meaning, not isolated labels.",
      "misconception": {
        "option": "Assume every worldview rejects science.",
        "code": "WORLDVIEW_REDUCED_TO_SLOGAN",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-8",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "freedom",
      "statement": "Respecting freedom of belief in school means:",
      "options": [
        "Protecting different convictions and the right not to adhere.",
        "Requiring one answer from everyone.",
        "Allowing insults as debate.",
        "Ignoring discrimination."
      ],
      "correctAnswer": "Protecting different convictions and the right not to adhere.",
      "explanation": "Freedom includes belief, non-belief and protection from coercion.",
      "misconception": {
        "option": "Requiring one answer from everyone.",
        "code": "FREEDOM_AS_MAJORITY_RULE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-9",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "source",
      "statement": "An oral account of a festival should be studied with attention to:",
      "options": [
        "Who speaks, in what context and for what purpose.",
        "Only the date in a calendar.",
        "A stereotype from another group.",
        "A single outsider opinion."
      ],
      "correctAnswer": "Who speaks, in what context and for what purpose.",
      "explanation": "Source context helps interpret voice and meaning.",
      "misconception": {
        "option": "Only the date in a calendar.",
        "code": "SOURCE_CONTEXT_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-10",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "symbol",
      "statement": "A symbol can have different meanings in different communities. The safest interpretation is to:",
      "options": [
        "Use the community context before generalizing.",
        "Assign the same meaning everywhere.",
        "Assume symbols have no meaning.",
        "Choose the most exotic explanation."
      ],
      "correctAnswer": "Use the community context before generalizing.",
      "explanation": "Meaning is situated and should not be projected from outside.",
      "misconception": {
        "option": "Assign the same meaning everywhere.",
        "code": "SYMBOL_MEANING_UNIVERSALIZED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-11",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "prejudice",
      "statement": "Calling a whole community violent based on one news story is:",
      "options": [
        "A stereotype and an unjustified generalization.",
        "A careful comparative method.",
        "A neutral description.",
        "A source criticism."
      ],
      "correctAnswer": "A stereotype and an unjustified generalization.",
      "explanation": "One case cannot define a diverse community.",
      "misconception": {
        "option": "A careful comparative method.",
        "code": "SINGLE_CASE_STEREOTYPE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-religious_education-religious_diversity-12",
      "subject": "RELIGIOUS_EDUCATION",
      "domain": "DIVERSIDADE",
      "targetSkill": "RELIGIOUS_DIVERSITY",
      "topic": "dialogue norms",
      "statement": "A productive classroom dialogue about belief should include:",
      "options": [
        "Turn-taking, evidence, respect and space for disagreement.",
        "Interruption and ridicule.",
        "A vote to silence minorities.",
        "Personal attacks."
      ],
      "correctAnswer": "Turn-taking, evidence, respect and space for disagreement.",
      "explanation": "Dialogue rules protect participation and dignity.",
      "misconception": {
        "option": "Interruption and ridicule.",
        "code": "DIALOGUE_AS_CONFLICT",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
  "COMPUTING": [
    {
      "id": "v3-computing-computing_algorithms-1",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "decomposition",
      "statement": "To plan a school app, the team lists login, schedule and messages as separate tasks. This is:",
      "options": [
        "Decomposition.",
        "Encryption.",
        "Randomization.",
        "Compression."
      ],
      "correctAnswer": "Decomposition.",
      "explanation": "Breaking a problem into smaller tasks makes it manageable.",
      "misconception": {
        "option": "Encryption.",
        "code": "DECOMPOSITION_CONFUSED_WITH_CODING",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-2",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "sequence",
      "statement": "An algorithm says: receive score, add points, display total. What concept is shown?",
      "options": [
        "Sequence of steps.",
        "A loop without condition.",
        "A password.",
        "A network address."
      ],
      "correctAnswer": "Sequence of steps.",
      "explanation": "The instructions run in an ordered progression.",
      "misconception": {
        "option": "A loop without condition.",
        "code": "SEQUENCE_ORDER_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-3",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "condition",
      "statement": "If the temperature is below 18, show a coat reminder. The if statement represents:",
      "options": [
        "A condition.",
        "A file format.",
        "A variable name only.",
        "A drawing tool."
      ],
      "correctAnswer": "A condition.",
      "explanation": "The action depends on a true or false test.",
      "misconception": {
        "option": "A file format.",
        "code": "CONDITION_CONFUSED_WITH_ACTION",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-4",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "loop",
      "statement": "A program repeats reading names until the list ends. Which structure is useful?",
      "options": [
        "A loop.",
        "A single constant.",
        "A color palette.",
        "A manual screenshot."
      ],
      "correctAnswer": "A loop.",
      "explanation": "Repetition avoids writing the same step for every name.",
      "misconception": {
        "option": "A single constant.",
        "code": "LOOP_AS_SINGLE_STEP",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-5",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "debugging",
      "statement": "The app totals 2 + 3 as 23 because values were read as text. What is debugging here?",
      "options": [
        "Finding and correcting the type error.",
        "Deleting the whole app.",
        "Changing the screen color.",
        "Adding a random delay."
      ],
      "correctAnswer": "Finding and correcting the type error.",
      "explanation": "The behavior points to a data representation problem.",
      "misconception": {
        "option": "Deleting the whole app.",
        "code": "DEBUGGING_AS_RESTART",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-6",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "trace",
      "statement": "A trace table records variable values after each step. Its purpose is to:",
      "options": [
        "Follow the algorithm state.",
        "Hide input data.",
        "Encrypt every variable.",
        "Replace testing."
      ],
      "correctAnswer": "Follow the algorithm state.",
      "explanation": "Tracing makes intermediate results visible for checking.",
      "misconception": {
        "option": "Hide input data.",
        "code": "TRACE_AS_OUTPUT_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-7",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "binary",
      "statement": "A computer stores a black-and-white pixel using 0 and 1. This illustrates:",
      "options": [
        "Digital binary representation.",
        "A natural language sentence.",
        "A physical analog meter.",
        "A password policy."
      ],
      "correctAnswer": "Digital binary representation.",
      "explanation": "Binary symbols encode discrete states.",
      "misconception": {
        "option": "A natural language sentence.",
        "code": "BINARY_AS_DECIMAL_ONLY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-8",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "data privacy",
      "statement": "An app asks for a student location when it only needs a class name. A better design is to:",
      "options": [
        "Collect only the data needed for the purpose.",
        "Collect every possible field.",
        "Publish the location.",
        "Disable all access controls."
      ],
      "correctAnswer": "Collect only the data needed for the purpose.",
      "explanation": "Data minimization reduces unnecessary exposure.",
      "misconception": {
        "option": "Collect every possible field.",
        "code": "DATA_MINIMIZATION_IGNORED",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-9",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "password security",
      "statement": "A service stores passwords with a one-way hash and salt. The main goal is:",
      "options": [
        "Reduce exposure if stored data leaks.",
        "Make passwords public.",
        "Recover every original password.",
        "Avoid user authentication."
      ],
      "correctAnswer": "Reduce exposure if stored data leaks.",
      "explanation": "Hashing and salting protect stored representations.",
      "misconception": {
        "option": "Make passwords public.",
        "code": "HASH_AS_ENCRYPTION_RECOVERY",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-10",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "algorithm fairness",
      "statement": "A school recommendation model uses attendance as the only signal. A responsible review should ask:",
      "options": [
        "Whether the signal creates unfair effects or misses context.",
        "Whether the model can never be wrong.",
        "Whether students should lose access.",
        "Whether context is irrelevant."
      ],
      "correctAnswer": "Whether the signal creates unfair effects or misses context.",
      "explanation": "Responsible computing examines effects and limits.",
      "misconception": {
        "option": "Whether the model can never be wrong.",
        "code": "SINGLE_SIGNAL_AS_NEUTRAL",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-11",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "protocol",
      "statement": "A browser requests a page and a server returns data. This exchange follows:",
      "options": [
        "A communication protocol.",
        "A spreadsheet formula.",
        "A drawing layer.",
        "A battery charge."
      ],
      "correctAnswer": "A communication protocol.",
      "explanation": "Protocols define how systems exchange messages.",
      "misconception": {
        "option": "A spreadsheet formula.",
        "code": "PROTOCOL_CONFUSED_WITH_DEVICE",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    },
    {
      "id": "v3-computing-computing_algorithms-12",
      "subject": "COMPUTING",
      "domain": "PENSAMENTO_COMPUTACIONAL",
      "targetSkill": "COMPUTING_ALGORITHMS",
      "topic": "digital citizenship",
      "statement": "Before forwarding a dramatic post, a student checks source, date and evidence. This is:",
      "options": [
        "Responsible digital citizenship.",
        "Data deletion.",
        "A sorting algorithm.",
        "A hardware repair."
      ],
      "correctAnswer": "Responsible digital citizenship.",
      "explanation": "Checking context reduces harmful misinformation sharing.",
      "misconception": {
        "option": "Data deletion.",
        "code": "SHARING_BEFORE_CHECKING",
        "confidenceWeight": 0.8
      },
      "secondaryLinks": []
    }
  ],
};
