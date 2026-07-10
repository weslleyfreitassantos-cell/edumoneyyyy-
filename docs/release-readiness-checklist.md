# Release readiness checklist

Legenda:

- [x] concluido
- [ ] pendente
- [!] bloqueado por auditoria de banco

## 1. Frontend

- [x] Dashboards com dados reais implementados parcialmente conforme codigo.
- [x] Aba `Usuarios da Escola` somente leitura.
- [x] Cadastro unificado visual implementado.
- [ ] Revisao UX final da aba `Usuarios da Escola`.
- [ ] Tratamento de estados vazios em todos os fluxos principais.

## 2. Autenticacao

- [x] Login com Supabase Auth.
- [x] Fluxo de definicao de senha existente.
- [!] Aluno sem login nao e suportado pelo remoto atual:
  `students.profile_id` e obrigatorio e `profiles.id` depende de
  `auth.users.id`.
- [!] SMTP, redirects e `APP_URL` precisam de confirmacao antes de convites
  reais.
- [!] Fluxo unificado de convite real bloqueado por reconciliacao de migrations.

## 3. Multi-instituicao

- [x] `InstitutionContext`.
- [x] `InstitutionSwitcher`.
- [x] Persistencia local da instituicao ativa.
- [x] `currentInstitution`, `currentMembership` e `currentRole`.
- [ ] Homologacao manual com usuarios em duas instituicoes.

## 4. Roles e permissoes

- [x] Helpers de role efetiva.
- [x] `memberships.role`/`currentRole` priorizado em telas contextuais seguras.
- [x] `profile.role` como fallback temporario.
- [x] Auditoria manual confirmou enum remoto apenas com `ADMIN`, `DIRECTOR`,
  `TEACHER`, `STUDENT` e `GUARDIAN`.
- [ ] Refatoracao futura de `ProtectedRoute`, se segura.
- [!] `SECRETARY` e `SCHOOL_ADMIN` bloqueados por auditoria/migrations.

## 5. Usuarios da escola

- [x] Listagem por `memberships` + `profiles`.
- [x] Filtros e resumo.
- [x] Papeis planejados aparecem como referencia.
- [x] Botao de novo usuario continua sem envio real.
- [x] Previa visual do cadastro unificado.

## 6. Cadastro/convite real

- [x] UX visual preparada.
- [!] Escrita real bloqueada.
- [!] Convite real bloqueado.
- [!] Novas Edge Functions bloqueadas.
- [!] Tabelas de convite/logs ainda precisam de plano de migration.

## 7. Banco de dados

- [x] Migrations locais versionadas.
- [!] `supabase_migrations.schema_migrations` ausente/null no remoto.
- [x] Auditoria read-only remota executada manualmente.
- [!] `assessments`, `grades`, `attendance_sessions` e
  `attendance_records` ausentes no remoto.
- [!] Backup externo pendente antes de qualquer escrita.

## 8. RLS e policies

- [x] RLS ativo nas tabelas publicas auditadas, com `force_rls = false`.
- [!] Policies/funcoes precisam de hardening para `membership.active is true`.
- [x] Migrations locais de RLS para notas/frequencia existem.
- [!] Isolamento entre instituicoes precisa de teste remoto.

## 9. Edge Functions

- [x] `create-student` existente.
- [x] `create-teacher` existente.
- [x] `create-guardian` existente.
- [ ] CI dedicado de Deno.
- [!] Funcoes futuras de convite bloqueadas por auditoria e staging.

## 10. Seguranca

- [x] `service_role` permanece fora do frontend.
- [x] `src/lib/supabaseClient.ts` nao foi alterado nesta entrega.
- [x] `.env` nao foi alterado nesta entrega.
- [!] Revisao de secrets e redirects pendente.
- [!] Auditoria de permissao por role pendente em banco remoto.

## 11. Testes

- [x] Testes frontend existentes.
- [x] Testes de role efetiva.
- [x] Testes do cadastro unificado visual.
- [ ] Testes e2e.
- [ ] Testes de autorizacao em staging.

## 12. Deploy

- [ ] Plano de deploy frontend.
- [ ] Ambiente staging.
- [!] Deploy de Edge Functions futuras bloqueado.
- [!] Qualquer deploy com escrita real depende de auditoria de banco.

## 13. Observabilidade/logs

- [ ] Logs de convites.
- [ ] Logs de falhas em Edge Functions.
- [ ] Trilhas de auditoria por usuario/instituicao.
- [ ] Monitoramento de erros frontend.

## 14. Dados iniciais

- [!] Onboarding do primeiro administrador precisa de fluxo seguro.
- [!] Criacao de escola por `SUPER_ADMIN` ainda planejada.
- [ ] Massa de homologacao multi-instituicao.

## 15. Go-live

- [x] Auditoria read-only do banco concluida.
- [!] Reconciliacao de migrations concluida.
- [!] Staging aprovado.
- [ ] Plano de rollback.
- [ ] Checklist final assinado.

## Consolidação pós-auditoria manual

- [x] Auditoria read-only manual realizada.
- [x] Núcleo escolar remoto confirmado.
- [x] RLS ativo nas tabelas públicas auditadas.
- [!] Histórico Supabase CLI remoto ausente em `supabase_migrations.schema_migrations`.
- [!] Notas e frequência ausentes no remoto.
- [!] Cadastro real bloqueado até reconciliação e hardening.
- [!] `SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` permanecem planejados.
