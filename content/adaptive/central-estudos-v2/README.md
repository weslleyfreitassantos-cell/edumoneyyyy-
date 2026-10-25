# Central de Estudos V2 — conteúdo candidato

Este pacote guarda conteúdo curricular versionado para revisão. Nenhum item deste diretório é publicado para estudantes por padrão.

## Estados

- `STAGING` / `PEDAGOGICAL_REVIEW_PENDING`: candidato não visível na jornada do aluno.
- `PEDAGOGICAL_REVIEWED`: só pode ser registrado após revisão humana documentada, com identidade, data, notas e critérios.
- `PUBLISHED`: só depois da integração ao runtime e da publicação controlada. A validação automatizada não pode definir este estado.

O arquivo `review-docket.json` registra a versão, o SHA-256, a validação técnica e os campos de revisão/publicação. Campos vazios significam que não houve aprovação.

## Candidato atual

`CEV2_EF06MA13_PERCENTUAL_01` é uma jornada para Matemática do 6º ano, vinculada como candidata à habilidade EF06MA13. A fonte local do catálogo registra a extração como pendente de revisão; por isso, a correspondência oficial também exige confirmação humana. A jornada tem uma aula com sete partes pedagógicas e dez questões de múltipla escolha compatíveis com o modo de resposta atual.

Comandos locais:

- `npm run adaptive:v2:validate`: valida estrutura, escopo da habilidade, respostas, explicações e estado não publicado.
- `node tools/adaptive/validate-central-estudos-v2.mjs --write`: atualiza o dossiê de hash e revisão pendente.
- `npm run adaptive:v4:audit`: gera a auditoria técnica por disciplina do pacote V4 legado.

Os relatórios automáticos detectam problemas estruturais e lacunas de cobertura; não avaliam adequação pedagógica nem substituem o parecer de professor.
