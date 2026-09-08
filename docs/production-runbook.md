# Runbook de produção

## Estado inicial (28 jul 2026)

- **Branch:** `main` (`66cf106`)
- **Working tree:** limpo
- **Supabase migrations:** 30 local = 30 remote (1:1)
- **Edge Functions:** 9 ativas (verify_jwt = true)
- **Cloudflare:** Workers Builds passando (CI)

---

## 1. Backup de banco

### Automático (plano Pro)

| Item | Status |
|------|--------|
| Backup automático diário | Disponível no plano Pro |
| Retenção | 7 dias (plano Pro) |
| Point-in-Time Recovery | Disponível (30 dias retenção de WAL) |
| Frequência de PITR | Contínuo (WAL archiving) |

### Antes de migrations críticas

```bash
# 1. Export manual do schema completo
npx supabase db dump --linked --file ./backups/pre-migration-$(date +%Y%m%d_%H%M%S).sql

# 2. Export somente dados (opcional, tabelas específicas)
npx supabase db dump --linked --data-only --file ./backups/pre-migration-data-$(date +%Y%m%d_%H%M%S).sql

# 3. Verificar arquivo gerado
wc -l ./backups/pre-migration-*.sql
```

### Restauração em projeto separado

```bash
# 1. Criar projeto temporário no Supabase Dashboard
# 2. Vincular localmente
npx supabase link --project-ref <novo-project-ref>

# 3. Aplicar dump
npx supabase db push

# 4. Verificar dados
npx supabase db dump --linked | head -50
```

### Teste periódico de restore

Recomendado: executar restore para projeto staging a cada 30 dias.

---

## 2. Migrations

### Regras

- **Nunca editar migration já aplicada** — criar nova migration corretiva
- **Sempre dry-run antes de db push**
- **Manter local = remote** — verificar com `supabase migration list --linked`
- **Rollback via migration corretiva**, não apagando histórico

### Dry-run

```bash
npx supabase db push --dry-run
```

### Aplicar nova migration

```bash
# Criar migration
npx supabase migration new descricao_da_mudanca

# Editar o arquivo .sql gerado em supabase/migrations/

# Dry-run
npx supabase db push --dry-run

# Aplicar
npx supabase db push --linked
```

### Rollback (corretivo)

```bash
# 1. Criar migration reversa
npx supabase migration new rollback_<feature>

# 2. Escrever SQL reverso (ex: DROP TABLE, DROP POLICY, re-criar versão anterior)
# 3. Dry-run
npx supabase db push --dry-run

# 4. Aplicar
npx supabase db push --linked
```

### Verificar consistência

```bash
npx supabase migration list --linked
# Todas as linhas devem mostrar local=remote com mesmo timestamp
```

---

## 3. Frontend (Cloudflare)

### Deploy

```bash
npx wrangler deploy
```

### Rollback

```bash
# Listar deployments
npx wrangler deployments list

# Rolar para versão específica
npx wrangler rollback --version-id <id>
```

### Identificar versão atual

O deployment atual é exibido em:
- CI pipeline (GitHub Actions → Workers Builds)
- `npx wrangler deployments list`
- Hash do commit no Workers Dashboard

---

## 4. Edge Functions

### Listar funções implantadas

```bash
npx supabase functions list --project-ref jrdmrhsqqclnrouoednn
```

### Redeploy de versão anterior

```bash
# 1. Identificar SHA256 do deployment desejado
# 2. Fazer checkout do commit correspondente
git checkout <commit-hash> -- supabase/functions/<function-name>/

# 3. Deploy da função específica
npx supabase functions deploy <function-name> --project-ref jrdmrhsqqclnrouoednn

# 4. Voltar ao branch original
git switch main
```

### Variáveis de ambiente

```bash
# Listar secrets
npx supabase secrets list --project-ref jrdmrhsqqclnrouoednn

# Atualizar secret
npx supabase secrets set --env SECRET_NAME=value --project-ref jrdmrhsqqclnrouoednn
```

### Logs

```bash
# Logs da função (últimas 50 linhas)
npx supabase functions logs <function-name> --project-ref jrdmrhsqqclnrouoednn
```

---

## 5. Procedimentos de emergência

### Falha de migration

```bash
# 1. Identificar a migration problemática
npx supabase migration list --linked

# 2. Criar migration corretiva
npx supabase migration new hotfix_<descricao>

# 3. Aplicar
npx supabase db push --linked
```

### Dado corrompido

```bash
# 1. Identificar o ponto anterior via PITR
# 2. Criar projeto separado no Supabase Dashboard
# 3. Restaurar para o ponto desejado via PITR
# 4. Exportar dados específicos
# 5. Importar no projeto principal
```

### Edge Function com erro

```bash
# 1. Ver logs
npx supabase functions logs <function-name> --project-ref jrdmrhsqqclnrouoednn

# 2. Redeploy de versão estável anterior
npx supabase functions deploy <function-name> --project-ref jrdmrhsqqclnrouoednn
```

### Rollback completo

```bash
# 1. Frontend: wrangler rollback
# 2. Edge Functions: redeploy individual de cada função
# 3. Banco: migration corretiva (ou PITR em último caso)
# 4. Validar smoke tests manuais
```

---

## 6. Auth Configuration

### Regra fundamental

**PROIBIDO** executar `supabase config push` diretamente no projeto de produção para alterar apenas um campo de Auth.

`supabase config push` substitui **todo** o auth config remoto de uma vez, sobrescrevendo configurações que não estão no escopo da alteração desejada (email confirmation, MFA, OTP, rate limits, templates, etc.).

### Processo obrigatório para mudanças de Auth

1. **Fazer manualmente no Dashboard** — https://supabase.com/dashboard/project/jrdmrhsqqclnrouoednn/auth/settings
2. **Capturar o valor anterior** antes de alterar
3. **Alterar apenas o campo necessário** — não modificar outros campos
4. **Validar imediatamente** após salvar (via API pública `auth/v1/settings` ou teste funcional)
5. **Manter cópia segura** da configuração remota anterior

### Exceções

`supabase config push` pode ser usado em projetos **locais ou staging**, nunca em produção.

---

## 7. Incidentes

### 7.1. Push acidental de Auth config (28 jul 2026)

**Comando executado:**
```bash
npx supabase config push jrdmrhsqqclnrouoednn
```

**Objetivo:** diagnóstico (sem intenção de alterar).

**Campos sobrescritos involuntariamente:**

| Campo | Valor original (remoto) | Valor sobrescrito (local) |
|-------|------------------------|--------------------------|
| `site_url` | `https://edumoneyyyy.weslleyfreitassantos.workers.dev` | `http://127.0.0.1:3000` |
| `additional_redirect_urls` | 7 URLs (produção + localhost) | `["https://127.0.0.1:3000"]` |
| `enable_confirmations` | `true` | `false` |
| `[mfa.totp] enroll_enabled` | `true` | `false` |
| `[mfa.totp] verify_enabled` | `true` | `false` |
| `otp_length` | `8` | `6` |
| `max_frequency` | `"1m0s"` | `"1s"` |

**Detecção:** imediata (diff do próprio push exibiu as alterações).

**Ação corretiva:** segundo push com `config.toml` corrigido, restaurando valores originais + alterações autorizadas (signup desabilitado, password length 8).

**Validação realizada:**
- ✅ `auth/v1/settings` retorna `disable_signup: true`
- ✅ Tentativa de signup rejeitada com `422 signup_disabled`
- ✅ Push diff confirma restore de site_url, redirects, email confirm, MFA TOTP, OTP length, max frequency

**Horário do incidente:** 28 jul 2026, ~19:45 BRT (início), ~19:50 BRT (correção).

**Nenhum usuário foi criado ou afetado.** O signup público foi desabilitado antes de qualquer tentativa externa.

**Regra preventiva:** `supabase config push` está PROIBIDO em produção. Auth config deve ser alterada exclusivamente via Dashboard (seção 6).
