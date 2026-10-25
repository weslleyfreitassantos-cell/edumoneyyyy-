# Central de Estudos V2 — pacote candidato do 6º ano

Este pacote reúne nove aulas candidatas de Matemática, Língua Portuguesa e Ciências. Cada aula tem entre cinco e oito questões, explicações e revisão. O pacote permanece em `STAGING`; a correspondência BNCC também depende de confirmação humana porque a extração local do catálogo requer revisão.

## Fluxo de revisão

`curriculum-matrix.json` organiza disciplina, habilidade e unidade. `review-docket.json` contém uma entrada por versão, com SHA-256, resultado técnico e campos para registrar revisão humana e eventual publicação. Alterar o conteúdo muda o fingerprint e invalida qualquer decisão anterior para aquela versão. Validação automática nunca aprova nem publica conteúdo.

O Super Admin acessa a fila em `/teacher/pedagogical-center/central-studies-review`. A aprovação registra revisor, data, checklist, observações e fingerprint no servidor como **aprovada para integração**. A migração mantém a versão em `STAGING`; publicar ao aluno exige integração explícita ao runtime V4/V9, que não é feita por essa decisão de revisão.

Conteúdo candidato não é servido ao estudante. A publicação exige revisão humana e integração compatível ao runtime já usado pela Central de Estudos; este pacote, por si só, não libera jornadas nem muda dados do banco.

## Pacote atual

- Matemática: operações com números naturais (EF06MA03), frações (EF06MA07) e porcentagens (EF06MA13).
- Língua Portuguesa: gêneros jornalísticos (EF06LP02), sentidos em séries sinonímicas (EF06LP03) e efeitos dos modos verbais (EF06LP05).
- Ciências: classificação de misturas (EF06CI01), evidências de transformações químicas (EF06CI02) e separação de materiais (EF06CI03).

Comandos locais:

- `npm run adaptive:v2:validate` valida todas as aulas, questões, habilidades oficiais, matriz e fingerprints.
- `node tools/adaptive/validate-central-estudos-v2.mjs --write` atualiza a pauta de revisão preservando decisões humanas somente quando o fingerprint da versão não mudou.
- `node tools/adaptive/build-central-estudos-v2-package.mjs` regenera as oito aulas novas e os metadados derivados do pacote.

As questões usam `SINGLE_CHOICE`, o único tipo aceito pelo fluxo atual da jornada V9/V4. A diversidade está nos objetivos cognitivos, contextos e níveis de aplicação. O avanço para outros formatos de interação depende de suporte correspondente no motor existente.
