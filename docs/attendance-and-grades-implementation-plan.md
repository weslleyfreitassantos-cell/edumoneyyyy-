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
```

## Fechamento Acadêmico e Boletins

- **Migration**: `20260712000300_term_closing_report_cards.sql` criada localmente. Ainda não aplicada no Supabase (nenhuma operação remota executada).
- **Entidades**: `academic_policies`, `term_closures` e `student_term_results`.
- **Regras de cálculo**:
  - `calculateTermGradePercentage`: Média ponderada com arredondamento configurável (0-4 casas).
  - `calculateTermAttendancePercentage`: Média de presença e faltas.
  - O resultado baseia-se na política ativa (`minimum_grade_percentage`, `minimum_attendance_percentage`).
- **Status**:
  - Fechamento: `OPEN`, `SUBMITTED`, `CLOSED`, `REOPENED`.
  - Resultado Escolar: `PENDING`, `APPROVED`, `FAILED_BY_GRADE`, `FAILED_BY_ATTENDANCE`, `FAILED_BY_GRADE_AND_ATTENDANCE`.
- **Matriz de acesso**:
  - **Professor**: submete fechamento das próprias ofertas; visualiza prévias e pendências; não tem acesso à edição das políticas.
  - **Secretário**: apenas visualiza o fechamento consolidado.
  - **Diretor / Admin**: aprovam fechamento (de submetido para fechado); editam políticas; podem reabrir períodos.
  - **Aluno**: apenas visualiza o próprio boletim.
  - **Responsável**: apenas visualiza os boletins dos estudantes vinculados ativamente.
- **Fluxos**:
  - **Submit (Professor)**: Verifica notas pendentes e política. Transição para `SUBMITTED`.
  - **Fechamento (Admin/Diretor)**: Executado através do painel na Instituição, consolida snapshots e calcula os `student_term_results`. Transição para `CLOSED`. (Snapshot não sobrescreve retroativamente sem reabertura formal).
  - **Reabertura (Admin/Diretor)**: Volta para `REOPENED`. Exige motivo justificado obrigatório, armazenado no histórico, e invalida o snapshot para recálculo.
- **Limitações**:
  - Não abrange recuperação final.
  - Não gera emissão em PDF e não gera cobrança.
  - A consulta dos pais carrega estudantes em lote para não causar N+1, otimizada localmente.
- Nenhuma operação remota (Supabase cloud) foi executada durante o desenvolvimento destas funcionalidades.
