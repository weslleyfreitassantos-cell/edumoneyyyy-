# Diagnostico final do banco remoto

Este documento consolida a auditoria real feita manualmente no Supabase SQL
Editor. A auditoria foi read-only. Nenhum comando Supabase remoto foi executado
por esta entrega.

## Historico de migrations remoto

Resultado confirmado:

- `supabase_migrations.schema_migrations`: ausente/null
- `auth.schema_migrations`: existe
- `storage.migrations`: existe
- `realtime.schema_migrations`: existe

Conclusao: nao ha historico remoto Supabase CLI confirmado na tabela esperada
`supabase_migrations.schema_migrations`. Nao executar `db push`, `migration
repair` ou `db reset` antes de uma estrategia formal de reconciliacao.

## Tabelas publicas existentes

O remoto possui o nucleo academico principal:

- `academic_years`
- `classes`
- `enrollments`
- `guardianships`
- `institutions`
- `memberships`
- `profiles`
- `student_registration_counters`
- `students`
- `subject_offerings`
- `subjects`
- `terms`

## Tabelas esperadas, mas ausentes

As tabelas abaixo nao existem no remoto:

- `assessments`
- `grades`
- `attendance_sessions`
- `attendance_records`

Conclusao: notas e frequencia ainda nao existem no remoto, apesar de haver
migrations locais no repositorio.

## Enum remoto de roles

`public.user_role` contem somente:

- `ADMIN`
- `DIRECTOR`
- `TEACHER`
- `STUDENT`
- `GUARDIAN`

Conclusao: `SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` continuam planejadas e
nao sao roles ativas.

## RLS

RLS esta ativo nas tabelas publicas auditadas:

- `academic_years`
- `classes`
- `enrollments`
- `guardianships`
- `institutions`
- `memberships`
- `profiles`
- `student_registration_counters`
- `students`
- `subject_offerings`
- `subjects`
- `terms`

Todas foram confirmadas com `rls_enabled = true` e `force_rls = false`.

## Colunas importantes

### profiles

- `id uuid not null`
- `full_name text not null`
- `email text not null`
- `role user_role not null`
- `active boolean default true`

### memberships

- `profile_id uuid not null`
- `institution_id uuid not null`
- `role user_role not null`
- `active boolean default true`
- `joined_at timestamptz default now()`

### students

- `profile_id uuid not null`
- `institution_id uuid not null`
- `registration_number text not null`
- `active boolean default true`

### student_registration_counters

- `institution_id uuid not null`
- `registration_year integer not null`
- `last_value integer not null default 0`

## Foreign keys confirmadas

- `profiles.id -> auth.users.id`
- `memberships.profile_id -> profiles.id`
- `memberships.institution_id -> institutions.id`
- `students.profile_id -> profiles.id`
- `students.institution_id -> institutions.id`
- `guardianships.guardian_profile_id -> profiles.id`
- `guardianships.student_id -> students.id`
- `enrollments.student_id -> students.id`
- `enrollments.class_id -> classes.id`
- `enrollments.academic_year_id -> academic_years.id`
- `subject_offerings.teacher_profile_id -> profiles.id`

Conclusao: no modelo atual, estudante precisa de `profile` e `profile` precisa
de `auth.users`. Aluno sem login nao e possivel sem migration futura.

## Funcoes publicas confirmadas

- `can_view_institution_profile(target_profile_id uuid)`
- `generate_student_registration_number(target_institution_id uuid)`
- `is_institution_admin(target_institution_id uuid)`
- `set_student_registration_number()`

Todas sao `SECURITY DEFINER` com `SET search_path TO ''`.

`can_view_institution_profile` e `is_institution_admin` consideram `ADMIN` e
`DIRECTOR`, mas nao filtram `membership.active is true`. Hardening futuro deve
incluir essa condicao.

## Funcoes de RA

`set_student_registration_number` chama
`generate_student_registration_number` quando `registration_number` esta vazio.

`generate_student_registration_number` usa contador por `institution_id` +
`registration_year`, com `insert on conflict do update`.

Formato do RA: ano + sequencia de 4 digitos.

Limite anual: 9999 por instituicao/ano.

## Privilegios de funcoes

### can_view_institution_profile

- `anon can execute`: true
- `authenticated can execute`: true
- `service_role can execute`: true

### is_institution_admin

- `anon can execute`: true
- `authenticated can execute`: true
- `service_role can execute`: true

### generate_student_registration_number

- `anon can execute`: false
- `authenticated can execute`: false
- `service_role can execute`: true

### set_student_registration_number

- `anon can execute`: false
- `authenticated can execute`: false
- `service_role can execute`: true

Conclusao: usuarios comuns nao conseguem consumir RA chamando a funcao
diretamente. Avaliar em hardening se `anon` deve continuar podendo executar as
funcoes booleanas auxiliares.

## Dados atuais confirmados

`membership_roles`:

- `ADMIN active true`: 1
- `TEACHER active true`: 1
- `STUDENT active true`: 3

Inconsistencias confirmadas:

- `profiles_without_auth_user`: 0
- `auth_users_without_profile`: 0
- `students_without_profile`: 0
- `memberships_without_profile`: 0
- `memberships_without_institution`: 0

Conclusao: a base atual nao mostrou orfaos nessas relacoes principais.

## Constraints e uniques importantes

- `profiles.email unique`
- `institutions.cnpj unique`
- `memberships(profile_id, institution_id) unique`
- `guardianships(student_id, guardian_profile_id) unique`
- `enrollments(student_id, class_id, academic_year_id) unique`
- `students.cpf unique`
- `students(institution_id, registration_number) unique`
- `student_registration_counters(institution_id, registration_year) primary key`
- `subject_offerings(subject_id, class_id, term_id) unique`

## Trigger confirmada

`students_generate_registration_number`

- `BEFORE INSERT ON students`
- `EXECUTE FUNCTION set_student_registration_number()`

## Policies observadas

- Leitura por instituicao existe em tabelas principais.
- `memberships` pode ser lida pelo proprio usuario e por admin/diretor da
  instituicao.
- `profiles` pode ser lida pelo proprio usuario e por admin/diretor via funcao.
- `students` permite insert/update por `is_institution_admin(institution_id)`.
- Varias policies de leitura nao filtram `membership.active is true`.
- `subject_offerings` ja filtra `membership.active is true`.

Conclusao: padronizar policies para `membership.active is true` em migration
futura.

## Decisao tecnica recomendada

- Nao executar `db push`.
- Nao executar `migration repair` ainda.
- Nao executar `db reset`.
- Criar uma estrategia controlada:
  1. registrar baseline remoto;
  2. comparar com migrations locais;
  3. criar staging se possivel;
  4. aplicar migration incremental controlada;
  5. so depois ativar cadastro real/convites.

## Conclusão operacional

A auditoria confirma que o banco remoto tem o núcleo escolar principal, mas não tem histórico Supabase CLI em `supabase_migrations.schema_migrations`. Também confirma ausência das tabelas de notas/frequência e confirma que o modelo atual exige Auth/profile para alunos.

Portanto, a próxima etapa não deve ser `db push`, `migration repair` ou `db reset`. A próxima etapa segura é preparar uma migration incremental controlada depois de baseline/reconciliação e, idealmente, validar em staging.
