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
