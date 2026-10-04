# Mapeamento BNCC → grafo TecEscola

`coverage-2018.json` é a matriz de prestação de contas do catálogo oficial.
Ela contém uma linha para cada código extraído da versão congelada da BNCC.

`SOURCE_REVIEW_REQUIRED` é intencionalmente diferente de `MAPPED`: significa
que a habilidade continua contabilizada, mas ainda precisa de decisão
pedagógica antes de aparecer como conteúdo alinhado automaticamente. Uma
linha só pode virar `MAPPED` quando referenciar uma ou mais habilidades
canônicas existentes e registrar a fonte, a confiança e a revisão
correspondente. Nós estruturais usam `HIERARCHY_ONLY`; objetivos que não são
adaptativos devem usar `EXPLICITLY_NON_ADAPTIVE` com justificativa explícita.
`UNACCOUNTED` é reservado para uma falha de contabilização e deve permanecer
em zero.

`candidates-2018.json` é uma camada anterior à promoção. A fábrica em
`tools/bncc/map-candidates.mjs` verifica etapa, ano e componente antes de
propor uma habilidade canônica existente. Quando não há correspondência
compatível, registra `CANONICAL_GAP`; não cria uma skill com o nome do código
oficial. Todos os candidatos permanecem `PEDAGOGICAL_REVIEW_PENDING` até uma
validação independente e decisão de promoção.

`reviews-2018.json` é a camada de revisão técnica independente. Ela repete as
verificações de estrutura, etapa, ano, componente, unicidade e evidência lexical
sem importar a fábrica de candidatos. `APPROVE_CONSERVATIVE` permite uma
promoção automatizada somente quando a allowlist estrita em
`promoted-2018.json` também passa; a linha continua `TECH_VALIDATED` e
`PEDAGOGICAL_REVIEW_PENDING`. Nenhuma promoção automatizada pode afirmar
`PEDAGOGICAL_REVIEWED`. Nós estruturais são classificados como
`HIERARCHY_ONLY` e lacunas permanecem `SOURCE_REVIEW_REQUIRED`.

O catálogo oficial e o grafo TecEscola permanecem camadas separadas. O V4
atual continua sendo conteúdo derivado da TecEscola; ele não é promovido a
BNCC oficial por semelhança textual.
