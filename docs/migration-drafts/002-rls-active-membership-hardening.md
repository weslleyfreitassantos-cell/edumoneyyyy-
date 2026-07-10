# 002 — Hardening de RLS com membership ativa

Status: draft/documentação. Não executar diretamente.

## Objetivo

Padronizar policies e funções para considerar apenas memberships ativas.

## Achado da auditoria

As funções `is_institution_admin` e `can_view_institution_profile` consideram `ADMIN` e `DIRECTOR`, mas não filtram `membership.active is true`.

Várias policies de leitura também consultam `memberships` sem exigir `active is true`. A policy de `subject_offerings` já possui filtro de membership ativa.

## Mudanças conceituais

- Atualizar `is_institution_admin` para exigir `membership.active is true`.
- Atualizar `can_view_institution_profile` para exigir membership ativa do alvo e do visualizador quando aplicável.
- Revisar policies de `academic_years`, `classes`, `enrollments`, `guardianships`, `institutions`, `memberships`, `profiles`, `students`, `subjects` e `terms`.
- Avaliar se `anon` precisa continuar com `EXECUTE` nas funções booleanas.

## Riscos

Usuários podem perder acesso se houver memberships com `active` nulo ou falso indevidamente.

## Pré-check obrigatório

- Contar memberships por role/active.
- Garantir que usuários válidos estejam com `active = true`.
- Testar admin ativo, admin inativo, professor, aluno e responsável.

## Validação pós-aplicação

- Usuário ativo vê dados da escola.
- Usuário inativo não vê dados.
- Admin ativo gerencia.
- Admin inativo não gerencia.
- Aluno/responsável/professor respeitam escopo.
