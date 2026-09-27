# Reconciliacao da documentacao

**Revisado:** 2026-09-25. Para implementar comportamento, usar migrations e
codigo atuais; para producao, usar apenas inventario privilegiado atual. Um
documento antigo nao e prova de estado remoto.

| Documento | Classificacao | Motivo / uso atual |
|---|---|---|
| `database-final-diagnosis.md` | `HISTORICAL / SUPERSEDED` | snapshot SQL manual anterior; nao e a fotografia da VPS atual. |
| `database-readonly-audit.md` | `HISTORICAL / SUPERSEDED` | auditoria remota anterior, sem revalidacao nesta campanha. |
| `migration-reconciliation-plan.md` | `HISTORICAL / SUPERSEDED` | plano baseado em historia remota anterior; nao executar os comandos sugeridos. |
| `database-baseline-reconciliation-runbook.md` | `HISTORICAL / SUPERSEDED` | precede o stack self-hosted atual e os gates de backup/restore. |
| `database-migration-reconciliation.md` | `HISTORICAL` | causa raiz de uma duplicidade de migrations passada, nao status presente. |
| `database-schema-reconciliation-matrix.md` | `HISTORICAL / PARTIALLY VALID` | inventario/candidato a reconciliacao anterior, precisa nova leitura antes de uso. |
| `mvp-readiness-assessment.md` | `SUPERSEDED` | estimativas de 2026-09-06, anteriores ao baseline. |
| `release-readiness-checklist.md` | `HISTORICAL / SUPERSEDED` | checklist antigo; checkboxes nao significam gate atual aprovado. |
| `real-user-invite-implementation-plan.md` | `SUPERSEDED AS A PLAN` | funcoes de convite existem no codigo atual; envio e fluxo remoto seguem nao qualificados. |
| `staging-readiness-checklist.md` | `HISTORICAL / PARTIALLY VALID` | checklist generico; existencia de staging dedicado nao foi comprovada. |
| `staging-database-validation-checklist.md` | `PARTIALLY VALID` | passos locais continuam referenciais; nenhum staging remoto foi confirmado. |
| `production-runbook.md` | `HISTORICAL / SUPERSEDED` | o proprio documento identifica Supabase Cloud antigo; proibido usar para VPS. |
| `admin-flow-homologation.md` | `PARTIALLY VALID / HISTORICAL` | rodada local especifica, sem evidencia de runtime atual na VPS. |
| `roles-permissions-matrix.md` | `SUPERSEDED` | afirma que SECRETARY nao esta no enum remoto; diverge das migrations atuais. |
| `roles-matrix.md` | `SUPERSEDED` | modela SECRETARY/SUPER_ADMIN como futuros, contra o codigo/migrations atuais. |
| `roles-and-permissions.md` | `PARTIALLY VALID / HISTORICAL` | contexto conceitual util, nao fonte normativa das permissoes atuais. |
| `password-recovery.md` | `PARTIALLY VALID` | rotas/codigo permanecem uteis; email/redirect/token nao foram testados em producao. |
| `pilot-smoke-checklist.md` | `PARTIALLY VALID` | checklist de planejamento, sem execucao remota comprovada. |
| `supabase-readonly-audit.sql` | `PARTIALLY VALID` | SQL precisa ser revisado contra schema/roles remotos antes da execucao manual. |

Fonte canonica versionada: `docs/CURRENT_STATE.md`. Fotografia read-only do que
foi possivel ver agora: `docs/production/current-production-state.md`.
