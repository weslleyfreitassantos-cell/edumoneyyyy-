# Auditoria de escritas do frontend

Esta auditoria foi feita por leitura local do codigo e buscas por termos de
escrita. Nenhum comportamento foi alterado aqui.

## Services e hooks que leem dados

- `institutionService.listForProfile`: le `memberships` e `institutions`.
- `schoolUserService.list`: le usuarios da escola via `memberships` +
  `profiles`.
- `adminOverviewService.getOverview`: le agregados operacionais.
- `studentDashboardService`, `teacherDashboardService` e
  `guardianDashboardService`: leem dados de dashboards.
- Hooks `useCurrentInstitution`, `useUserInstitutions`, `useSchoolUsers` e
  hooks de dashboard sao fluxos de leitura.

## Services e hooks que escrevem dados

- `academicStructureService`: cria/atualiza anos letivos e periodos.
- `classService`: cria/atualiza/desativa turmas.
- `subjectService`: cria/atualiza/desativa disciplinas.
- `assignmentService`: cria/atualiza/desativa `subject_offerings`.
- `enrollmentService`: cria matriculas, transfere e atualiza status.
- `studentService`: atualiza/desativa aluno e chama funcao de criacao.
- `teacherService`: desativa professor e chama funcao de criacao.
- `guardianService`: atualiza vinculo e chama funcao de criacao.

Hooks com `useMutation` coordenam essas escritas:

- `useAcademicStructure`
- `useClasses`
- `useSubjects`
- `useAssignments`
- `useEnrollments`
- `useStudents`
- `useTeachers`
- `useGuardians`

## Edge Functions chamadas pelo frontend

- `studentService.create` chama `create-student`.
- `teacherService.create` chama `create-teacher`.
- `guardianService.create` chama `create-guardian`.

## Telas que podem alterar dados hoje

- `StudentsTab`
- `TeachersTab`
- `GuardiansTab`
- `AcademicYearsTab`
- `ClassesTab`
- `SubjectsTab`
- `EnrollmentsTab`
- `AssignmentsTab`
- `SetPassword`

Essas telas usam forms, hooks de mutation e services de escrita existentes.

## Telas somente leitura

- `SchoolUsersTab`: lista usuarios da escola e mostra a previa visual.
- `AdminOverviewTab`: leitura de indicadores.
- Dashboards de aluno, professor, responsavel e diretor: leitura de dados
  operacionais.

## Fluxos visuais bloqueados

- `UnifiedUserInvitePreview`: nao importa services de escrita, nao chama Auth,
  nao chama Edge Function e mantem o botao `Enviar convite` desabilitado.
- Modelo `unifiedUserInviteModel`: descreve tipos visuais e planejados; nao
  retorna payload de banco real.
- Schema `unifiedUserInvitePreviewSchema`: valida apenas formulario local de
  previa e rejeita campos extras.

## Buscas usadas

Termos auditados no codigo local:

- `insert(`
- `update(`
- `delete(`
- `upsert(`
- `rpc(`
- `functions.invoke`
- `supabase.functions.invoke`
- `createStudent`
- `createTeacher`
- `createGuardian`
- `create-`
- `useMutation`
- `onSubmit`
- `handleSubmit`

## Riscos antes de producao

- Escritas administrativas ja existem e dependem de RLS/policies corretas.
- Edge Functions atuais criam usuarios reais e precisam de homologacao em
  staging antes de expandir o fluxo.
- Cadastro unificado visual nao deve ser habilitado sem migrations, roles,
  convites e logs.
- `ProtectedRoute` ainda usa `profile.role`, entao a transicao para
  `memberships.role` deve ser gradual.
- Ativar `SECRETARY` ou `SCHOOL_ADMIN` sem banco/RLS cria risco de permissao
  incompleta.

## Impacto da auditoria remota

- `supabase_migrations.schema_migrations` esta ausente/null, entao escrita nova
  no remoto depende de reconciliacao.
- `assessments`, `grades`, `attendance_sessions` e `attendance_records` estao
  ausentes no remoto; telas futuras de notas/frequencia devem aguardar migration
  controlada.
- `students.profile_id` e obrigatorio e depende de `auth.users`; aluno sem
  login requer migration futura.
- As funcoes de RA estao protegidas para `service_role`, o que evita consumo
  direto por usuarios comuns.
- Funcoes/policies que nao filtram `membership.active is true` precisam de
  hardening antes de ampliar fluxo de convite real.

## Consolidação pós-auditoria manual

O fluxo de cadastro unificado permanece visual e bloqueado. O banco remoto ainda não está pronto para convite real porque migrations não foram reconciliadas e roles planejadas não existem no enum remoto.

Qualquer escrita real deve passar por Edge Function segura, RLS revisado e validação de membership ativa.
