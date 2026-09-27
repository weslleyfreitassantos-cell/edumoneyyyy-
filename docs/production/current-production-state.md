# Fotografia da producao self-hosted

## Estado atual — 2026-09-27

Este checkpoint substitui os estados antigos de SSH desconhecido, Realtime 503,
paridade remota desconhecida e restore bloqueado registrados abaixo. As secoes
posteriores foram preservadas como historico, nao como estado vigente.

```text
SITE=https://tecescola.grupotec.dev.br
VPS_HOST=189.126.111.49
SSH_ACCESS=PASS
VPS_TOPOLOGY=CONFIRMED
FRONTEND=HTTP_200
AUTH=HTTP_200
REST_RESOURCE_REQUESTS=HTTP_200
STORAGE=HTTP_200
REALTIME=WEBSOCKET_101
REST_OPENAPI_ROOT=403_NON_BLOCKING
POSTGRES=HEALTHY_17.6
LOCAL_MIGRATIONS=121
REMOTE_MIGRATIONS=121
MIGRATION_PARITY=PASS
POSTGRES_BACKUP_VERIFY=PASS
POSTGRES_RESTORE_TEST=PASS
RESTORED_PUBLIC_TABLES=82
RESTORED_RLS_POLICIES=180
RESTORED_RLS_TABLES=104
STORAGE_OBJECTS=40
STORAGE_RESTORE_TEST=PASS
PRODUCTION_CONTAINERS_TOUCHED=NO
BUSINESS_DATA_WRITES=NONE
DEPLOYS=NONE
```

O backup qualificado teve SHA-256
`ed1aa753baf15a388d3d69e02b5adde6028c278f7eabf91da9c91b43a9262893`.
O restore aconteceu em container, volume e rede descartaveis, usando a imagem
PostgreSQL 17.6 fixada por digest e publicacao somente em loopback; todos os
recursos temporarios foram removidos. O teste de Storage validou 40 objetos em
copia temporaria e removeu o destino de teste.

### Persistencia do alias Realtime

O Envoy em execucao monta
`/srv/grupotec/supabase-projects/edumoney/volumes/api/envoy/cds.yaml`, que ja
usa `address: realtime`. O diretorio do projeto Compose e uma arvore operacional
sem Git. O template em
`/srv/grupotec/supabase-upstream/docker/volumes/api/envoy/cds.yaml` pertence ao
checkout limpo e detached do repositorio oficial `supabase/supabase` em
`8c7a4d9dbbaf8b552893822e89d7bf06f33f9220`; esse template ainda usa
`realtime-dev.supabase-realtime`.

A PR #224 versiona
`ops/production/apply-realtime-envoy-alias.sh`, aplicador idempotente e
restrito a uma unica linha, com backup fora do checkout em diretorio privado
(por padrao `/var/backups/tecescola-envoy`) e modo `--check`. Seu teste de
fixture passou, e o modo de verificacao confirmou os estados do template e do
arquivo montado sem modifica-los. Portanto a correcao tem mecanismo
de persistencia versionado (`REALTIME_FIX_PERSISTENT=YES_VIA_VERSIONED_APPLIER`),
mas a aplicacao ao template deve ser feita antes de sincronizar/recriar a stack
em qualquer futuro redeploy. Nenhum servico foi reiniciado nesta campanha.

### Email e prontidao do piloto

```text
SMTP_PROVIDER=RESEND
SMTP_CONNECTIVITY=PASS
AUTHORIZED_QA_MAILBOX=NONE_FOUND
EMAIL_DELIVERY=BLOCKED_NO_AUTHORIZED_TEST_MAILBOX
INVITE_DELIVERY=BLOCKED_NO_AUTHORIZED_TEST_MAILBOX
PASSWORD_RECOVERY=BLOCKED_NO_AUTHORIZED_TEST_MAILBOX
PILOT_TENANT=NONE
PILOT_IDENTITIES=NONE
PRODUCTION_AUTOMATED_SMOKE=BLOCKED_NO_DEDICATED_TEST_IDENTITIES
PRODUCTION_FUNCTIONAL_SMOKE=BLOCKED_NO_PILOT_TENANT_IDENTITIES
PRODUCTION_CROSS_TENANT=PASS_FOCUSED
PILOT_READINESS=BLOCKED_EXTERNAL_TEST_IDENTITY_PROVISIONING
```

SMTP TCP na porta 465 nao foi tratado como prova de entrega. Nenhum e-mail foi
enviado, nenhuma conta de cliente foi usada, e nao houve login de teste em
producao. O smoke de cross-tenant previamente aprovado cobre frequencia/RLS;
nao substitui o fluxo autenticado completo do tenant piloto. O proximo passo de
homologacao depende de provisionamento humano de mailbox, tenant e identidades
nao-cliente explicitamente seguros.

**Campanha encerrada sem merge da PR #224.** Os gates de infraestrutura, banco e
disaster recovery estao verdes; a prontidao de piloto permanece bloqueada pelos
pre-requisitos de identidade e entrega de email acima.

---

## Checkpoints historicos

Os registros seguintes documentam observacoes feitas em 2026-09-25 e
2026-09-26. Seus estados foram superados pelo checkpoint atual acima.

**Data:** 2026-09-25
**Status:** `PARTIAL / PRIVILEGED AUDIT BLOCKED`
**Site:** `https://tecescola.grupotec.dev.br`
**Supabase API:** `https://api-edu-vps.grupotec.dev.br`

## Leituras publicas executadas

As leituras foram GET somente. A chave publica anon/publishable foi mantida
somente em memoria do processo e nunca escrita em arquivo ou impressa.

| Probe | Resultado |
|---|---|
| Frontend `/` | HTTP 200 |
| Auth `/auth/v1/health` com chave publica | HTTP 200 |
| PostgREST `institutions?select=id&limit=0` com chave publica | HTTP 200; zero linhas visiveis ao papel anon, sem retornar dados |
| Storage `/storage/v1/bucket` com chave publica | HTTP 200; resposta vazia para anon, nao prova que nao existam buckets privados |
| Realtime `/realtime/v1/api/ping` com chave publica | **HTTP 503** |
| REST OpenAPI root `/rest/v1/` | HTTP 403; a rota de tabela acima confirma que o PostgREST responde |

O caminho correto do ping do Realtime foi conferido no smoke oficial do
Supabase self-hosted. O 503 foi repetido nesse endpoint; requer investigacao no
container/proxy da VPS por operador com acesso.

O script `npm run health:prod` repete esses probes sem exibir chave ou corpo de
resposta. Nesta captura, frontend/Auth/REST/Storage responderam 200 e Realtime
retornou 503; portanto o health global terminou `FAIL`, nao `PASS`. O endpoint
REST retornou zero linhas visiveis a `anon`, o que nao permite inferir se a
base esta vazia nem se existem contas de qualquer papel.

## O que NAO foi observado

Nao foi feita conexao SQL privilegiada nem SSH: nao ha `PG*`, `SUPABASE_*`,
`VPS_*` ou `SSH_*` configurado no ambiente; nao ha usuario SSH documentado nem
config em `~/.ssh/config`. Existe uma chave local nomeada para VPS e uma entrada
de host conhecido correspondente ao endpoint, mas isso nao determina o usuario,
permissoes ou autorizacao de uso. Nenhuma chave privada foi lida ou exibida.

Por isso permanecem desconhecidos: versao PostgreSQL em producao; schemas,
extensoes, enums, tabelas, colunas, constraints, FKs, indices, triggers,
functions, policies/RLS, roles, historico CLI de migrations, configuracao Auth,
buckets privados/objetos, estado de Edge Functions, containers, proxy, disco e
backup existente. Nao inferir esses fatos de auditorias remotas antigas.

## Comparacao com o estado versionado

O baseline local `e550ad5` contem 121 migrations SQL timestamped e foi
reconstruido/testado em Supabase local. Sem metadados SQL privilegiados atuais,
nao e possivel classificar objetos da VPS como `EXPECTED`, `MISSING`, `EXTRA`,
`DRIFT`, `LEGACY` ou `DANGEROUS`. Reconciliacao: `BLOCKED`, sem qualquer
`db push`, `migration repair` ou SQL remoto.

## Acesso necessario para fechar o gate

O operador da VPS deve fornecer/confirmar por canal seguro:

1. hostname e usuario SSH autorizados, fingerprint esperado e escopo read-only;
2. modo de acesso Postgres read-only para inventario; para backup, uma conta com
   `pg_dump` e `pg_dumpall --globals-only`, sem capacidade de escrita;
3. local de backup criptografado e recipient `age`, chave de decrypt guardada
   fora da VPS;
4. existencia/identidade de tenant de piloto e contas de cada role;
5. diagnostico do Realtime 503 e configuracao real do SMTP.

Nenhuma tentativa de login foi feita com contas de escolas/clientes. Login
atualiza estado de Auth e nao foi autorizado como teste sem tenant/usuarios de
piloto identificados.

## Revalidacao externa em 2026-09-25

Em `2026-09-25T20:49:05.778Z`, o health script executou GETs com a chave
publishable obtida somente em memoria do bundle publico do frontend. A chave
nao foi impressa nem persistida. Frontend, Auth, REST e Storage responderam
200; Realtime respondeu 503 em 120 ms. O ping sem chave respondeu 401, portanto
nao foi usado como evidencia de health. Uma leitura adicional do ping com a
chave em `20:48:25Z` recebeu 503 em 197 ms e os headers permitidos mostraram
`via: 1.1 Caddy`; nao foi possivel determinar se Caddy ou o upstream originou
o 503 sem inspecao autorizada da VPS.

Busca estatica por `supabase.channel`, `postgres_changes`, presence e broadcast
nao encontrou uso direto de subscriptions na fonte da aplicacao; referencias
restantes eram dependencias em lockfiles. Isso nao remove o requisito de
corrigir ou formalmente desativar o componente Realtime da infraestrutura.

O inventario Docker local, feito apenas em leitura, mostrou um container
protegido da campanha paralela OmniHub ativo (aprox. 36 MiB/1 GiB). Nenhum
container foi criado, parado, reiniciado ou removido; networks e volumes
existentes ficaram intactos. O snapshot sanitizado fica somente no arquivo
local nao versionado `artifacts/production-closure/docker-before.json`.

Nao ha `~/.ssh/config` nem variaveis de processo configuradas para conexao SQL,
backup criptografado, SMTP ou identidades de piloto. Nenhuma conexao SSH foi
tentada. A contagem local e 121 migrations SQL; a contagem remota continua
desconhecida. Os blockers de auditoria privilegiada, backup/restore, SMTP,
piloto e causa-raiz do Realtime permanecem abertos; nao ocorreu mutacao remota.

## Revalidacao V2 — 2026-09-26 UTC

O checkpoint V2 esta detalhado em
[`infrastructure-closure-v2-2026-09-25.md`](infrastructure-closure-v2-2026-09-25.md).
Em `2026-09-26T00:29:36.360Z`, probes GET publicos com a chave publishable
mantida apenas em memoria retornaram frontend 200 (485 ms), Auth 200 (525 ms),
REST 200 (952 ms), Storage 200 (1311 ms) e Realtime 503 (963 ms). DNS publico
resolveu para site e API; os dois certificados TLS estavam autorizados. O
Realtime continuou retornando 503; o header permitido `via: 1.1 Caddy` confirma
Caddy no caminho observado, mas nao identifica quem gerou a resposta. Nenhum
body de resposta foi salvo.

O acesso autorizado a VPS e banco read-only continua indisponivel, portanto a
topologia interna, o container/imagem/health do Realtime, PostgreSQL e schema
remotos continuam desconhecidos. A contagem remota de migrations nao pode ser
comparada. Backup/restore, SMTP/Auth delivery e pilot smoke continuam bloqueados.
Nenhuma mutacao remota foi realizada.

O inventario Docker local read-only de `2026-09-25T22:39:44.805Z` encontrou
dois containers existentes: o Postgres OmniHub protegido e um container
estrangeiro/parado de identidade desconhecida. Nenhum container TecEscola foi
identificado. Nenhum recurso Docker preexistente foi alterado. O scan Gitleaks
usou apenas um container temporario isolado com auto-remocao; nenhum container
existente foi interrompido. Os snapshots V2 em `artifacts/production-closure/`
sao locais e permanecem fora do Git.
