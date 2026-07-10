# 004 — Convites e fluxo de senha

Status: draft/documentação. Não executar diretamente.

## Objetivo

Planejar tabela e fluxo real de convite/cadastro.

## Tabela conceitual

`school_user_invites` ou equivalente:

- `id`
- `institution_id`
- `email`
- `role`
- `status`
- `token_hash`
- `expires_at`
- `created_by`
- `accepted_at`
- `revoked_at`
- `target_profile_id`
- `metadata`
- `created_at`
- `updated_at`

## Status esperados

- pending
- accepted
- revoked
- expired

## Edge Functions futuras

- `create-school-user-invite`
- `accept-school-user-invite`
- `resend-invite`
- `revoke-invite`

## Dependências

- Reconciliação do banco.
- Hardening de RLS.
- Fluxo Auth seguro.
- APP_URL/secrets corretos.
- Teste em staging.

## Riscos

- Convite duplicado.
- Token em texto puro.
- Usuário aceitando convite de instituição errada.
- Role planejada sendo ativada antes da migration.
