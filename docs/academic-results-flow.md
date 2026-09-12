# Fluxo acadêmico de resultados

Este documento descreve o fluxo implementado para uma oferta de disciplina em
um período letivo. As regras de acesso são avaliadas no banco com a
`membership` ativa, a instituição operacional e o perfil ativo do usuário.

## Estados

Avaliações usam `DRAFT`, `PUBLISHED`, `CLOSED` e `CANCELED`. Notas usam
`PENDING`, `GRADED` e `EXCUSED`.

- somente avaliações `PUBLISHED` e `CLOSED` entram no boletim;
- uma nota `GRADED` exige pontuação dentro de `0..max_score`;
- uma nota `EXCUSED` não contribui para a média e não reduz a nota;
- avaliações `CANCELED` são excluídas;
- notas são lançadas enquanto a avaliação está publicada.

## Fechamento

O fechamento é feito por `subject_offering_id` e `term_id`:

```text
avaliações publicadas
→ notas preenchidas ou abonadas
→ chamadas fechadas no período
→ submit_term_closure
→ close_term_closure
→ student_term_results
```

`submit_term_closure` valida política, matrícula, avaliações e pendências. O
fechamento também exige dados de frequência. A média ponderada usa somente
notas `GRADED`; presença considera `PRESENT` e `LATE`. O arredondamento segue
`academic_policies.decimal_places`.

`student_term_results` é único por estudante, oferta e período. Seus campos
`grade_percentage`, `attendance_percentage`, `result_status` e
`finalized_at` formam o snapshot oficial do boletim fechado. Repetir o
fechamento é idempotente. Alterações diretas em resultado, avaliação ou nota
são bloqueadas enquanto o período estiver fechado.

## Reabertura

Somente `DIRECTOR`, `SECRETARY` e `SUPER_ADMIN`, conforme a autorização efetiva
da instituição, podem reabrir um fechamento. O motivo não pode ser vazio. Após
a reabertura, uma nova nota pode ser lançada e um novo fechamento atualiza o
mesmo resultado lógico, sem criar duplicidade.

## Boletim

O boletim aberto consulta avaliações publicadas diretamente, inclusive quando
o aluno ainda não possui uma linha em `grades`. A elegibilidade considera a
turma da oferta, o ano letivo, a matrícula ativa e a data da avaliação. O ano e
o período vêm das relações acadêmicas reais.

Quando existe snapshot em `student_term_results`, o boletim usa os valores
oficiais do fechamento em vez de recalcular silenciosamente a partir das notas
atuais.

## Acesso

| Papel | Acesso |
| --- | --- |
| `ADMIN` | propriedade da conta; não executa operações acadêmicas da escola |
| `DIRECTOR` | gestão acadêmica e fechamento da própria instituição |
| `SECRETARY` | operação acadêmica autorizada da própria instituição |
| `TEACHER` | próprias ofertas, lançamento de notas e envio para revisão |
| `STUDENT` | próprias avaliações, notas e boletim |
| `GUARDIAN` | avaliações e boletins de alunos vinculados |
| `SUPER_ADMIN` | administração da plataforma, quando habilitado |

Nenhum papel pode consultar dados de outra instituição. O teste local
`supabase/tests/academicResultsFlow.local.test.ts` valida leituras por papel,
cross-tenant, avaliação sem nota, fechamento, reabertura, idempotência,
imutabilidade e revogação de perfil mantendo o JWT original.

## Migrations relacionadas

- `20260710000200_attendance_and_grades.sql`
- `20260712000300_term_closing_report_cards.sql`
- `20260911000600_academic_results_hardening.sql`

A última migration é forward-only e não reescreve migrations históricas.
