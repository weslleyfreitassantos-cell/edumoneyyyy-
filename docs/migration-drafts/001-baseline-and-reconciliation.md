# 001 — Baseline e reconciliação

Status: draft/documentação. Não executar diretamente.

## Contexto

A auditoria manual confirmou que `supabase_migrations.schema_migrations` não existe no remoto, embora existam schemas/tabelas do domínio escolar.

## Objetivo

Definir uma estratégia segura para reconciliar o banco remoto com as migrations locais.

## Riscos

- `db push` pode tentar aplicar migrations que parcialmente já existem.
- `migration repair` sem comparação pode registrar histórico incorreto.
- `db reset` não deve ser usado em banco remoto com dados reais.

## Alternativas

### Baseline remoto documentado

Registrar o estado atual do remoto como ponto de partida e criar migrations incrementais apenas para o que falta.

### Repair controlado

Só considerar depois de comparar cada migration local com o estado remoto.

### Staging

Criar ambiente de teste para validar o caminho antes do remoto principal.

## Checklist antes de aplicar qualquer escrita

- Confirmar backup/export do banco.
- Confirmar tabelas existentes.
- Confirmar policies.
- Confirmar funções.
- Confirmar dados críticos.
- Testar plano em staging.

## Validação pós-aplicação

- Conferir schema.
- Conferir RLS.
- Conferir policies.
- Rodar testes do app.
- Validar cadastro, leitura e dashboards.

## Rollback conceitual

Manter backup/export e plano manual de reversão para cada alteração incremental.
