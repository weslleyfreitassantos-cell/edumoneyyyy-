# Tec Escola BNCC V5 — reconciliação histórica da PR #360

**Campanha:** `TECESCOLA_BNCC_V5_HISTORICAL_RECONCILIATION_V14`  
**Base comparada:** `main` `562fd003e643124981e8345a6a83b11a660c1d16`  
**PR histórica:** #360, head `2961073c44d3ae09605b3d481d346c92d7aec46b`, base original `codex/bncc-knowledge-factory-v4` em `edf53f75dc9693ff0467925cbef4613c0b432910`.

## Resumo executivo

A PR #360 não deve ser mesclada sobre a `main`: ela foi construída sobre uma base empilhada antiga e contém 767 caminhos alterados, incluindo migrations históricas, conteúdo pedagógico em STAGING, ferramentas de autoria e versões divergentes de arquivos que a `main` já possui. A reconciliação foi feita pela comparação dos blobs do head/base da PR e da `main`, não por correspondência de nomes.

Foram encontrados 45 blobs idênticos já presentes na `main` e 54 caminhos existentes com blobs diferentes. O inventário também registra 113 migrations SQL alteradas/adicionadas na diferença da PR, um conflito de versão confirmado, 225 pacotes de conteúdo V5 e 35 assets referenciados ausentes na `main`. A situação do ledger de produção não foi consultada: nenhuma migration da PR #360 é declarada aplicada por este relatório.

Dois incrementos técnicos foram isolados em PRs sucessoras. A PR #439 adiciona suporte opcional a estímulo visual local e renderização segura de Markdown para aulas; inclui uma migration candidata, ainda não promovida. Seus checks `validate` e `migration-promoter-postgres` passaram, enquanto `database` estava pendente na última consulta. A PR #440 contém uma correção independente para timeout de leituras públicas de branding e não é uma integração de conteúdo da #360. Nenhuma das duas foi mesclada ou publicada nesta campanha.

## Como reproduzir o inventário

O CSV contém uma linha para cada caminho na diferença `SOURCE_BASE..SOURCE_HEAD`, com status Git, SHA do blob de origem, SHA do blob da `main` quando existente, categoria, classificação, fundamento e ação recomendada. Gere novamente com:

```powershell
node tools/reconciliation/reconcile-bncc-pr360-v14.mjs
```

O script usa apenas objetos Git locais e JSONs da PR #360; não conecta ao banco nem escreve dados do produto. Arquivos classificados por heurística conservadora não são tratados como equivalentes funcionais sem inspeção comportamental.

## Inventário por categoria

| Categoria | Caminhos na diferença |
|---|---:|
| Tutor adaptativo | 83 |
| Serviços e APIs | 4 |
| Componentes React | 12 |
| Hooks e contextos | 3 |
| Questões e conteúdo | 262 |
| Mapeamentos BNCC | 156 |
| Ferramentas de geração e validação | 18 |
| Scripts pedagógicos | 0 |
| Migrations e suporte no diretório de migrations | 123 |
| Testes | 69 |
| Documentação | 3 |
| Educação inclusiva | 22 |
| Histórico ou outros | 12 |
| **Total** | **767** |

O diretório de migrations contém 120 arquivos `.sql` e três arquivos de teste/suporte na diferença examinada. A contagem de 123 não deve ser interpretada como 123 migrations SQL.

## Classificação por arquivo

| Classe | Quantidade | Decisão nesta reconciliação |
|---|---:|---|
| A — blob idêntico | 45 | Já está na `main`; não duplicar. |
| B — mesmo caminho, conteúdo diferente | 54 | Preservar a versão atual da `main`; o nome coincidente não prova equivalência semântica. |
| C — funcionalidade ausente recuperada | 0 caminhos diretos | Nenhum caminho da diferença é uma cópia direta das PRs sucessoras. A recuperação funcional está descrita separadamente abaixo. |
| D — migration ausente candidata | 113 | Não copiar nem aplicar; requer reconciliação específica de schema, ledger, dependências, ownership e RLS. |
| E — autoria, ferramentas, testes e documentos históricos | 154 | Manter a proveniência; adotar seletivamente quando um fluxo atual precisar e a ferramenta for compatível. |
| F — conteúdo/media pendente | 255 | Manter em STAGING e fora de publicação; revisar cada versão antes de qualquer promoção. |
| G — conflito ou compatibilidade não comprovada | 146 | Não importar até haver requisito e análise específica; o CSV registra o motivo por caminho. |

As classes B e G são deliberadamente conservadoras: não afirmam que todos os caminhos sejam obsoletos. Evitam tanto uma mesclagem em massa quanto a alegação de equivalência baseada apenas em nomes. Os 113 caminhos D incluem a migration de colisão, que é tratada como G na descrição funcional e não deve ser aplicada.

## Matriz funcional

| Funcionalidade | Evidência da `main` / PR histórica | Classe e destino |
|---|---|---|
| Central de Estudos e jornadas guiadas | A `main` possui `StudyCenterPage`, `GuidedJourneyPage`, `adaptiveLearningV3/V4`, `adaptiveLearningEngine` e validadores atuais. A PR #360 contém snapshots e expansões antigos sobre sua base histórica. | B: preservar a arquitetura atual; não substituir por versões antigas. |
| Dicas guiadas e evidência independente | O fluxo atual usa as RPCs atuais; a evolução da `main` inclui a separação de evidência independente. | B: manter as regras atuais de dica, mastery, progresso e XP. Não importar SQL antigo que altere essa semântica. |
| Estímulo visual opcional em questões | A `main` não tinha contrato/renderizador para `visual_stimulus`; a PR #360 contém conteúdo e referências visuais. | C funcional: PR #439 adiciona o payload opcional e renderiza somente imagens locais com `alt` obrigatório e legenda opcional. A migration candidata só atualiza as respostas das RPCs; não muda progresso, XP ou publicação. Aguarda CI/revisão e não foi aplicada. |
| Explicações de aula em Markdown | O renderizador atual tratava a explicação como texto simples. | C funcional: PR #439 adiciona Markdown com GFM, listas, tabelas, código e matemática; links são sanitizados e HTML bruto não é aceito. Testes focados locais passaram; PR não foi mesclada. |
| Conteúdo question-first V5 | 225 JSONs, com 11.187 instâncias de questão. | F: não importar em lote. 76 pacotes passaram pela validação estrutural anterior; 149 não passaram. Isso não equivale a aprovação pedagógica. |
| Autoria, banco de questões docente e publicação de atividades | A `main` já contém fluxos posteriores de atividade e Quiz Live, enquanto a PR #360 traz ferramentas e implementações da época da base histórica. | B/G: não substituir ou duplicar automaticamente; comparar contratos e comportamento apenas para uma lacuna concreta. |
| Educação inclusiva | Há 22 caminhos relacionados na diferença, enquanto a `main` já contém seu módulo atual. | B/G: preservar a experiência corrente; revisar qualquer delta funcional em PR própria. Nenhum snapshot inclusivo foi copiado nesta reconciliação. |
| Timeout da resolução de branding | Correção encontrada no trabalho desta campanha, independente do conteúdo BNCC da #360. | PR #440 separada; mantém requests abortáveis e rejeita no prazo mesmo se a RPC ignorar o sinal. Não mesclada/publicada. |

## Conteúdo V5 e currículo

| Medida do snapshot da PR #360 | Resultado |
|---|---:|
| Pacotes JSON | 225 |
| Questões (instâncias) | 11.187 |
| IDs únicos | 10.016 |
| Enunciados únicos após normalização exata | 10.016 |
| Questões com ID e enunciado exatos já encontrados nos JSON adaptativos da `main` | 226 |
| Grupos de IDs duplicados | 1.097 |
| Instâncias excedentes nesses grupos | 1.171 |
| Grupos de enunciados exatamente repetidos | 1.097 |
| Conflitos de resposta nos grupos de enunciado repetido | 0 |
| Pacotes com `STAGING` | 113 |
| Pacotes com `STAGING_INACTIVE` | 109 |
| Pacotes sem estado explícito | 3 |
| Pacotes com `officialMappingStatus=NOT_CLAIMED` | 222 |
| Pacotes sem estado de mapeamento explícito | 3 |
| Códigos internos `canonicalSkillCode` distintos | 185 |
| Pacotes com campo explícito de série/etapa | 0 |
| Pacotes com campos de resposta em fonte Git pública | 221 |

As distribuições de dificuldade declaradas são: EASY 2.136, MEDIUM 4.999 e HARD 4.052. Há nomes de disciplina representados em 19 valores, com variações como `PORTUGUESE`/`PORTUGUESE_LANGUAGE` e `LANGUAGES`/`LANGUAGES_AND_THEIR_TECHNOLOGIES`; normalizar esses valores exige decisão curricular, não substituição automática. Os pacotes não carregam metadado explícito de série/etapa no nível superior.

226 questões coincidem exatamente por ID e enunciado com o acervo adaptativo da `main`; isso não valida conteúdo semanticamente equivalente sob IDs diferentes. A auditoria não fez deduplicação semântica nem removeu itens. Os 185 códigos internos não são tratados como códigos oficiais BNCC: 222 pacotes declaram explicitamente que o mapeamento oficial não está reivindicado. Nenhuma associação curricular foi inventada.

Os 221 pacotes com respostas tornam os gabaritos visíveis no repositório público histórico. Isso comprova exposição na fonte Git, mas não comprova que os gabaritos tenham sido enviados ao bundle de produção. Não foi feita reescrita do histórico Git.

Os 35 assets de `public/learning` referenciados pelo conjunto V5 estão ausentes da `main`. Não foram importados: são dependências do conteúdo STAGING e precisam seguir a revisão do conteúdo correspondente.

## Migrations históricas

O histórico da PR contém 334 arquivos SQL versionados em `supabase/migrations`; a `main` contém 265. A comparação por versão encontra 221 versões com mesmo caminho e blob idênticos, 112 versões somente na PR e 43 somente na `main`, além de uma colisão de versão com caminhos e SQL diferentes:

```text
20261015000100_bncc_art_exclude_unsubstantiated_poster_question.sql  (PR #360)
20261015000100_enem_provider_pool_random_sort_timeout_fix.sql       (main)
```

Não copiar a migration histórica para `main`, não renumerá-la como se fosse automaticamente segura e não reparar o ledger. O ledger real de produção não foi consultado nesta campanha; portanto `MIGRATIONS_ALREADY_APPLIED=NOT_VERIFIED`. O número de migrations do repositório não prova estado de produção.

A entrada desta campanha citava um ledger histórico de produção com 257 versões e máximo `20261101000100`; esse dado não foi revalidado em uma conexão autorizada e permanece apenas como referência fornecida, não como estado atual comprovado.

## Testes e evidências das PRs sucessoras

- PR #439, branch `codex/bncc-v14-guided-learning-recovery`, HEAD atual `e93fb56ae2ec9a93795c406312ca23c5ef3f690d`: teste focal de renderização/estímulo e migration estático 22/22, typecheck e build local aprovados antes do commit de dependência; após o override KaTeX, os mesmos 22 testes, typecheck e build foram repetidos e passaram. Build local usou valores placeholder do Supabase apenas para compilar; não foi deploy. `npm audit --omit=dev` mostra um alerta alto herdado de `zod` já presente na `main`; a dependência de KaTeX introduzida pelo Markdown foi fixada em 0.19.1. Na consulta final, `validate=PASS`, `migration-promoter-postgres=PASS`, `database=PENDING`; Preview Supabase foi ignorado.
- PR #440, branch `codex/bncc-v14-branding-timeout`, HEAD `957d469b9922b2df647ee42d02268e9ade60077d`: 16/16 testes focados de branding, typecheck, build local com placeholders e `git diff --check` aprovados. Na consulta final, `validate=PASS`, `migration-promoter-postgres=PASS`, `database=PENDING`; Preview Supabase foi ignorado.
- PR #360 segue aberta e não foi mesclada. Seus checks históricos mostram execuções com falha e outra execução posterior aprovada; isso não converte os 767 caminhos em uma unidade segura de integração.
- E2E não foi executado nesta reconciliação; não houve navegador visual autenticado.
- `graphify-out/graph.json` não existe neste checkout. `graphify update .` e a sintaxe documentada `graphify . --update --no-viz` terminaram com exit code 1 sem diagnóstico emitido; a atualização do grafo ficou pendente.

## Situação da PR #360 e destino

```ini
PR360=OPEN
MERGE=NO
PR360_RECONCILIATION_COMPLETE=NO
PR360_MIGRATIONS_APPLIED=NOT_VERIFIED
CONTENT_PUBLICATION=NO
INSTITUTIONS_ENABLED=NO
PRODUCTION_DB_WRITES=NO
PRODUCTION_MIGRATIONS=NO
PRODUCTION_DEPLOY=NO
```

A PR permanece aberta porque há 112 versões históricas de migration sem reconciliação individual de produção e há candidatos de conteúdo sem mapeamento oficial declarado/revisão pedagógica registrada. O inventário documenta todos os 767 caminhos, mas não substitui a análise de comportamento dos caminhos B/G nem uma revisão curricular humana. Fechá-la agora não atenderia aos critérios de encerramento definidos pela própria campanha.

## Próximos passos

1. Revisar e integrar #439 após `database` verde; não promover sua migration sem autorização operacional própria.
2. Revisar #440 de forma separada; não é pré-requisito de conteúdo BNCC.
3. Manter os 225 pacotes e os 35 assets fora da publicação. Uma futura revisão deve identificar versões válidas, comprovar habilidade/currículo e registrar a decisão humana por versão.
4. Reconciliar migrations históricas apenas quando uma capacidade concreta depender delas, com consulta autorizada ao ledger e ao schema; nunca em lote.
5. Fazer avaliação específica de UI/UX e educação inclusiva para cada gap identificado, preservando os módulos atuais.

## Relatório compacto

```ini
CAMPAIGN=TECESCOLA_BNCC_V5_HISTORICAL_RECONCILIATION_V14
INITIAL_MAIN=562fd003e643124981e8345a6a83b11a660c1d16
FINAL_MAIN=562fd003e643124981e8345a6a83b11a660c1d16
SOURCE_PR=360
SOURCE_HEAD=2961073c44d3ae09605b3d481d346c92d7aec46b
FILES_AUDITED=767
HISTORICAL_MIGRATIONS_AUDITED=120 SQL files in PR diff; 334 SQL files in source tree
FUNCTIONALITIES_ALREADY_PRESENT=45 exact blobs; further behavior equivalents preserved conservatively
FUNCTIONALITIES_EQUIVALENT=not inferred from filename alone; 54 same-path divergent files require behavior review
FUNCTIONALITIES_MISSING=visual stimulus rendering and rich lesson Markdown were identified and implemented in PR #439
FUNCTIONALITIES_RECOVERED=2 capabilities prepared in PR #439; 0 merged/deployed
FUNCTIONALITIES_OBSOLETE=0 declared obsolete without evidence
FUNCTIONALITIES_BLOCKED=V5 content pending curriculum/pedagogy; historical DB effects not verified
QUESTIONS_IN_SOURCE=11187 instances
QUESTIONS_UNIQUE=10016 by ID and exact normalized stem
QUESTIONS_ALREADY_IN_MAIN=226 exact ID+stem overlaps
QUESTIONS_RECOVERABLE=9790 exact unique stems not found in current adaptive JSONs; still pending curriculum and human review
QUESTIONS_REJECTED=0 pedagogically rejected; 149 packages failed prior structural validation
QUESTIONS_PENDING_PEDAGOGICAL_REVIEW=all 225 packages
BNCC_SKILLS_VALIDATED=0 official mappings claimed in the source
BNCC_SKILLS_UNMAPPED=185 internal codes; 222 packages explicitly say NOT_CLAIMED
LESSONS_RECOVERED=0 content packages published; 225 retained as candidate STAGING source
DUPLICATE_QUESTIONS=1097 exact duplicate groups; 1171 excess instances; no exact-stem answer conflicts found
DUPLICATE_COMPONENTS=not semantically asserted by path inventory
DUPLICATE_ROUTES=not semantically asserted by path inventory
DUPLICATE_TOOLS=not semantically asserted by path inventory
MIGRATIONS_ALREADY_APPLIED=NOT_VERIFIED
MIGRATIONS_COLLIDING=1 version collision at 20261015000100
MIGRATIONS_OBSOLETE=0 declared obsolete without evidence
NEW_MIGRATIONS_REQUIRED=1 candidate migration in PR #439, not applied
TUTOR_ADAPTIVE_STATUS=current V3/V4/V9/V10 behavior preserved; no historical bulk replacement
GUIDED_HINTS_COMPATIBILITY=preserved; independent evidence/mastery distinction not reverted
INDEPENDENT_MASTERY_PRESERVED=YES in current main; no production exercise performed
UI_UX_IMPROVEMENTS=Markdown renderer and safe optional visual stimuli prepared in PR #439
INCLUSIVE_EDUCATION_STATUS=current main retained; 22 historical paths isolated for targeted review
SUCCESSOR_PRS_CREATED=#439, #440
SUCCESSOR_PRS_CI=validate PASS and migration-promoter-postgres PASS; database pending for both at last check
SUCCESSOR_PRS_READY_FOR_REVIEW=OPEN, non-draft
PR360_FINAL_STATUS=OPEN, not merged
PR360_RECONCILIATION_COMPLETE=NO
UNIT_TESTS=PR439 focused 22/22; PR440 focused 16/16
DATABASE_TESTS=PR CI pending; no production DB tests
TYPECHECK=PASS for both local branches
BUILD=PASS for both local branches with compile-only placeholders
E2E=NOT_RUN
PRODUCTION_DB_WRITES=NO
PRODUCTION_MIGRATIONS=NO
PRODUCTION_DEPLOY=NO
FINAL_RESULT=PARTIAL
REMAINING_BLOCKERS=database CI for #439/#440; migration ledger not verified; content mappings/review pending; path-level B/G behavior review
NEXT_ACTIONS=finish CI; review successor PRs; keep #360 open; handle content/migrations only in targeted future work
```
