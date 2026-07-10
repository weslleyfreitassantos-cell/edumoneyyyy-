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
