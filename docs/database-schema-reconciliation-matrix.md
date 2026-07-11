# Matriz de reconciliacao do schema

Esta matriz cruza objetos das migrations locais com fatos confirmados da
auditoria remota. Ela nao executa SQL e nao altera migrations.

Estados usados:

- `CONFIRMADO_PRESENTE`: ha evidencia documental de que o objeto existe no
  remoto.
- `CONFIRMADO_AUSENTE`: ha evidencia documental de que o objeto nao existe no
  remoto.
- `PARCIAL`: ha evidencia de existencia geral, mas a definicao completa ainda
  precisa de comparacao.
- `DESCONHECIDO`: nao ha evidencia documental suficiente.

| Migration local | Objeto | Tipo | Estado remoto | Evidencia | Risco | Acao recomendada |
| --- | --- | --- | --- | --- | --- | --- |
| `20260709000100_baseline_schema.sql` | `public.user_role` com `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT`, `GUARDIAN` | Enum | CONFIRMADO_PRESENTE | Diagnostico final confirma esses valores como roles reais | Recriar enum existente falha | Nao reaplicar; comparar se migration local corresponde ao enum remoto |
| `20260709000100_baseline_schema.sql` | `institutions` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista a tabela no nucleo remoto | Reaplicar DDL pode falhar por objeto existente | Usar como parte do baseline remoto |
| `20260709000100_baseline_schema.sql` | `profiles` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista a tabela e colunas importantes | Reaplicar DDL pode falhar e afetar Auth/profile | Comparar colunas, defaults e constraints antes de baseline tecnico |
| `20260709000100_baseline_schema.sql` | `memberships` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista a tabela e colunas importantes | Reaplicar DDL pode falhar e afetar isolamento institucional | Comparar estrutura e manter dados existentes |
| `20260709000100_baseline_schema.sql` | `students` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela, colunas e FKs | Reaplicar DDL pode falhar; `profile_id` obrigatorio bloqueia aluno sem login | Manter modelo atual ate migration futura aprovada |
| `20260709000100_baseline_schema.sql` | `guardianships` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela e FKs | Reaplicar DDL pode falhar | Comparar constraints antes de qualquer baseline tecnico |
| `20260709000100_baseline_schema.sql` | `academic_years` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela no nucleo remoto | Reaplicar DDL pode falhar | Usar como baseline remoto confirmado |
| `20260709000100_baseline_schema.sql` | `terms` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela no nucleo remoto | Reaplicar DDL pode falhar | Comparar FK para `academic_years` |
| `20260709000100_baseline_schema.sql` | `classes` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela e FK para `academic_years` | Reaplicar DDL pode falhar | Comparar colunas e constraints |
| `20260709000100_baseline_schema.sql` | `subjects` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela no nucleo remoto | Reaplicar DDL pode falhar | Comparar unique de `code` e defaults |
| `20260709000100_baseline_schema.sql` | `enrollments` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela e FKs | Reaplicar DDL pode falhar | Comparar unique e relacoes com students/classes/academic_years |
| `20260709000100_baseline_schema.sql` | `subject_offerings` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela e FK de professor | Reaplicar DDL pode falhar | Comparar unique e joins institucionais |
| `20260709000100_baseline_schema.sql` | `student_registration_counters` | Tabela | CONFIRMADO_PRESENTE | Diagnostico final lista tabela e PK composta | Reaplicar DDL pode afetar RA | Preservar dados e comparar PK/defaults |
| Estado remoto manual | `generate_student_registration_number` | Funcao | CONFIRMADO_PRESENTE | Diagnostico final confirma funcao e comportamento de RA | Pode haver divergencia com migrations locais, pois nao aparece na baseline local lida | Inventariar definicao antes de baseline tecnico |
| Estado remoto manual | `set_student_registration_number` | Funcao | CONFIRMADO_PRESENTE | Diagnostico final confirma funcao e chamada pelo trigger | Pode haver divergencia com migrations locais | Inventariar definicao e privileges |
| Estado remoto manual | `students_generate_registration_number` | Trigger | CONFIRMADO_PRESENTE | Diagnostico final confirma trigger em `students` | Recriar sem comparar pode duplicar comportamento ou falhar | Preservar e comparar definicao |
| Estado remoto manual | `is_institution_admin` | Funcao | CONFIRMADO_PRESENTE | Diagnostico final confirma funcao; candidato de RLS documenta hardening pendente | Funcao atual nao filtra `membership.active is true` | Recriar somente via migration incremental aprovada |
| Estado remoto manual | `can_view_institution_profile` | Funcao | CONFIRMADO_PRESENTE | Diagnostico final confirma funcao; candidato de RLS documenta hardening pendente | Funcao atual nao filtra `membership.active is true` | Recriar somente via migration incremental aprovada |
| `20260710000200_attendance_and_grades.sql` | `assessments` | Tabela | CONFIRMADO_AUSENTE | Diagnostico final confirma ausencia | Criacao direta antes de baseline pode conflitar com historico ausente | Planejar como migration futura em staging |
| `20260710000200_attendance_and_grades.sql` | `grades` | Tabela | CONFIRMADO_AUSENTE | Diagnostico final confirma ausencia | Depende de `assessments` e do nucleo reconciliado | Planejar em conjunto com modulo de notas |
| `20260710000200_attendance_and_grades.sql` | `attendance_sessions` | Tabela | CONFIRMADO_AUSENTE | Diagnostico final confirma ausencia | Depende de `subject_offerings` e nucleo reconciliado | Planejar em staging |
| `20260710000200_attendance_and_grades.sql` | `attendance_records` | Tabela | CONFIRMADO_AUSENTE | Diagnostico final confirma ausencia | Depende de `attendance_sessions` | Planejar em staging |
| `20260710000200_attendance_and_grades.sql` | `public.touch_academic_record_updated_at()` | Funcao | DESCONHECIDO | Tabelas alvo estao ausentes; funcao por nome nao foi confirmada | Pode existir manualmente, embora nao haja evidencia | Inventariar functions antes de aplicar modulo |
| `20260710000200_attendance_and_grades.sql` | `*_touch_updated_at` | Triggers | CONFIRMADO_AUSENTE | Tabelas alvo `assessments`, `grades`, `attendance_sessions`, `attendance_records` estao ausentes | Nao podem existir sem tabelas alvo | Criar somente junto do modulo aprovado |
| `20260710000300_attendance_and_grades_rls.sql` | `private` | Schema | DESCONHECIDO | Documentos nao confirmam existencia do schema `private` | Criar schema/grants sem inventario pode mudar superficie de permissao | Inventariar antes de migration real |
| `20260710000300_attendance_and_grades_rls.sql` | Helpers `private.has_institution_role` e relacionados | Funcoes | DESCONHECIDO | Documentos nao confirmam essas funcoes | Recriar ou alterar privileges sem comparacao pode quebrar RLS futuro | Inventariar functions e privileges em staging |
| `20260710000300_attendance_and_grades_rls.sql` | Policies de `assessments` | Policy | CONFIRMADO_AUSENTE | Tabela `assessments` ausente | DDL falha sem tabela alvo | Aplicar somente apos criar tabela em staging |
| `20260710000300_attendance_and_grades_rls.sql` | Policies de `grades` | Policy | CONFIRMADO_AUSENTE | Tabela `grades` ausente | DDL falha sem tabela alvo | Aplicar somente apos criar tabela em staging |
| `20260710000300_attendance_and_grades_rls.sql` | Policies de `attendance_sessions` | Policy | CONFIRMADO_AUSENTE | Tabela `attendance_sessions` ausente | DDL falha sem tabela alvo | Aplicar somente apos criar tabela em staging |
| `20260710000300_attendance_and_grades_rls.sql` | Policies de `attendance_records` | Policy | CONFIRMADO_AUSENTE | Tabela `attendance_records` ausente | DDL falha sem tabela alvo | Aplicar somente apos criar tabela em staging |
| `20260710000400_attendance_and_grades_integrity.sql` | `private.validate_assessment_integrity()` | Funcao | DESCONHECIDO | Funcao por nome nao foi confirmada | Pode depender de tabelas ausentes | Inventariar antes de aplicar integridade |
| `20260710000400_attendance_and_grades_integrity.sql` | `private.validate_grade_integrity()` | Funcao | DESCONHECIDO | Funcao por nome nao foi confirmada | Pode depender de tabelas ausentes | Inventariar antes de aplicar integridade |
| `20260710000400_attendance_and_grades_integrity.sql` | `private.validate_attendance_session_integrity()` | Funcao | DESCONHECIDO | Funcao por nome nao foi confirmada | Pode depender de tabelas ausentes | Inventariar antes de aplicar integridade |
| `20260710000400_attendance_and_grades_integrity.sql` | `private.validate_attendance_record_integrity()` | Funcao | DESCONHECIDO | Funcao por nome nao foi confirmada | Pode depender de tabelas ausentes | Inventariar antes de aplicar integridade |
| `20260710000400_attendance_and_grades_integrity.sql` | `*_validate_integrity` | Triggers | CONFIRMADO_AUSENTE | Tabelas alvo de notas/frequencia estao ausentes | Nao podem existir sem tabelas alvo | Criar somente apos modulo e RLS |
| Estado remoto auditado | RLS nas tabelas do nucleo | RLS | CONFIRMADO_PRESENTE | Diagnostico final confirma RLS ativo nas tabelas auditadas | Recriar policies sem comparar pode remover acesso valido | Comparar `pg_policies` antes de hardening |
| Estado remoto auditado | Policies principais do nucleo | Policy | PARCIAL | Diagnostico final confirma policies observadas, mas aponta falta de `membership.active is true` em varias | Definicoes completas precisam de comparacao | Usar candidato de RLS em staging apos baseline |
| Estado remoto auditado | Constraints principais do nucleo | Constraint | PARCIAL | Diagnostico final confirma FKs e uniques importantes | Nomes e definicoes completas ainda precisam de comparacao | Completar matriz antes de baseline tecnico |
| `20260709000100_baseline_schema.sql` | Indexes principais do nucleo | Index | DESCONHECIDO | Documentos citam auditoria de indexes, mas o diagnostico final nao confirma nomes/definicoes | Recriar index existente pode falhar ou duplicar indices equivalentes | Inventariar indexes remotamente antes de qualquer migration |
| `20260710000200_attendance_and_grades.sql` | Indexes de notas/frequencia | Index | CONFIRMADO_AUSENTE | Tabelas alvo estao confirmadas ausentes | Nao podem existir em tabelas ausentes | Criar somente com modulo em staging |
| Estado remoto auditado | Dados de memberships | Dados | CONFIRMADO_PRESENTE | Diagnostico final confirma `ADMIN active true`: 1, `TEACHER active true`: 1, `STUDENT active true`: 3 | Qualquer reset ou reaplicacao destrutiva perderia dados | Preservar e validar antes/depois |
| Estado remoto auditado | Orfaos principais | Qualidade de dados | CONFIRMADO_PRESENTE | Diagnostico final confirma zero orfaos principais auditados | Mudancas sem rollback podem introduzir inconsistencias | Usar como baseline de validacao |
