# Plano de reconciliacao das migrations

## Estado remoto confirmado

A auditoria manual read-only confirmou que
`supabase_migrations.schema_migrations` esta ausente/null no remoto. Existem
tabelas internas de `auth`, `storage` e `realtime`, mas nao ha historico
Supabase CLI confirmado na tabela esperada.

O remoto tem o nucleo academico principal, mas ainda nao tem `assessments`,
`grades`, `attendance_sessions` e `attendance_records`. O enum remoto
`public.user_role` contem somente `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT` e
`GUARDIAN`.

## Por que nao rodar db push agora

O banco remoto pode ter objetos criados antes da baseline local. Sem confirmar o
historico remoto de migrations, um push pode tentar reaplicar tabelas, enums,
policies ou indexes existentes.

Como o remoto nao possui `supabase_migrations.schema_migrations` confirmado,
`db push` direto e especialmente arriscado: ele pode tratar migrations locais
como pendentes mesmo quando parte dos objetos ja existe por outro caminho.

## Por que nao rodar migration repair sem auditoria

Repair registra historico. Se for usado antes de inventariar o remoto, ele pode
marcar como aplicada uma migration que nao corresponde ao estado real do banco.

## Por que nao rodar db reset em remoto

Reset recria o banco a partir do historico local e pode apagar dados. Isso nao e
aceitavel para ambiente remoto com dados reais ou de homologacao.

## Comparar remoto versus migrations locais

1. Usar o resultado ja coletado da auditoria read-only no SQL Editor.
2. Exportar resultados de tabelas, colunas, enums, FKs, indexes, RLS e policies
   sem dados sensiveis.
3. Comparar com:
   - `20260709000100_baseline_schema.sql`
   - `20260710000200_attendance_and_grades.sql`
   - `20260710000300_attendance_and_grades_rls.sql`
   - `20260710000400_attendance_and_grades_integrity.sql`
4. Registrar divergencias em documento externo.

## Identificar migrations ja aplicadas manualmente

- Procurar objetos iguais aos das migrations locais.
- Conferir nomes de constraints e indexes.
- Conferir funcoes, triggers e policies quando existirem.
- Comparar defaults, nullability e tipos.
- Confirmar se o schema `supabase_migrations` existe no remoto.

## Estrategias possiveis

### Baseline remoto

Usar quando o remoto ja representa o estado verdadeiro e precisa ser adotado
como base futura. Exige dump, revisao e uma migration baseline coerente.

### Repair controlado

Usar somente quando ha prova de que determinada migration local ja esta
equivalente no remoto. Exige checklist e aprovacao explicita.

### Nova migration incremental

Usar quando o remoto esta reconciliado e a mudanca futura e pequena, testada e
aplicavel por ambiente.

Um primeiro candidato documental para hardening de RLS esta em
[`migration-candidates/001-rls-active-membership-hardening.md`](migration-candidates/001-rls-active-membership-hardening.md),
com SQL revisavel em
[`migration-candidates/001-rls-active-membership-hardening.sql`](migration-candidates/001-rls-active-membership-hardening.sql).
Ele nao esta em `supabase/migrations` e nao deve ser aplicado antes da
reconciliacao, baseline e validacao em staging.

### Ambiente staging

Obrigatorio antes de ativar convites reais, novos roles ou escritas sensiveis.
Staging deve receber restauracao ou replica segura do estado esperado.

## Criterios antes de qualquer escrita

- Backup externo confirmado.
- Auditoria read-only revisada.
- Historico de migrations entendido.
- Plano de rollback documentado.
- Staging validado.
- RLS e policies revisadas.
- Edge Functions testadas com usuarios de teste.
- Secrets e redirects revisados.

## Checklist obrigatorio

- [ ] Confirmar schema de migrations remoto.
- [ ] Confirmar objetos publicos esperados.
- [ ] Confirmar policies por tabela.
- [ ] Confirmar roles atuais e futuros.
- [ ] Confirmar dados existentes e duplicidades.
- [ ] Confirmar que `profiles.role` e `memberships.role` estao coerentes.
- [ ] Confirmar que nenhuma migration local conflita com o remoto.
- [ ] Preparar rollback conceitual.

## Ordem recomendada de futuras migrations

1. `platform_role` em `profiles`, se necessario.
2. Novos roles escolares em `memberships.role`.
3. Aluno sem login opcional, se desejado.
4. Tabelas/colunas para convites.
5. Auditoria/logs de convites.
6. Ajustes de RLS e policies, incluindo `membership.active is true`.
7. Indexes e constraints de integridade.

## Rollback conceitual

- Evitar migracoes irreversiveis.
- Separar mudancas de schema, backfill e ativacao de UI.
- Manter flags/estado visual desabilitado ate validacao final.
- Ter backup e caminho de restauracao antes de escrita remota.

## Validacao pos-migration

- Reexecutar auditoria read-only.
- Rodar testes frontend.
- Validar Edge Functions em staging.
- Testar isolamento entre instituicoes.
- Confirmar que alunos sem login so foram liberados se houver migration
  especifica para `students.profile_id` ou modelo equivalente.
- Confirmar logs de convite e falhas.
- Confirmar que roles futuras nao vazam para usuarios indevidos.

## Consolidação pós-auditoria manual

Como `supabase_migrations.schema_migrations` não existe no remoto, `db push`, `migration repair` e `db reset` continuam bloqueados.

A estratégia recomendada é registrar o baseline remoto, comparar migrations locais com o schema real, validar em staging e aplicar apenas migrations incrementais controladas.
