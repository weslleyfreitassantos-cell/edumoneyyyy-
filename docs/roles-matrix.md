# Matriz de roles e permissoes

## Premissas

- Roles atuais do banco: `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT`,
  `GUARDIAN`.
- Roles futuras documentadas: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `SECRETARY`.
- `currentRole`/`memberships.role` tem prioridade em telas contextuais.
- `profile.role` e fallback temporario.
- `ProtectedRoute` ainda pode usar `profile.role` para rotas globais.
- `SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` nao sao roles ativas no banco.

## Confirmacao da auditoria manual

A auditoria read-only confirmou que o enum remoto `public.user_role` contem
somente `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT` e `GUARDIAN`.
`SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` nao devem ser ativados em UI,
policies, Edge Functions ou seeds ate uma migration propria existir.

Tambem foi confirmado que funcoes administrativas do remoto precisam de
hardening para exigir `membership.active is true`. Ate la, qualquer expansao de
permissao deve permanecer bloqueada.

## Matriz de roles

| Role | Status atual | Escopo | Fonte atual | Fonte futura | Observacao de seguranca |
| --- | --- | --- | --- | --- | --- |
| `ADMIN` | Ativa | Escola/compatibilidade administrativa | `profiles.role` e `memberships.role` | possivel divisao com `SCHOOL_ADMIN` | Pode gerenciar estrutura escolar hoje. |
| `DIRECTOR` | Ativa | Escola | `profiles.role` e `memberships.role` | `memberships.role` | Compatibilidade atual com permissoes administrativas. |
| `TEACHER` | Ativa | Escola/turmas | `profiles.role` e `memberships.role` | `memberships.role` | Deve ver apenas turmas e dados vinculados. |
| `STUDENT` | Ativa | Aluno | `profiles.role` e `memberships.role` | `memberships.role` ou aluno sem login | Login pode ser opcional no futuro. |
| `GUARDIAN` | Ativa | Responsavel | `profiles.role` e `memberships.role` | `memberships.role` | Acesso deve depender de `guardianships`. |
| `SUPER_ADMIN` | Futura | Plataforma | Nenhuma ativa | `profiles.platform_role` ou equivalente | Nao deve ser criado apenas no frontend. |
| `SCHOOL_ADMIN` | Futura | Escola | Nenhuma ativa | `memberships.role` | Depende de migration, RLS e Edge Functions. |
| `SECRETARY` | Futura | Escola/operacao | Nenhuma ativa | `memberships.role` | Depende de migration, RLS e escopo limitado. |

## Matriz de permissoes

| Permissao | ADMIN | DIRECTOR | TEACHER | STUDENT | GUARDIAN | Roles futuras previstas |
| --- | --- | --- | --- | --- | --- | --- |
| `create_school` | Nao | Nao | Nao | Nao | Nao | `SUPER_ADMIN` |
| `manage_school` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN` |
| `manage_school_users` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN`, `SECRETARY` limitado |
| `manage_students` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN`, `SECRETARY` |
| `manage_guardians` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN`, `SECRETARY` |
| `manage_teachers` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN`, `SECRETARY` limitado |
| `manage_enrollments` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN`, `SECRETARY` |
| `manage_academic_structure` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN` |
| `manage_assignments` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN` |
| `view_school_dashboard` | Sim | Sim | Nao | Nao | Nao | `SCHOOL_ADMIN`, `SECRETARY` |
| `view_reports` | Sim | Sim | Nao | Nao | Nao | `SUPER_ADMIN`, `SCHOOL_ADMIN` |
| `view_own_classes` | Nao | Nao | Sim | Nao | Nao | Nao aplicavel |
| `view_own_student_data` | Nao | Nao | Nao | Sim | Nao | Nao aplicavel |
| `view_linked_students` | Nao | Nao | Nao | Nao | Sim | Nao aplicavel |

## Observacoes

- A matriz reflete o frontend atual, os planos documentados e o enum remoto
  confirmado pela auditoria manual.
- `DIRECTOR` ainda possui permissao compativel com `ADMIN` por transicao.
- `SECRETARY` nao deve ser ativada ate o banco, RLS e Edge Functions suportarem
  o escopo real.
- Qualquer mudanca real de role precisa passar por auditoria read-only e
  reconciliacao de migrations.

## Consolidação pós-auditoria manual

O enum remoto confirmado é `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT` e `GUARDIAN`.

A separação futura recomendada continua sendo:

- papel global em `profiles.platform_role`;
- papel escolar em `memberships.role`.

Até lá, `currentRole`/`memberships.role` deve ter prioridade nas telas contextuais, com `profiles.role` como fallback temporário.
