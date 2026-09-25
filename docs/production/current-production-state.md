# Fotografia da producao self-hosted

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
