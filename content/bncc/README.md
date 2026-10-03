# BNCC no TecEscola

O catálogo em `official/` é a camada de proveniência oficial. Ele não é o
grafo pedagógico do TecEscola e não deve ser alterado por professores.

- `official/catalog-2018.json`: códigos detectados nos PDFs oficiais congelados,
  com etapa, componente, página e trecho de contexto da fonte.
- `official/manifest.json`: versão, URLs, hashes e estado de disponibilidade das
  fontes usadas.
- `schema/official-catalog.schema.json`: contrato estrutural do catálogo.
- `mappings/coverage-2018.json`: uma linha por código oficial, distinguindo
  `MAPPED`, `EXPLICITLY_NON_ADAPTIVE` e `UNACCOUNTED`; lacunas não são ocultadas.
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
