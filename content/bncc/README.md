# BNCC no TecEscola

O catálogo em `official/` é a camada de proveniência oficial. Ele não é o
grafo pedagógico do TecEscola e não deve ser alterado por professores.

- `official/catalog-2018.json`: códigos detectados nos PDFs oficiais congelados,
  com etapa, componente, página e trecho de contexto da fonte.
- `official/manifest.json`: versão, URLs, hashes e estado de disponibilidade das
  fontes usadas.
- `schema/official-catalog.schema.json`: contrato estrutural do catálogo.
- `mappings/coverage-2018.json`: uma linha por código oficial, distinguindo
  `MAPPED`, `HIERARCHY_ONLY`, `EXPLICITLY_NON_ADAPTIVE` e
  `SOURCE_REVIEW_REQUIRED`; `UNACCOUNTED` deve permanecer em zero.
- `mappings/promoted-2018.json`: allowlist pequena de promoções técnicas
  conservadoras; ela nunca afirma revisão pedagógica humana.
- `mappings/reviews-2018.json`: revisão técnica independente, sem promoção
  pedagógica automática.
- `canonical/graph-v4.json`: auditoria do grafo V4, separando âncoras, folhas
  targetáveis, seeds legadas e nós semânticos ainda não resolvidos.
- `schema/mapping-coverage.schema.json`: contrato da matriz de mapeamento.

O catálogo não exige que um professor faça atribuições manuais. A migration de
disponibilidade automática expõe os pacotes globais versionados da TecEscola ao
aluno elegível por instituição, matrícula, etapa e ano. A atribuição explícita
continua legível para compatibilidade e personalização, mas não é criada para
habilitar o conteúdo padrão.

O complemento oficial de Computação está congelado a partir do anexo oficial
publicado pelo MEC. Um espelho de terceiro não pode ser promovido a source of
truth.

Os arquivos baixados e os textos extraídos ficam em `.runtime/bncc/`, que é
ignorado pelo Git. O catálogo versionado contém proveniência suficiente para
reproduzir e auditar a extração sem commitar PDFs grandes.

Os arquivos de skills por disciplina em `content/adaptive/tec-escola-core-v4`
são a fonte de conteúdo autorado. `bncc:sync-v4-registries` reconcilia o
registro agregado e o registro canônico sem promover automaticamente qualquer
conteúdo a alinhamento BNCC.
