# Plano de implementação do cadastro real de usuários

## Fase 0 — Estado atual

O fluxo atual é visual. O botão de envio permanece desabilitado e nenhum usuário é criado.

## Fase 1 — Banco e RLS

Antes de ativar cadastro real:

- reconciliar migrations;
- criar baseline controlado;
- endurecer RLS com `membership.active is true`;
- validar policies em staging, se possível.

## Fase 2 — Convites

Criar tabela de convites e Edge Functions:

- `create-school-user-invite`
- `accept-school-user-invite`
- `resend-invite`
- `revoke-invite`

O token deve ser armazenado como hash, com expiração e status.

## Fase 3 — Tipos reais

### Aluno

Hoje requer Auth/profile. `students.profile_id` é obrigatório. RA é gerado por trigger e protegido por unique de instituição + matrícula.

### Professor

Precisa de profile, membership `TEACHER` e, opcionalmente, vínculo em `subject_offerings`.

### Responsável

Precisa de profile, membership `GUARDIAN` e vínculo em `guardianships`.

### Diretor

O enum atual permite `DIRECTOR`, mas criação real precisa de Edge Function segura.

### Secretaria e admin escolar

Continuam planejados até migration própria.

## Fase 4 — Roles planejadas

Ativar `SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` apenas após alteração estrutural de roles e RLS.
