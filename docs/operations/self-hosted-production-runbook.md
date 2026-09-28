# Runbook de operacao self-hosted

**Status:** validado contra a VPS self-hosted em 2026-09-28; checks operacionais
e restore offsite foram executados. Entrega remota de alertas e metricas HTTP
5xx continuam bloqueadas/indisponiveis, conforme registrado abaixo.
**Limite:** nao use `supabase db push`, `migration repair`, `config push` ou SQL
de escrita remota como procedimento de deploy.

## Estado operacional da VPS

A producao usa backup local diario existente e um `ExecStartPost` no mesmo
servico para enviar o arquivo validado ao Google Drive, fora do failure domain
da VPS. O arquivo remoto e criptografado com age antes do upload; a identidade
privada age permanece somente no computador do operador. A retencao configurada
e de 14 dias para os arquivos locais existentes e de 14 dias no destino offsite.
O timer existente `edumoney-backup.timer` continua sendo o unico scheduler de
backup. O backfill inicial enviou 12 arquivos locais recentes cobrindo 10 datas;
a janela remota de 14 datas sera completada pelas execucoes diarias seguintes.

O monitor read-only roda a cada cinco minutos por `tecescola-pilot-monitor.timer`
e grava checks/state no journald e em arquivo root-only. O estado inclui
frontend, backend, Auth, PostgREST, PostgreSQL, disco, freshness/integridade dos
backups e TLS. Para inspecionar sem mostrar credenciais:

```sh
sudo systemctl list-timers edumoney-backup.timer tecescola-pilot-monitor.timer
sudo systemctl show edumoney-backup.service tecescola-pilot-monitor.service \
  -p ActiveState -p UnitFileState -p Result -p ExecMainStatus
sudo journalctl -u tecescola-pilot-monitor.service --since today --no-pager
sudo cat /var/lib/tecescola-ops/offsite-backup.state
```

Para executar backup manual, use `sudo systemctl start edumoney-backup.service`;
confirme `Result=success`, `ExecMainStatus=0` e `status=SUCCESS` no arquivo de
estado offsite. O script verifica os componentes/checksums do bundle, criptografa
com age, compara o SHA-256 do ciphertext remoto e aplica a retencao. Nao execute
`rclone sync` nem apague backups manualmente.

O restore drill de 2026-09-28 recuperou um arquivo lido do Google Drive para um
container descartavel, sem rede e com Postgres/tmpfs. O dump restaurado foi
validado com 77 tabelas publicas, 243 foreign keys e RLS em 77 tabelas. Uma
amostra de Storage foi escrita somente em `/tmp` tmpfs e teve hash conferido.
Duracoes observadas: backup/offsite entre 7 e 17 s; restore do banco 2,7 s;
restore da amostra Storage 0,4 s. Sao medidas destas amostras, nao SLA. O
container do drill e seus temporarios devem ser removidos ao final da verificacao.

O timer de monitor foi confirmado habilitado e executou em multiplos ciclos. Os
checks publicos e locais passaram durante a verificacao. O check `http_5xx`
permanece `UNKNOWN`: os logs do Caddy nao carregam status de resposta, e as
metricas expostas pelo admin do Caddy contabilizam somente chamadas ao proprio
admin. Nao habilite access logs sem revisar a politica de privacidade/retencao,
pois URLs podem conter dados sensiveis.

Nao existe canal tecnico remoto de alerta configurado nesta VPS. O monitor
mantem transicoes de estado e eventos locais no journald, mas nao entrega alertas
nem recuperacoes a uma pessoa. Portanto alert delivery/failure/recovery remoto
esta bloqueado ate que um destino operacional seja explicitamente autorizado e
configurado; nao use comunicados escolares como canal.

Para silenciar temporariamente as verificacoes agendadas, pare o timer e
reative-o ao concluir a manutencao:

```sh
sudo systemctl stop tecescola-pilot-monitor.timer
sudo systemctl enable --now tecescola-pilot-monitor.timer
```

Rollback desta campanha: para voltar ao backup local-only, remova o drop-in
`/etc/systemd/system/edumoney-backup.service.d/10-offsite.conf` e execute
`sudo systemctl daemon-reload`; o timer/servico de backup local original nao deve
ser removido. Para desativar o monitor, use `sudo systemctl disable --now
tecescola-pilot-monitor.timer` e preserve os arquivos de estado para diagnostico.
Nenhum desses passos requer reiniciar containers ou a VPS.

## Health

Com `SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`) em variavel de
ambiente, execute `npm run health:prod`. O script faz apenas GETs: frontend,
Auth, query REST sem linhas, Storage e ping do Realtime. Ele nao imprime a chave
nem corpos de resposta. Sem chave, a query DB fica `BLOCKED`; HTTP diferente de
200 reprova o health check. Edge Functions sem endpoint seguro de health nao
sao invocadas.

## QA de producao

O smoke Playwright e o harness de inspecao ficam em `e2e/production-smoke.pw.ts`
e `scripts/qa/production-session-inspect.mjs`. Execute somente contra um tenant
dedicado de QA. O smoke exige `PROD_SMOKE_BASE_URL` em HTTPS,
`PROD_SMOKE_CONFIRM_PILOT_TENANT=I_CONFIRM_DEDICATED_PILOT` e
`PROD_SMOKE_USERS_JSON`, recebido pelo processo e nunca gravado no repositorio.
Capturas, traces e videos ficam desativados; os artefatos temporarios do smoke
sao removidos ao final.

O harness interativo recebe um JSON por stdin. As origens publicas podem ser
substituidas com `TECESCOLA_APP_ORIGIN` e `TECESCOLA_API_ORIGIN`. Para operacoes
que enderecam identidades sinteticas QA, configure `TECESCOLA_QA_EMAIL_PREFIX`
e `TECESCOLA_QA_EMAIL_SUFFIX` no ambiente local do operador; nao use aliases de
clientes nem armazene credenciais em arquivo. Credenciais sao lidas em memoria,
nao sao incluidas no relatorio e devem ser fornecidas por um canal seguro. O
relatorio agregado e salvo no diretorio temporario do sistema.

Com o host e o usuario SSH confirmados por operador autorizado, rode o collector
read-only no proprio repo clonado na VPS:

```sh
bash ops/health/vps-readonly.sh
```

O collector registra host/disk/inodes, Compose projects, todos os containers
(inclusive parados), imagem/tag e ID, health, restart policy/count, portas,
nomes de redes, uso agregado de recursos e Docker disk usage. Ele nao le
`Config.Env`, nao coleta logs e nao modifica serviços, redes ou volumes. Nomes
de containers e portas devem ser tratados como inventário operacional.

Depois que o container/servico Realtime real estiver identificado, inspecione
somente logs recentes e limitados no host autorizado, sem salvar nem reproduzir
linhas contendo e-mails, tokens, JWTs ou identificadores de aluno. Ainda nao ha
topologia Compose, upstream Caddy, nome de servico ou imagem da VPS confirmados;
nao invente comandos de restart/alteracao antes do diagnóstico e do human gate.

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

Na VPS atual, a retencao existente local e de 14 dias; o uploader offsite aplica
14 dias no Google Drive. O backfill inicial preservou os 12 arquivos locais
disponiveis (10 datas distintas); ainda nao ha 14 datas offsite acumuladas. A
copia remota e criptografada, e a chave privada age fica fora do servidor e do
repositorio. Um restore completo offsite foi comprovado em ambiente isolado em
2026-09-28. Repetir restore periodicamente e apos mudancas no formato do backup;
nenhuma chave privada deve ser instalada na VPS.

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
