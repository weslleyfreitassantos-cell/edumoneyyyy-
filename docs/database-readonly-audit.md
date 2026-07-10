# Auditoria read-only do banco

## Objetivo

Preparar uma auditoria segura do banco Supabase remoto antes de qualquer escrita
real, reconciliacao de migrations ou ativacao de convite/cadastro real.

Depois da primeira preparacao documental, a auditoria manual foi executada no
Supabase SQL Editor usando apenas consultas read-only. Nenhum comando Supabase
CLI remoto foi executado por esta entrega.

## Resultado confirmado da auditoria manual

- `supabase_migrations.schema_migrations` esta ausente/null no remoto.
- `auth.schema_migrations`, `storage.migrations` e
  `realtime.schema_migrations` existem.
- O remoto tem o nucleo academico principal em `public`.
- `assessments`, `grades`, `attendance_sessions` e `attendance_records` nao
  existem no remoto.
- O enum remoto `public.user_role` contem somente `ADMIN`, `DIRECTOR`,
  `TEACHER`, `STUDENT` e `GUARDIAN`.
- RLS esta habilitado nas tabelas publicas auditadas, com `force_rls = false`.
- Funcoes e varias policies ainda precisam de hardening para exigir
  `membership.active is true`.
- As funcoes de RA estao protegidas para `service_role`; usuarios comuns nao
  executam `generate_student_registration_number` diretamente.

O diagnostico completo esta em
[`database-final-diagnosis.md`](database-final-diagnosis.md).

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

## Lacunas e riscos confirmados

- Historico remoto de migrations Supabase CLI nao esta registrado na tabela
  esperada.
- Policies RLS existem, mas parte delas nao filtra `membership.active is true`.
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
- No modelo remoto atual, `students.profile_id` e obrigatorio e
  `profiles.id -> auth.users.id`. Aluno sem login exige migration futura.

## Estado observado de RLS

- RLS esta habilitado nas tabelas com dados institucionais auditadas.
- Varias policies limitam acesso por instituicao, mas nem todas exigem
  `memberships.active is true`.
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

- `supabase_migrations.schema_migrations` esta ausente/null.
- Historico remoto de migrations ainda precisa ser reconciliado.
- `assessments`, `grades`, `attendance_sessions` e `attendance_records` estao
  ausentes no remoto.
- Roles futuras nao existem como roles ativas.
- Fluxo unificado de convite ainda e visual.
- Edge Functions futuras ainda nao existem.
- `APP_URL`, secrets, redirects e SMTP precisam ser confirmados antes de envio
  real.
- RLS e policies precisam de hardening para membership ativa.

## Checklist para auditoria manual no SQL Editor

- [x] Executar `docs/supabase-readonly-audit.sql` manualmente.
- [x] Confirmar schemas existentes.
- [x] Confirmar tabelas, colunas, enums, indexes e FKs principais.
- [x] Confirmar RLS e policies por tabela.
- [x] Confirmar historico de migrations, se existir.
- [x] Confirmar contagens aproximadas de tabelas criticas.
- [x] Verificar orfaos nas relacoes principais auditadas.
- [ ] Exportar e versionar apenas o resumo seguro, sem dados sensiveis.

## Proximos passos seguros

1. Executar auditoria read-only manual.
2. Comparar schema remoto contra migrations locais.
3. Definir plano de reconciliacao.
4. Testar qualquer escrita em staging.
5. Somente depois planejar migrations reais e Edge Functions novas.

## Consolidação pós-auditoria manual

A auditoria manual confirmou que `supabase_migrations.schema_migrations` está ausente no remoto. Também confirmou que `assessments`, `grades`, `attendance_sessions` e `attendance_records` não existem no banco remoto.

O enum remoto `public.user_role` contém somente `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT` e `GUARDIAN`.

As funções de RA estão restritas para `service_role`, e usuários `anon`/`authenticated` não conseguem executá-las diretamente. O ponto de hardening pendente é padronizar funções e policies para considerar `membership.active is true`.
