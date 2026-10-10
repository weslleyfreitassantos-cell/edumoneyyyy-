# Pacote de revisão pedagógica: Ensino Médio, primeiro ano

**Campanha:** `TECESCOLA_BNCC_HIGH_SCHOOL_SAFE_PROMOTION_AND_E2E_V5`

**Status:** `PEDAGOGICAL_REVIEW_PENDING`

Este documento prepara a revisão humana dos quatro percursos introduzidos pela
migration V4. Ele não constitui aprovação pedagógica e não altera nenhum
status de conteúdo.

## Escopo

Os percursos são conteúdos autorais do TecEscola vinculados a descritores
oficiais da BNCC do Ensino Médio. A indicação de primeiro ano é uma sequência
pedagógica interna; não é uma distribuição oficial da BNCC por série.

Fonte oficial consultada: [BNCC Ensino Médio](https://basenacionalcomum.mec.gov.br/images/historico/BNCC_EnsinoMedio_embaixa_site_110518.pdf).

| Percurso | Código | Área | Página de origem | Estado técnico | Estado pedagógico |
| --- | --- | --- | ---: | --- | --- |
| Interpretar variações por gráficos e taxas | `EM13MAT101` | Matemática | 101 | `TECH_VALIDATED` | `PEDAGOGICAL_REVIEW_PENDING` |
| Debater com argumentos e responsabilidade | `EM13LGG303` | Linguagens | 61 | `TECH_VALIDATED` | `PEDAGOGICAL_REVIEW_PENDING` |
| Analisar transformações e conservações | `EM13CNT101` | Ciências da Natureza | 117 | `TECH_VALIDATED` | `PEDAGOGICAL_REVIEW_PENDING` |
| Construir hipóteses com evidências | `EM13CHS103` | Ciências Humanas | 136 | `TECH_VALIDATED` | `PEDAGOGICAL_REVIEW_PENDING` |

## Conteúdo a revisar por percurso

Cada percurso contém, na fonte versionada da migration V4:

- uma descrição do código BNCC;
- uma lição com resumo, conteúdo em Markdown, exemplo resolvido e dicas;
- cinco etapas de exercício: `PROBE`, `PRACTICE`, `TRANSFER`, `LOCK_IN` e `REVIEW`;
- uma questão por etapa, com alternativas e resposta esperada para correção server-side;
- metadados de fonte, código oficial, página e sequência recomendada do TecEscola.

Fonte de implementação: `supabase/migrations/20261010000400_bncc_high_school_first_year_real_learning_v4.sql`.

## Evidências técnicas disponíveis

- Os quatro códigos são inseridos com `PEDAGOGICAL_REVIEW_PENDING`.
- A migration de proteção V5 mantém esses códigos fora da descoberta pública e
  bloqueia o início por RPC enquanto não houver publicação autorizada.
- O catálogo BNCC e os pacotes adaptativos passam pelos validadores do projeto.
- O percurso não deve ser liberado somente porque possui lição e exercícios.
- A compatibilidade dos percursos legados `EF06HI01` e `EF09CI01` deve ser
  validada separadamente.

## Checklist do revisor

Para cada código, registrar individualmente:

- [ ] A descrição corresponde ao documento oficial e ao código indicado.
- [ ] O objetivo da lição é pedagogicamente adequado ao Ensino Médio.
- [ ] O exemplo resolvido é correto, suficiente e compreensível.
- [ ] As questões medem a habilidade descrita, sem exigir conteúdo não ensinado.
- [ ] As alternativas são completas, mutuamente distinguíveis e sem pistas.
- [ ] A resposta e o feedback justificam a correção sem revelar o gabarito antes do envio.
- [ ] A sequência `PROBE` -> `PRACTICE` -> `TRANSFER` -> `LOCK_IN` -> `REVIEW` é coerente.
- [ ] As limitações e a recomendação de série estão claramente apresentadas como internas.

## Registro de decisão

Não preencher `APPROVED_BY`, `APPROVED_AT` ou `REVIEW_EVIDENCE` sem uma
decisão humana identificável. A publicação individual pode ser registrada por
percurso após a revisão, preservando a revisão pendente dos demais.

## Pontos de atenção técnicos

O compilador local do pacote adaptive V4 atualmente informa um hash diferente
do comentário de hash existente na migration V4. Isso não foi alterado nesta
campanha. Antes de qualquer promoção, a equipe deve reconciliar a fonte de
conteúdo e regenerar a migration apenas em uma campanha própria, caso seja
necessário; não tratar a diferença como aprovação ou como motivo para liberar
conteúdo sem revisão.
