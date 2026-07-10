# Auditoria read-only do banco

## Objetivo

Preparar uma auditoria segura do banco Supabase remoto antes de qualquer escrita
real, reconciliacao de migrations ou ativacao de convite/cadastro real.

Esta entrega nao verificou o banco remoto em tempo real e nao executou SQL
remoto. Os pontos abaixo devem ser tratados como inventario local, estado
conhecido anteriormente ou itens a confirmar manualmente no Supabase SQL Editor.

## Estado conhecido do banco remoto

- A existencia de `supabase_migrations.schema_migrations` no remoto ainda nao
  foi confirmada nesta execucao.
- O remoto pode ter objetos criados antes da baseline local.
- O historico Supabase CLI do remoto pode nao estar reconciliado.
- Qualquer informacao sobre RLS, policies, roles e dados reais precisa ser
  confirmada por auditoria read-only.

## Estado conhecido das migrations locais

Migrations locais versionadas:

- `20260709000100_baseline_schema.sql`
- `20260710000200_attendance_and_grades.sql`
- `20260710000300_attendance_and_grades_rls.sql`
- `20260710000400_attendance_and_grades_integrity.sql`

A baseline local define o dominio escolar principal: `institutions`,
`profiles`, `memberships`, `academic_years`, `terms`, `students`,
`guardianships`, `classes`, `subjects`, `subject_offerings`, `enrollments` e
`student_registration_counters`.

As migrations posteriores adicionam avaliacoes, notas, frequencia, RLS e
integridade para esses modulos pedagogicos.

## Riscos atuais

- Rodar `db push` sem reconciliar historico pode tentar reaplicar objetos ja
  existentes.
- Rodar `migration repair` sem inventario pode registrar estado incorreto.
- Rodar `db reset` contra ambiente remoto/produtivo pode destruir dados.
- Ativar cadastro real sem confirmar RLS, policies e constraints pode permitir
  escrita fora da instituicao correta.
- Ativar `SECRETARY` ou `SCHOOL_ADMIN` antes do banco suportar os papeis cria
  permissao falsa no frontend.

## Tabelas esperadas do dominio escolar

- `public.institutions`
- `public.profiles`
- `public.memberships`
- `public.academic_years`
- `public.terms`
- `public.students`
- `public.guardianships`
- `public.classes`
- `public.subjects`
- `public.subject_offerings`
- `public.enrollments`
- `public.student_registration_counters`
- `public.assessments`
- `public.grades`
- `public.attendance_sessions`
- `public.attendance_records`

## Lacunas provaveis a confirmar

- Historico remoto de migrations Supabase CLI.
- Policies RLS para todas as tabelas antigas da baseline.
- Se `profiles.role` e `memberships.role` usam o mesmo enum no remoto.
- Se existem duplicidades em `memberships`, `enrollments`, `guardianships` ou
  `subject_offerings`.
- Se existem constraints para impedir escrita entre instituicoes diferentes.
- Se storage e auth possuem objetos relevantes para convites.

## Relacao entre profiles, institutions e memberships

`profiles` representa identidade academica global do usuario. `institutions`
representa a escola/unidade. `memberships` vincula perfil e escola, guardando o
papel escolar e status do vinculo.

No frontend atual, `currentRole` vindo de `memberships.role` tem prioridade em
telas contextuais. `profiles.role` segue como fallback temporario.

## Relacao futura para students, guardianships e enrollments

- `students` deve representar o registro academico do aluno dentro da
  instituicao.
- `enrollments` deve vincular aluno, turma e ano letivo.
- `guardianships` deve vincular responsaveis a alunos.
- Alunos podem futuramente existir sem login, desde que o banco e as funcoes
  suportem esse modo com seguranca.

## Estado esperado de RLS

A confirmar no remoto:

- RLS habilitado em tabelas com dados institucionais.
- Policies que limitem acesso por `memberships` ativos.
- Escritas administrativas restritas a `ADMIN` e `DIRECTOR` atuais, ate que
  novos papeis sejam implementados no banco.
- Policies especificas para alunos, professores e responsaveis.

## Policies que precisam ser verificadas

- `institutions`
- `profiles`
- `memberships`
- `students`
- `guardianships`
- `academic_years`
- `terms`
- `classes`
- `subjects`
- `subject_offerings`
- `enrollments`
- `assessments`
- `grades`
- `attendance_sessions`
- `attendance_records`

## O que impede ativar cadastro real agora

- Historico remoto de migrations ainda precisa ser reconciliado.
- Roles futuras nao existem como roles ativas.
- Fluxo unificado de convite ainda e visual.
- Edge Functions futuras ainda nao existem.
- `APP_URL`, secrets, redirects e SMTP precisam ser confirmados antes de envio
  real.
- RLS e policies precisam ser auditadas em ambiente remoto.

## Checklist para auditoria manual no SQL Editor

- [ ] Executar `docs/supabase-readonly-audit.sql` manualmente.
- [ ] Confirmar schemas existentes.
- [ ] Confirmar tabelas, colunas, enums, indexes e FKs.
- [ ] Confirmar RLS e policies por tabela.
- [ ] Confirmar historico de migrations, se existir.
- [ ] Confirmar contagens aproximadas de tabelas criticas.
- [ ] Verificar duplicidades institucionais.
- [ ] Exportar resultados para arquivo externo ao repositorio.

## Proximos passos seguros

1. Executar auditoria read-only manual.
2. Comparar schema remoto contra migrations locais.
3. Definir plano de reconciliacao.
4. Testar qualquer escrita em staging.
5. Somente depois planejar migrations reais e Edge Functions novas.
