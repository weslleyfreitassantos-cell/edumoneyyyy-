# Mapeamento BNCC → grafo TecEscola

`coverage-2018.json` é a matriz de prestação de contas do catálogo oficial.
Ela contém uma linha para cada código extraído da versão congelada da BNCC.

`UNACCOUNTED` é intencionalmente diferente de `MAPPED`: significa que a
habilidade ainda precisa de decisão pedagógica e não pode aparecer como
conteúdo alinhado automaticamente. Uma linha só pode virar `MAPPED` quando
referenciar uma ou mais habilidades canônicas existentes e registrar a fonte,
a confiança e a revisão correspondente. Objetivos que não são adaptativos
devem usar `EXPLICITLY_NON_ADAPTIVE` com justificativa explícita.

`candidates-2018.json` é uma camada anterior à promoção. A fábrica em
`tools/bncc/map-candidates.mjs` verifica etapa, ano e componente antes de
propor uma habilidade canônica existente. Quando não há correspondência
compatível, registra `CANONICAL_GAP`; não cria uma skill com o nome do código
oficial. Todos os candidatos permanecem `PEDAGOGICAL_REVIEW_PENDING` e não
podem ser tratados como `MAPPED` sem validação independente e revisão humana.

`reviews-2018.json` é a camada de revisão técnica independente. Ela repete as
verificações de estrutura, etapa, ano, componente, unicidade e evidência lexical
sem importar a fábrica de candidatos. `APPROVE_CONSERVATIVE` significa apenas
que a evidência técnica é forte; a linha continua `NOT_PROMOTED` e
`PEDAGOGICAL_REVIEW_PENDING` até revisão pedagógica humana. Nós estruturais são
classificados como `HIERARCHY_ONLY` e lacunas permanecem `CANONICAL_GAP`.

O catálogo oficial e o grafo TecEscola permanecem camadas separadas. O V4
atual continua sendo conteúdo derivado da TecEscola; ele não é promovido a
BNCC oficial por semelhança textual.
