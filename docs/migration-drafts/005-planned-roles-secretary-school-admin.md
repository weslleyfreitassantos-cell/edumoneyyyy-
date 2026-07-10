# 005 — Roles planejadas: secretaria e administração escolar

Status: draft/documentação. Não executar diretamente.

## Estado atual

O enum remoto `user_role` contém apenas:

- ADMIN
- DIRECTOR
- TEACHER
- STUDENT
- GUARDIAN

## Roles planejadas

- SUPER_ADMIN
- SCHOOL_ADMIN
- SECRETARY

## Proposta futura

Separar papel global e papel escolar:

- `profiles.platform_role`: `SUPER_ADMIN` ou `USER`
- `memberships.role`: `SCHOOL_ADMIN`, `DIRECTOR`, `SECRETARY`, `TEACHER`, `STUDENT`, `GUARDIAN`

## Impactos

- Frontend de permissões.
- ProtectedRoute.
- RLS.
- Edge Functions.
- Convites.
- Documentação.
- Migração de dados existentes.

## Recomendação

Não ativar essas roles no banco antes de reconciliar migrations e validar o impacto em RLS e Edge Functions.
