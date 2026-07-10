# 006 — Aluno sem login

Status: draft/documentação. Não executar diretamente.

## Estado atual

A auditoria confirmou:

- `profiles.id -> auth.users.id`
- `students.profile_id -> profiles.id`
- `students.profile_id` é obrigatório

Logo, aluno sem login não é possível no modelo atual.

## Alternativas

### Tornar `students.profile_id` nullable

Prós:
- Menor mudança estrutural.

Contras:
- Muitos fluxos precisam tratar aluno com e sem profile.
- Dashboards e guardianships podem exigir ajustes.

### Criar entidade acadêmica separada

Exemplo: `student_people` ou `academic_students`.

Prós:
- Separa pessoa acadêmica de usuário Auth.
- Melhor para alunos menores sem acesso.

Contras:
- Refatoração maior.

## Impactos

- Matrícula.
- Responsáveis.
- Dashboard do aluno.
- Convites.
- Auth.
- Relatórios.
- RLS.

## Recomendação

Manter modelo atual para primeira versão real de convite. Planejar aluno sem login em fase separada.
