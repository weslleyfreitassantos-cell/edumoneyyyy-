# TecEscola V16.1: cobertura do Estudo Guiado

Auditoria estática dos pacotes versionados e leitura de produção sem escrita. Os números do pacote CORE V4 abaixo descrevem arquivos locais, não conteúdo publicado nem elegível para estudantes. O manifesto V4 declara revisão pedagógica pendente e diz explicitamente que o conteúdo não é BNCC oficial.

| Matéria | Conteúdo existente no CORE V4 local | Candidatos marcados para EM1 | Recuperado nesta entrega | Novo | Publicado/confirmado acessível | Pendências |
|---|---:|---:|---:|---:|---|---|
| Arte | 2 aulas, 21 questões | 0 | 0 | 0 | Não | V3 `ART_INTERPRETATION` é `ANCHOR/GRAPH_ONLY`; validação técnica pendente. CORE V4 sem conteúdo EM1. |
| Biologia | 2 aulas, 21 questões | 4 (3 têm questões) | 0 | 0 | Não | Aulas incompletas; revisão pedagógica pendente; nenhum vínculo V16 exato. |
| Química | 2 aulas, 21 questões | 4 | 0 | 0 | Não | Aulas incompletas; revisão pedagógica pendente; nenhum vínculo V16 exato. |
| Inglês | 1 aula, 13 questões | 0 | 0 | 0 | Não | CORE V4 local sem candidato EM1; curso Tec Idiomas é um fluxo separado. |
| Geografia | 1 aula, 13 questões | 0 | 0 | 0 | Não | CORE V4 local sem candidato EM1; não inferir vínculo por área BNCC. |
| História | 5 aulas, 22 questões | 0 | 0 | 0 | Não | CORE V4 local sem candidato EM1; alvo de produção está `GRAPH_ONLY`. |
| Matemática | 6 aulas, 53 questões | 0 | 0 | 0 | Vínculo V16 exato para `EM13MAT101`; acesso funcional do estudante não foi comprovado nesta auditoria | CORE V4 sem candidato EM1; validar ponta a ponta a compatibilidade do início V11 com conteúdo V13 v6. |
| Filosofia | 1 aula, 13 questões | 3 (1 tem questões) | 0 | 0 | Não | Aulas incompletas; revisão pedagógica pendente; nenhum vínculo V16 exato. |
| Educação Física | 2 aulas, 21 questões | 0 | 0 | 0 | Não | CORE V4 local sem candidato EM1; alvo de produção está `GRAPH_ONLY`. |
| Física | 4 aulas, 15 questões | 4 (3 têm questões) | 0 | 0 | Vínculo V16 exato para `EM13CNT101`; acesso funcional do estudante não foi comprovado nesta auditoria | Aulas incompletas; revisão pedagógica pendente; validar compatibilidade ponta a ponta V11/V13 v6. |
| Língua Portuguesa | 6 aulas, 17 questões | 0 | 0 | 0 | Não | CORE V4 local sem candidato EM1; alvo de produção está `GRAPH_ONLY`. |
| Sociologia | 1 aula, 13 questões | 3 (2 têm questões) | 0 | 0 | Não | Aulas incompletas; revisão pedagógica pendente; nenhum vínculo V16 exato. |

## Causa da diferença entre catálogos

- `TECESCOLA_CORE` e `BNCC_2018` são catálogos distintos, com proveniência e contratos de publicação diferentes. Uma habilidade CORE não se torna BNCC por pertencer à mesma matéria ou área.
- A leitura de produção anterior encontrou 148 habilidades CORE, 112 publicadas, 50 marcadas `ADAPTIVE_READY`, 17 áreas, e seis alvos BNCC ativos. Esses estados de catálogo, isoladamente, não garantem vínculo de matéria/série, aula completa, banco adaptativo elegível ou acesso pelo RPC usado pela página.
- A migration V16 contém dois vínculos oficiais exatos para as matérias: Matemática → `EM13MAT101` e Física → `EM13CNT101`. O V13 também contém habilidades amplas de Linguagens e Ciências Humanas, mas não há vínculo V16 para automaticamente replicá-las a Inglês, Português, História, Geografia, Filosofia ou Sociologia.
- O inventário CORE V4 tem ativos reutilizáveis, mas seus 38 planos de aula não cumprem a estrutura completa exigida pelo fluxo adaptativo; nenhum dos candidatos EM1 da auditoria passou o contrato de aula. O pacote ainda está com revisão pedagógica pendente. Os pacotes locais V4 não devem ser copiados ou publicados como se fossem currículo oficial.
- O início legado V11 ainda depende do contrato BNCC V4; a presença de registros V13 v6 ou de uma ligação na migration V16 não basta para declarar uma jornada executável sem teste integrado real.

## Alterações desta entrega

- As páginas de matéria apresentam mensagens em linguagem de estudante para estados conhecidos, sem expor códigos BNCC, versões ou detalhes internos. Erro de consulta continua separado de ausência confirmada de conteúdo.
- O fundo/caixa do ícone de carregamento permanece transparente.
- Foi adicionado `npm run adaptive:v16-1:audit`, que inventaria as 12 matérias, candidatos EM1, estrutura das aulas, cobertura de tipos de questão e vínculos exatos V16. É uma auditoria de conteúdo, não uma promoção.

Nenhum conteúdo foi criado, marcado como concluído, copiado entre catálogos ou publicado nesta entrega. A expansão funcional depende de completar conteúdo específico por matéria, validar o contrato do motor e obter revisão pedagógica; não se deve declarar 12 matérias disponíveis antes disso.
