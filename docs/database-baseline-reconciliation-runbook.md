# Runbook de reconciliacao do baseline remoto

Este runbook orienta a reconciliacao entre o schema real do Supabase remoto e
as migrations locais versionadas. Ele e apenas documental: nao executa SQL, nao
executa Supabase CLI e nao altera migrations reais.

## 1. Objetivo

O banco remoto tem schema real em uso, mas a auditoria manual confirmou que
`supabase_migrations.schema_migrations` esta ausente/null. Isso significa que
nao ha historico Supabase CLI registrado na tabela esperada, embora objetos do
dominio escolar ja existam no remoto.

O objetivo deste runbook e guiar a decisao de baseline sem reaplicar DDL ja
existente, sem apagar dados e sem marcar migrations como aplicadas antes de
comparar o estado real do banco.

## 2. Principios

- Preservar dados existentes.
- Nao reaplicar DDL ja existente.
- Nao usar reset contra remoto.
- Nao marcar migrations como aplicadas sem comparacao objeto a objeto.
- Usar staging antes de producao.
- Fazer backup/export antes de qualquer escrita futura.
- Tratar o remoto como fonte de verdade operacional ate a reconciliacao.
- Tratar migrations locais como fonte de verdade versionada, mas nao como prova
  de que o historico remoto ja existe.

## 3. Estado confirmado

- `supabase_migrations.schema_migrations` esta ausente/null no remoto.
- `auth.schema_migrations`, `storage.migrations` e
  `realtime.schema_migrations` existem.
- O remoto possui o nucleo escolar principal:
  `academic_years`, `classes`, `enrollments`, `guardianships`,
  `institutions`, `memberships`, `profiles`,
  `student_registration_counters`, `students`, `subject_offerings`,
  `subjects` e `terms`.
- `assessments`, `grades`, `attendance_sessions` e `attendance_records` nao
  existem no remoto.
- Roles remotas reais: `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT` e
  `GUARDIAN`.
- RLS esta ativo nas tabelas publicas auditadas, com `force_rls = false`.
- Varias policies ainda nao filtram `membership.active is true`.
- `subject_offerings` ja filtra membership ativa.
- Funcoes confirmadas: `can_view_institution_profile`,
  `generate_student_registration_number`, `is_institution_admin` e
  `set_student_registration_number`.
- `can_view_institution_profile` e `is_institution_admin` consideram `ADMIN`
  e `DIRECTOR`, mas ainda nao filtram `membership.active is true`.
- Trigger confirmada: `students_generate_registration_number`.
- Nao foram encontrados orfaos principais nas relacoes auditadas.
- `students.profile_id` e obrigatorio e depende de `profiles.id`, que depende
  de `auth.users.id`.
- Aluno sem login nao e suportado pelo modelo remoto atual.

## 4. Fases

### Fase A - inventario local

1. Listar migrations locais versionadas.
2. Ler cada migration sem alterar arquivos.
3. Classificar objetos criados por migration: tabelas, funcoes, triggers,
   enums, policies, constraints, indexes, grants e RLS.
4. Registrar dependencias entre migrations.

### Fase B - inventario remoto read-only

1. Usar apenas consultas read-only revisadas.
2. Registrar tabelas, colunas, enums, FKs, constraints, indexes, triggers,
   functions, privileges, RLS e policies.
3. Nao registrar dados sensiveis.
4. Versionar apenas resumo seguro.

### Fase C - matriz de equivalencia

1. Comparar cada objeto local com a evidencia remota.
2. Classificar como `CONFIRMADO_PRESENTE`, `CONFIRMADO_AUSENTE`, `PARCIAL` ou
   `DESCONHECIDO`.
3. Separar presenca do objeto de igualdade de definicao.
4. Marcar como risco alto qualquer DDL que possa recriar objeto existente.

### Fase D - definicao do baseline

1. Definir se o baseline sera apenas documental, tecnico controlado ou uma
   combinacao.
2. Separar objetos que ja existem, objetos ausentes e objetos divergentes.
3. Nao registrar historico de migration sem equivalencia comprovada.

### Fase E - staging

1. Usar projeto Supabase separado.
2. Reproduzir o estado esperado sem dados sensiveis.
3. Validar baseline e migrations incrementais.
4. Testar usuarios ativos, inativos, sem membership e de outra instituicao.

### Fase F - migration incremental

1. Criar migrations futuras apenas a partir do estado remoto reconciliado.
2. Aplicar primeiro em staging.
3. Validar o candidato documental de RLS antes de mover para migration real.
4. Manter rollback conceitual e backup disponiveis.

### Fase G - validacao

1. Reexecutar auditorias read-only.
2. Validar RLS, policies, functions, triggers, constraints e indexes.
3. Rodar testes do app.
4. Validar fluxos por role e isolamento entre instituicoes.

### Fase H - producao

1. Confirmar backup/export.
2. Confirmar aprovacao de staging.
3. Aplicar somente migrations aprovadas.
4. Monitorar login, dashboards, policies e erros.

## 5. Estrategias possiveis

### Baseline documental

Registrar o estado remoto confirmado em docs, mantendo as migrations locais
intocadas. E a estrategia mais segura enquanto ainda faltam comparacoes
detalhadas de constraints, indexes, functions e policies.

### Baseline tecnico controlado

Criar um baseline tecnico futuro apenas depois de comparar objeto a objeto e
validar em staging. Exige backup, aprovacao explicita e plano de rollback.

### Migrations incrementais a partir do estado remoto

Depois da reconciliacao, criar migrations pequenas para lacunas confirmadas:
hardening de RLS, notas/frequencia, convites, roles futuras ou aluno sem login.

### Repair somente apos equivalencia comprovada

Qualquer reparo de historico so deve ocorrer quando houver prova de que a
definicao local corresponde ao estado remoto. Sem essa prova, o risco e
registrar uma historia falsa.

## 6. Criterios para escolher estrategia

- Existencia dos objetos no remoto.
- Igualdade de colunas, tipos, defaults e nullability.
- Igualdade de constraints e FKs.
- Igualdade de functions, `SECURITY DEFINER`, `search_path` e privileges.
- Igualdade de policies, roles, comandos, `using` e `with check`.
- Presenca de dados e risco de perda.
- Dependencias entre migrations.
- Capacidade de reproduzir o resultado em staging.
- Existencia de rollback operacional.

## 7. Plano de backup

Antes de qualquer escrita futura, documentar e confirmar:

- Export de schema.
- Export de dados criticos.
- Snapshot do projeto.
- Registro de policies e functions.
- Lista segura de usuarios e memberships.
- Registro de roles e memberships ativas/inativas.
- Plano de rollback validado.

Nenhum backup deve ser executado por esta tarefa documental.

## 8. Staging

Usar um projeto Supabase separado para:

- Reproduzir o schema confirmado.
- Aplicar um baseline controlado, se aprovado.
- Aplicar migrations incrementais candidatas.
- Aplicar o candidato de RLS somente depois de revisao.
- Testar usuarios ativos e inativos.
- Validar frontend com variaveis e secrets separados.
- Validar Edge Functions em ambiente separado.
- Confirmar isolamento entre instituicoes.

Nenhum projeto staging deve ser criado por esta tarefa documental.

## 9. Criterios de aprovacao

- Nenhuma perda de dados.
- Nenhuma policy removida sem substituicao.
- Login funcionando.
- Dashboards funcionando.
- Memberships ativas com acesso esperado.
- Memberships inativas sem acesso institucional.
- Admins ativos visualizando usuarios inativos para gestao.
- Usuario sem membership ativa sem acesso institucional.
- Usuario de outra instituicao sem acesso cruzado.
- Testes do app passando.

## 10. Bloqueios atuais

- Ausencia de historico de migrations em `supabase_migrations`.
- Notas/frequencia ausentes no remoto.
- Convite real ainda bloqueado.
- Roles planejadas nao disponiveis no banco.
- Aluno sem login nao suportado.
- Hardening de RLS ainda apenas como candidato documental.
- Staging ainda precisa ser preparado e aprovado.

## 11. Inventario das migrations locais

| Migration local | Versao/timestamp | Objetos criados | Tabelas | Funcoes | Triggers | Enums | Policies | Constraints | Indexes | Presenca confirmada no remoto | Ausencia confirmada no remoto | Estado desconhecido | Risco de reaplicacao | Recomendacao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `20260709000100_baseline_schema.sql` | `20260709000100` | Extensao `uuid-ossp`, enum `user_role`, nucleo escolar e indexes basicos | `institutions`, `profiles`, `memberships`, `academic_years`, `terms`, `students`, `guardianships`, `classes`, `subjects`, `subject_offerings`, `enrollments`, `student_registration_counters` | Nenhuma nessa migration | Nenhum nessa migration | `public.user_role` | Nenhuma nessa migration | PKs, FKs, uniques e `not null` do nucleo | `memberships_*`, `students_*`, `academic_years_institution_id_idx`, `classes_institution_id_idx`, `enrollments_*` | Tabelas do nucleo, enum real, FKs e uniques principais | Nenhuma ausencia confirmada para tabelas do nucleo | Igualdade completa de indexes, defaults e nomes de constraints precisa de comparacao | Alto: recriaria objetos principais ja existentes | Nao reaplicar diretamente; usar como referencia para baseline/equivalencia |
| `20260710000200_attendance_and_grades.sql` | `20260710000200` | Modulo de avaliacoes, notas e frequencia, RLS inicial, grants e trigger de `updated_at` | `assessments`, `grades`, `attendance_sessions`, `attendance_records` | `public.touch_academic_record_updated_at()` | `assessments_touch_updated_at`, `grades_touch_updated_at`, `attendance_sessions_touch_updated_at`, `attendance_records_touch_updated_at` | Nenhum | Nenhuma policy funcional; habilita RLS e ajusta grants | Checks, uniques e FKs do modulo pedagogico | Indexes de consulta para avaliacoes, notas e frequencia | Nenhuma tabela desse modulo confirmada presente | As quatro tabelas do modulo estao confirmadas ausentes | Funcao e triggers nao foram inventariados no remoto por nome | Medio/alto: cria modulo ausente, mas depende de baseline reconciliado | Aplicar apenas como migration futura revisada em staging |
| `20260710000300_attendance_and_grades_rls.sql` | `20260710000300` | Schema `private`, helpers RLS, grants e policies de notas/frequencia | Usa `assessments`, `grades`, `attendance_sessions`, `attendance_records` | Helpers `private.*` para roles, oferta, aluno, assessment e attendance | Nenhum | Usa `public.user_role` | Policies CRUD para `assessments`, `grades`, `attendance_sessions`, `attendance_records` | Nenhuma constraint estrutural | Nenhum index | Nenhuma policy desse modulo confirmada presente | Policies alvo dependem de tabelas confirmadas ausentes | Schema `private` e helpers `private.*` nao estao confirmados | Alto: depende da migration anterior e de equivalencia do nucleo | Nao aplicar sem tabelas do modulo e staging validado |
| `20260710000400_attendance_and_grades_integrity.sql` | `20260710000400` | Funcoes e triggers de integridade entre avaliacoes, notas, frequencia e matriculas | Usa tabelas do modulo pedagogico e do nucleo | `private.validate_assessment_integrity()`, `private.validate_grade_integrity()`, `private.validate_attendance_session_integrity()`, `private.validate_attendance_record_integrity()` | `assessments_validate_integrity`, `grades_validate_integrity`, `attendance_sessions_validate_integrity`, `attendance_records_validate_integrity` | Nenhum | Nenhuma | Regras via triggers de integridade | Nenhum | Nenhum objeto dessa migration confirmado presente | Triggers alvo dependem de tabelas confirmadas ausentes | Funcoes `private.validate_*` nao estao confirmadas | Alto: depende das duas migrations anteriores | Aplicar somente depois do modulo existir e ser validado em staging |

## 12. Estrategia recomendada

A estrategia recomendada e baseline documental agora, seguido de matriz de
equivalencia completa, staging separado e migrations incrementais pequenas a
partir do estado remoto reconciliado.

Nao usar reset. Nao reaplicar baseline local diretamente. Nao fazer repair sem
equivalencia comprovada. O candidato de hardening de RLS deve permanecer em
`docs/migration-candidates` ate ser aprovado em staging e transformado em
uma migration real.
