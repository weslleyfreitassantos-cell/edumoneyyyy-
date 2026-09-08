# Matriz de papéis e permissões

> Atualizado em 28 jul 2026 — baseado em auditoria de frontend, RLS e Edge Functions.

---

## 1. Papéis ativos

| Papel | Escopo | Origem | Fonte atual | Status no Supabase |
|-------|--------|--------|-------------|-------------------|
| **SUPER_ADMIN** | Global (plataforma) | `profiles.platform_role` | `profiles` | `platform_role` enum |
| **ADMIN** | Conta + instituição | `profiles.role` / `memberships.role` | Ambos | `user_role` enum |
| **DIRECTOR** | Instituição | `memberships.role` | `memberships` | `user_role` enum |
| **SECRETARY** | Instituição | `memberships.role` (frontend) | `memberships` | **NÃO está no enum remoto** |
| **TEACHER** | Instituição | `memberships.role` | `memberships` | `user_role` enum |
| **STUDENT** | Instituição | `memberships.role` | `memberships` | `user_role` enum |
| **GUARDIAN** | Instituição | `memberships.role` | `memberships` | `user_role` enum |

### Notas

- `SUPER_ADMIN` é definido em `profiles.platform_role` — **não** é um valor do `user_role` enum
- `SECRETARY` está presente no frontend e nas funções RLS do banco, mas **não** está no `user_role` enum remoto
- `profiles.role` é fallback quando `memberships.role` não está disponível

---

## 2. Permissões do sistema (17)

### Globais / Plataforma

| ID | Descrição |
|----|-----------|
| `view_platform_dashboard` | Ver dashboard da plataforma |
| `manage_accounts` | Gerenciar contas |
| `manage_account_limits` | Gerenciar limites de contas |
| `suspend_accounts` | Suspender/reativar contas |
| `view_all_institutions` | Ver todas as instituições |
| `create_institution` | Criar instituição |

### Escola

| ID | Descrição |
|----|-----------|
| `manage_school` | Gerenciar escola |
| `manage_school_users` | Gerenciar usuários da escola |
| `manage_students` | Gerenciar alunos |
| `manage_guardians` | Gerenciar responsáveis |
| `manage_teachers` | Gerenciar professores |
| `manage_enrollments` | Gerenciar matrículas |
| `manage_academic_structure` | Gerenciar estrutura acadêmica (séries, disciplinas, turmas, matriz, horários) |
| `manage_assignments` | Gerenciar atribuições de professores |
| `view_school_dashboard` | Ver dashboard da escola |
| `view_reports` | Ver relatórios |

### Pessoal

| ID | Descrição |
|----|-----------|
| `view_own_classes` | Ver próprias aulas |
| `view_own_student_data` | Ver próprios dados do aluno |
| `view_linked_students` | Ver alunos vinculados (responsável) |

---

## 3. Matriz frontend (permissions.ts)

| Permissão | ADMIN | DIRECTOR | SECRETARY | TEACHER | STUDENT | GUARDIAN | SUPER_ADMIN |
|-----------|-------|----------|-----------|---------|---------|----------|-------------|
| `view_platform_dashboard` | - | - | - | - | - | - | ✓ |
| `manage_accounts` | - | - | - | - | - | - | ✓ |
| `manage_account_limits` | - | - | - | - | - | - | ✓ |
| `suspend_accounts` | - | - | - | - | - | - | ✓ |
| `view_all_institutions` | - | - | - | - | - | - | ✓ |
| `create_institution` | ✓ | - | - | - | - | - | ✓ |
| `manage_school` | - | ✓ | - | - | - | - | ✓ |
| `manage_school_users` | ✓ | ✓ | ✓ | - | - | - | ✓ |
| `manage_students` | - | ✓ | ✓ | - | - | - | ✓ |
| `manage_guardians` | - | ✓ | ✓ | - | - | - | ✓ |
| `manage_teachers` | - | ✓ | ✓ | - | - | - | ✓ |
| `manage_enrollments` | - | ✓ | ✓ | - | - | - | ✓ |
| `manage_academic_structure` | - | ✓ | - | - | - | - | ✓ |
| `manage_assignments` | - | ✓ | - | - | - | - | ✓ |
| `view_school_dashboard` | ✓ | ✓ | ✓ | - | - | - | ✓ |
| `view_reports` | ✓ | ✓ | - | - | - | - | ✓ |
| `view_own_classes` | - | - | - | ✓ | - | - | - |
| `view_own_student_data` | - | - | - | - | ✓ | - | - |
| `view_linked_students` | - | - | - | - | - | ✓ | - |

---

## 4. Matriz de rotas

| Rota | Acesso | Componente |
|------|--------|------------|
| `/login` | Público | Login |
| `/forgot-password` | Público | ForgotPassword |
| `/auth/confirm` | Público | AuthConfirm |
| `/auth/reset-password` | Público | ResetPassword |
| `/set-password` | Público | SetPassword |
| `/unauthorized` | Público | Unauthorized |
| `/dashboard` | Qualquer autenticado | Dashboard por papel |
| `/admin` | ADMIN/DIRECTOR/SECRETARY/SUPER_ADMIN | AdminPage |
| `/platform` | SUPER_ADMIN | PlatformPage |
| `/account` | Qualquer autenticado | AccountPage |

### Dashboard por papel

| Papel | Dashboard |
|-------|-----------|
| SUPER_ADMIN | PlatformPage |
| ADMIN | AccountPage |
| DIRECTOR | DirectorDashboard |
| SECRETARY | DirectorDashboard |
| TEACHER | TeacherDashboard |
| STUDENT | StudentDashboard |
| GUARDIAN (parent) | ParentDashboard |

---

## 5. Matriz RLS (SQL)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `accounts` | SUPER_ADMIN ou owner | - (Edge) | - (Edge) | - (Edge) |
| `institutions` | Acesso à instituição | - (Edge) | - (Edge) | - (Edge) |
| `profiles` | Próprio, SUPER_ADMIN ou acesso à instituição | - | Via profileService | - |
| `memberships` | Próprio ou acesso à instituição | - | `can_manage_institution_operations` | - |
| `students` | `can_manage_institution_operations` ou próprio ou guardião | - | `can_manage_institution_operations` | - |
| `guardianships` | Próprio ou gestão do aluno | - | Gestão do aluno | - |
| `classes` | Acesso à instituição | `can_manage_institution_operations` | `can_manage_institution_operations` | `can_manage_institution_operations` |
| `subjects` | Acesso à instituição | `is_institution_admin` | `is_institution_admin` | `is_institution_admin` |
| `academic_years` | Acesso à instituição | `is_institution_admin` | `is_institution_admin` | `is_institution_admin` |
| `enrollments` | Acesso à instituição via turma | `can_manage_institution_operations` via turma | `can_manage_institution_operations` via turma | `can_manage_institution_operations` via turma |
| `subject_offerings` | Próprio teacher ou acesso à turma | `is_institution_admin` via turma | `is_institution_admin` via turma | `is_institution_admin` via turma |
| `assessments` | `can_manage_assessment` ou `can_student_view_grade` | `can_manage_assessment` | `can_manage_assessment` | - |
| `grades` | `can_manage_assessment` ou `can_student_view_grade` | `can_manage_assessment` | `can_manage_assessment` | - |
| `attendance_sessions` | `can_manage_attendance_session` ou `can_student_view_attendance` | `can_manage_attendance_session` | `can_manage_attendance_session` | - |
| `attendance_records` | Via session | via session | via session | - |
| `branding_settings` | SUPER_ADMIN ou GLOBAL ou ACCOUNT owner | - (Edge) | - (Edge) | - (Edge) |

---

## 6. Edge Functions

| Função | verify_jwt | Verificação de papel | Ação |
|--------|-----------|---------------------|------|
| `create-client-account` | ✓ | SUPER_ADMIN | Cria conta |
| `update-client-account` | ✓ | SUPER_ADMIN | Atualiza status/limites |
| `delete-client-account` | ✓ | SUPER_ADMIN | Desativa (hard delete desligado) |
| `create-institution` | ✓ | SUPER_ADMIN ou account owner | Cria instituição |
| `update-institution-status` | ✓ | SUPER_ADMIN | Suspende/reativa instituição |
| `invite-school-user` | ✓ | Hierarquia de papéis | Convida usuário |
| `create-student` | ✓ | A confirmar | Cria aluno |
| `create-teacher` | ✓ | A confirmar | Cria professor |
| `create-guardian` | ✓ | A confirmar | Cria responsável |

---

## 7. Divergências encontradas

### P0 — Exposição cross-tenant ou escrita indevida

Nenhum P0 identificado.

### P1 — Acesso funcional incorreto

| ID | Descrição | Impacto |
|----|-----------|---------|
| P1-01 | `SECRETARY` não existe no enum `user_role` remoto | `ProtectedRoute` permite SECRETARY em `/admin`, mas o banco não reconhece o role. Membros com `memberships.role = 'SECRETARY'` podem ter RLS inconsistente. |
| P1-02 | ADMIN no frontend tem menos permissões que DIRECTOR | ADMIN (frontend) não pode gerenciar alunos, professores ou estrutura acadêmica — mas pode na prática via RLS (`is_institution_admin`). Divergência entre frontend e banco. |
| P1-03 | `ProtectedRoute` usa `profile.role` (fallback) para rotas | Usuários sem membership ativa podem acessar `/admin` se `profile.role = 'ADMIN'`, mesmo sem instituição vinculada. Atenuado pelo redirect em AdminPage. |

### P2 — Inconsistência visual

| ID | Descrição |
|----|-----------|
| P2-01 | SECRETARY mapeado para DirectorDashboard (rótulo "Painel da Secretaria") |
| P2-02 | `create-student`, `create-teacher`, `create-guardian` sem verificação de papel visível no frontend |

---

## 8. Ações recomendadas

### Antes do piloto

1. **Adicionar `SECRETARY` ao enum `user_role`** no Supabase (migration)
2. **Revisar permissões do ADMIN** — decidir se ADMIN deve ter as mesmas permissões de DIRECTOR, ou se a diferença é intencional (owner vs school admin)
3. **Corrigir `create-student`, `create-teacher`, `create-guardian`** — adicionar verificações de papel e documentar

### Primeira semana de piloto

4. **Atualizar ProtectedRoute** para usar `memberships.role` em vez de `profile.role` para `/admin`
5. **Documentar fluxo do SECRETARY** — confirmar se o papel funciona corretamente com RLS
