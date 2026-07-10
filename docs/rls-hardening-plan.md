# Plano de hardening de RLS

## Problema

A auditoria mostrou que funções e várias policies não filtram `membership.active is true`.

## Funções afetadas

- `is_institution_admin`
- `can_view_institution_profile`

## Policies candidatas à revisão

- `academic_years`
- `classes`
- `enrollments`
- `guardianships`
- `institutions`
- `memberships`
- `profiles`
- `students`
- `subjects`
- `terms`

A policy de `subject_offerings` já filtra membership ativa.

## Melhoria opcional

Avaliar revogar `EXECUTE` de `anon` nas funções booleanas, mantendo `authenticated` e `service_role`, desde que não quebre RLS.

## Testes antes/depois

- Usuário ativo vê dados.
- Usuário inativo não vê dados.
- Admin ativo gerencia.
- Admin inativo não gerencia.
- Professor acessa apenas seu escopo.
- Aluno acessa próprios dados.
- Responsável acessa alunos vinculados.

## Risco

Se houver memberships com `active` nulo/falso indevidamente, usuários legítimos podem perder acesso.
