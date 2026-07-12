# Plano de implementação de frequência, avaliações e notas

## Estado confirmado do schema remoto

O banco remoto foi verificado manualmente.

As seguintes tabelas existem no schema `public`:

- `attendance_sessions`;
- `attendance_records`;
- `assessments`;
- `grades`.

A migration de frequência também foi confirmada no histórico remoto:

- `20260712000100_attendance_end_to_end_access.sql`.

Antes da criação da branch de avaliações e notas, o comando:

```bash
npx supabase db push --dry-run
