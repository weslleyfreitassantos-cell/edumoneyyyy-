# Runbook de operacao self-hosted

**Status:** procedimento versionado; ainda nao validado contra a VPS atual.
**Limite:** nao use `supabase db push`, `migration repair`, `config push` ou SQL
de escrita remota como procedimento de deploy.

## Health

Com `SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`) em variavel de
ambiente, execute `npm run health:prod`. O script faz apenas GETs: frontend,
Auth, query REST sem linhas, Storage e ping do Realtime. Ele nao imprime a chave
nem corpos de resposta. Sem chave, a query DB fica `BLOCKED`; HTTP diferente de
200 reprova o health check. Edge Functions sem endpoint seguro de health nao
sao invocadas.

Comandos read-only na VPS, apos autenticar e confirmar que e o host correto:

```sh
date -u
uptime
free -h
df -h
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker stats --no-stream
docker inspect --format '{{.Name}} restarts={{.RestartCount}} state={{.State.Status}}' $(docker ps -q)
```

Logs devem limitar intervalo/linhas e redigir tokens, e-mails e dados de aluno.
O caminho Compose, nomes de servico e comandos de restart da VPS ainda nao foram
confirmados; nao inventar `docker compose up/down` antes de identificar o stack.

## Backup logico do Postgres

`ops/backup/backup-postgres.sh` requer `PGHOST`, `PGUSER`, `PGDATABASE`,
`PGPASSWORD`, `BACKUP_DIR` e `BACKUP_TMPDIR` por ambiente. O ultimo deve ser
tmpfs ou volume criptografado com espaco suficiente. Ele executa `pg_dump -Fc` e
`pg_dumpall --globals-only`, valida o archive com `pg_restore --list`, produz
manifesto, tamanho e SHA-256. O destino deve ficar fora do checkout e com modo
privado. Por padrao exige criptografia age (`BACKUP_AGE_RECIPIENT`); backup
sem criptografia so e permitido com opt-in explicito e volume protegido.
Exports globais podem conter hash de senha de role e devem ser tratados como
segredo.

`ops/backup/verify-postgres-backup.sh` valida SHA sidecar quando disponivel,
entradas, manifest e listagem do archive. Para backup age, configure
`AGE_IDENTITY` sem imprimir seu conteudo. Defina `RESTORE_TEST_TMPDIR` para
armazenamento local criptografado antes do restore-test; o alvo deve ser uma
instancia descartavel local, nunca um tunel para producao.

## Restore-test

Executar somente em uma instancia Supabase/Postgres descartavel local:

```sh
RESTORE_TEST_PGHOST=127.0.0.1 \
RESTORE_TEST_PGPORT=54322 \
RESTORE_TEST_PGUSER=postgres \
RESTORE_TEST_PGPASSWORD='<segredo local>' \
RESTORE_TEST_TMPDIR=/caminho/local/criptografado \
ops/restore/restore-test-postgres.sh /caminho/fora-do-repo/backup.tar.age
```

O script recusa host que nao seja loopback, cria um nome de banco aleatorio,
restaura o archive sem ownership/ACL e verifica schemas public/auth/storage,
tabelas publicas e RLS/policies. Por padrao apaga somente o banco temporario que
ele acabou de criar; `RESTORE_TEST_KEEP=true` o mantem para investigacao. Isso
nao aplica migration e nao acessa producao.

O dump do Postgres inclui metadados de Storage, nao os bytes dos objetos. Para
objetos, `ops/backup/backup-storage-rclone.sh` usa `rclone copy` (nunca `sync`)
e compara origem/destino. `ops/restore/restore-test-storage-rclone.sh` copia o
backup para uma pasta local temporaria protegida e verifica os objetos sem
escrever na origem. A restauracao final ainda exige teste em bucket/endpoint
descartavel antes de qualquer cutover.

## Retencao e protecao

Meta minima a contratar/configurar: backup diario, 7 copias diarias locais,
4 copias semanais independentes/offsite, alerta de falha e restore trimestral.
Essas rotinas e armazenamento offsite nao foram confirmados na VPS; nao afirmar
que estao ativos. Mantenha a chave age fora do servidor e teste descriptografia
com operador custodiante.

## Rollback e recuperacao

- **Frontend Worker:** registrar a versao ativa e anterior antes do deploy. Em
  incidente, revisar `wrangler versions list` e executar com aprovacao
  `npx wrangler rollback <VERSION_ID> --name edumoneyyyy`; rollback publica nova
  deployment e nao reverte estado de recursos. Confirmar Worker, dominio e
  smoke depois.
- **Postgres:** nao ha down migration generica. Interromper novas escritas do
  modulo afetado, preservar diagnosticos, escolher correcao forward-only ou
  restaurar backup em nova instancia, comparar e so entao planejar cutover com
  janela/consentimento. Nunca restaurar sobre producao sem backup comprovado,
  rehearsal e aprovacao operacional explicita.
- **Edge Functions:** codigo esta versionado em `supabase/functions`; mecanismo,
  versao de imagem/runtime e comando de deploy/rollback da VPS nao foram
  descobertos. Recuperar por procedimento do stack somente apos inventario.
- **Auth/configuracao:** JWT secrets, API keys, SMTP e OAuth nao estao no dump.
  Guardar `.env`/Compose em backup criptografado separado; nunca regenerar JWT
  secret como rollback improvisado. Procedimento de restart depende do Compose
  real ainda nao identificado.
- **Storage:** restaurar metadata junto do Postgres e objetos para backend
  compativel; validar paths e contagens em destino isolado antes de qualquer
  troca. Dump SQL sozinho nao recupera objetos.

## Fontes oficiais consultadas

- [Supabase self-hosted Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase restore/self-hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Cloudflare Worker rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
