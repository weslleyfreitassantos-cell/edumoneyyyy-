# Tec Escola — plano de release da PR #399

**Estado:** candidata em revisao; producao bloqueada pelo gate offsite de
backup. Este documento registra fatos e uma sequencia futura; nao autoriza
merge, migrations, deploy, reinicio de servicos ou smoke em producao.

## Identidade e escopo

- PR: [#399](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/399)
- Branch: `release/tecescola-consolidacao-producao`
- SHA inicial observado: `276a7845b026434bf88f999588294748342da705`
- `main` observada: `6a26f5fee81a8d1916aaca849c20f673cde12fe5`
- Escopo original: 102 arquivos e 15 migrations; a correcao desta campanha
  acrescenta cobertura de compatibilidade e documentacao.
- PR #396 continua excluida. Sua migration
  `20261023000600_student_enrollment_without_auth_account.sql` nao existe na
  candidata nem na `main`. A revisao das alteracoes sobrepostas confirmou que
  o cadastro de estudante sem conta Auth e o vinculo postergado de responsavel
  da PR #396 nao estao presentes na candidata. `profile_id` segue obrigatorio,
  e no fluxo de criacao da candidata o email permanece obrigatorio.

## Fatos de producao lidos sem escrita

- Ledger: 221 versoes, ultima `20261019000500`; as 15 migrations abaixo ainda
  nao estao aplicadas.
- Arquivos SQL locais: 244 versoes timestamped, sem IDs duplicados. Cada uma
  das 221 versoes do ledger possui exatamente um arquivo local.
- Gate de backup offsite: `FAIL`; estado de 2026-10-18 sem artefato, hash ou
  bytes. A ultima execucao do servico local foi bem-sucedida, mas isso nao
  valida o artefato offsite.
- Cloudflare Worker `edumoneyyyy`: deployment
  `d0bb6e84-ae36-43ea-afc5-fb21af6a32f6`, versao ativa a 100%
  `d8fe9b44-d268-403c-8af1-c8a780b415b3`, criado em 2026-10-23. Nao ha SHA Git
  anotado nesse deployment.
- Edge Functions: container `supabase-edumoney-edge-functions`, runtime
  `supabase/edge-runtime:v1.76.2`, fonte montada de
  `/srv/grupotec/supabase-projects/edumoney/volumes/functions`. A funcao
  `invite-school-user` na origem atualmente montada tem hash
  `2e7e9c04e7b9f5cf5bcbe06d35c8464a68532e0c85e302762bfd9f0042514dd8`; a
  candidata tem hash
  `d3f14f9f5eeceafe0ae86d6dede8249bf99c80395ef60500cef8a044a27c6a3a`. O hash
  da origem montada nao prova sozinho qual codigo esta carregado em memoria. O
  Compose identifica o servico `functions` e seu arquivo de stack; o comando
  preparado e
  `docker compose -f /srv/grupotec/supabase-projects/edumoney/docker-compose.yml restart functions`.
  O restart para carregar novas alteracoes esta descrito na
  [documentacao Supabase para Edge Functions self-hosted](https://supabase.com/docs/guides/self-hosting/self-hosted-functions).
  Antes do restart futuro, preservar a versao anterior do arquivo para rollback.
  O procedimento foi identificado, mas nao foi ensaiado nem executado.

## Compatibilidade de migrations

Cinco migrations de Tec Ingles tem timestamps anteriores ao maior timestamp
remoto. O [CLI do Supabase](https://supabase.com/docs/reference/cli/supabase-db-push)
omite por padrao migrations pendentes mais antigas;
portanto, o promotor anterior falharia no dry-run seletivo mesmo com o ledger e
o alvo corretos. A correcao na PR ativa `--include-all` apenas quando o alvo
solicitado antecede o maior timestamp remoto. O workdir temporario contem todos
os arquivos ja aplicados no ledger e exatamente o arquivo alvo. A saida do
dry-run continua exigindo exatamente uma migration, com ID igual ao alvo; o
mesmo argumento e usado na aplicacao somente apos todos os gates existentes.

Depois da aplicacao, o promotor agora le todas as versoes do ledger e exige o
conjunto exato `versoes anteriores + alvo`: versoes faltantes, extras ou
duplicadas fazem a verificacao falhar. `REMOTE_AFTER_LAST` vem do maior valor
real retornado pelo banco, portanto permanece no timestamp mais recente quando
o alvo e historico. Se a consulta posterior falhar depois de o CLI retornar
sucesso, o resultado e marcado como `UNKNOWN_DO_NOT_RETRY`; a orientacao e fazer
somente uma leitura do ledger antes de decidir qualquer nova acao.

O teste local separa os casos historico e cronologico, valida ledgers
faltantes/extras/duplicados, e simula uma consulta pos-aplicacao indisponivel
para impedir repeticao cega. A CI executa tambem
`scripts/db/promote-single-migration.postgres.test.sh`: cria bancos isolados no
PostgreSQL descartavel do Supabase local, aplica uma migration historica e outra
cronologica pelo promotor real (`APPLY=1` somente nesses bancos de CI), e
confirma o efeito SQL, o ledger final exato e o maior timestamp correto. Tambem
aplica uma migration permitida pela excecao do release #399 em um terceiro banco
descartavel e confirma o ledger, a funcao e o grant. A rotina remove esses bancos
ao terminar. Nenhum ledger remoto ou de producao e alterado.

Os SHA-256 abaixo usam o conteudo SQL canonico com quebras LF. O promotor
remove somente `CR` final de linha antes de calcular o hash, evitando que
`core.autocrlf` produza fingerprints diferentes entre Windows e Linux.

| Ordem | Versao | Migration | SHA-256 |
|---:|---|---|---|
| 1 | `20261013003200` | `bncc_english_infer_text_question_first_v5` | `a74980197b1aabbc1f3dce88b4c2719fd3621eaa33e7c3c7e1cc36f00d541083` |
| 2 | `20261015000700` | `bncc_english_relate_language_culture_question_first_v5` | `07ee09d493878cff41b2e347c8626874f2b0d4b1b6f0781a7ac4949372fab420` |
| 3 | `20261015000800` | `bncc_english_context_vocabulary_question_first_v5` | `eadd8c05e8046b8498228918dea75ff4e14e9905093928fccb87c78ad7ee81fe` |
| 4 | `20261015004100` | `bncc_english_infer_from_text_library_expansion_v6` | `5e7d9a9eddea72ebb5cdd5a155cdf96d32f28fc4d1b1a5f4ad4e6a10d45851e3` |
| 5 | `20261016000400` | `bncc_english_inference_library_expansion_v8` | `274dc0acbca22eff5e63566193965d90102a8a5edf8d57b4962eab1436f3a226` |
| 6 | `20261022000200` | `inventory_management` | `656de511d5d302a46a3c82fcfafdc3aab538027ac85c8fc2e365e05e929d5a59` |
| 7 | `20261023000100` | `inventory_physical_count` | `d51ac811cac838124531d6d0eab25d8a6aa9bf1492129c8b7138828eb00ece7e` |
| 8 | `20261023000200` | `guided_study_demo_preview_state` | `4ed582c3b19f5da409b7e087e4bce5b8af07b7b98c5c2829fda52a3f1c414e97` |
| 9 | `20261023000300` | `student_document_review_history` | `051e2572e799b8ea6687e129b2b0da270d9bb7d2bbdbfad87a98238959392f71` |
| 10 | `20261023000400` | `student_enrollment_drafts` | `7e6fa831d9ce0a713a92aec28a799268dc5ffe291b6f5e3ee7c03846aebe3c1e` |
| 11 | `20261023000500` | `academic_document_issuance_audit` | `bb2d3f4e307b7bcd1c922327044837b5e15caff50a773102ce976ce0aeace8ec` |
| 12 | `20261023000700` | `psychologist_membership_role` | `c4a15cc02db1eec389cadf31eafec739c01faec2887169c476c55a28c91c6f86` |
| 13 | `20261023000800` | `psychology_data_foundation` | `e7e803d42c14009a8c6a04ac8e514ef773928e1e6551e13534f6d1d12edf82fb` |
| 14 | `20261023000900` | `psychology_secure_workflows` | `f4cf38b01c1ee74cd00d45e7eaaf55a1f5b12566c259027703a1e8bbc852fa1b` |
| 15 | `20261024000100` | `psychology_private_realtime_broadcast` | `9d0028276ad1798d64ab204810cae40cb1d862452c2ad8c89f06a5e6861fb71c` |

As cinco migrations historicas devem ser promovidas primeiro e individualmente,
com o script seletivo e o hash acima; em seguida, promover individualmente as
versoes 6–15 na ordem da tabela. Em cada chamada, atualizar o maior timestamp
remoto esperado apos confirmar o ledger read-only. O dry-run de cada alvo deve
identificar apenas esse alvo. Se uma condicao diferir, parar e investigar; nao
usar `migration repair`, SQL remoto ad hoc ou push generico.

## Sequencia de publicacao futura

1. Aguardar o gate offsite ficar comprovadamente `PASS` por operacao autorizada;
   esta campanha nao altera backups nem contorna o gate.
2. Obter revisao formal e aprovacao da PR #399. Nao ha branch protection
   configurada identificavel por API neste momento, e nenhum review formal foi
   registrado na ultima consulta.
3. Fazer merge somente apos aprovacao humana e CI verde no SHA final.
4. Confirmar novamente ledger, hashes e backup gate; aplicar as 15 migrations
   uma a uma pela ordem acima, parando diante de qualquer divergencia.
5. Preservar a versao atual do arquivo `invite-school-user/index.ts`, atualizar
   somente esse arquivo a partir da versao revisada/mesclada na arvore montada e
   reiniciar apenas o servico `functions` pelo comando acima. Para reversao,
   restaurar a versao preservada e repetir o restart. Validar a funcao sem
   alterar dados.
6. Fazer deploy do Worker a partir do SHA mesclado, somente quando todas as
   migrations exigidas pelo bundle estiverem confirmadas. Preservar a versao
   ativa anterior para rollback.
7. Executar smoke autenticado aprovado e observar erros, sem criar dados de
   cliente. A psicologia continua desativada por padrao.

## Estado desta campanha

- No SHA `4e3d32a02cece1b1df0da29dd20b492662b79f52`, os eventos `pull_request`
  (run `40088778033`) e `push` (run `40088775273`) concluiram com `validate`
  e `database` em sucesso. Supabase Preview ficou `SKIPPED`, nao aprovado.
- A revisao formal continua ausente; a PR #399 segue aberta e mergeavel. A PR
  #396 permanece excluida e fechada sem merge.
- Esta atualizacao documental deve ser seguida pela confirmacao dos checks no
  HEAD final da PR antes de qualquer merge.
- A producao permanece sem migrations, deploy, smoke ou alteracoes de dados. O
  gate offsite `FAIL` bloqueia a publicacao.

## Correcao final do promotor de migrations

- Commit da correcao: `e57fd91ecf09dad7d4ca0c29494ea884b0f2eeb1` na branch da
  PR #399.
- O teste unitario `scripts/db/promote-single-migration.test.sh` passou,
  incluindo ledger historico, ledger cronologico, versoes ausentes/extras/
  duplicadas e falha de leitura depois de uma aplicacao simulada. No ultimo
  caso, o promotor retornou `UNKNOWN_DO_NOT_RETRY` e fez uma unica tentativa de
  aplicacao.
- CI do commit `e57fd91ecf09dad7d4ca0c29494ea884b0f2eeb1`, run
  `40092093947`: jobs `validate` e `database` passaram.
- A prova end-to-end usou dois bancos PostgreSQL descartaveis da stack local
  da CI. O caso historico aplicou `20261013003200` sobre o ledger que terminava
  em `20261019000500`; o conjunto final continha exatamente ambas as versoes e
  `REMOTE_AFTER_LAST` continuou `20261019000500`. O caso cronologico aplicou
  `20261022000200` sobre `20261013003200`; o conjunto final tambem foi exato e
  `REMOTE_AFTER_LAST` avancou para `20261022000200`. Em ambos os casos, a tabela
  de prova recebeu exatamente uma linha.
- Nenhuma migration foi aplicada na VPS/producao, nenhum ledger de producao foi
  consultado ou alterado, e nao houve merge nem deploy.

## Recuperacao do Almoxarifado em producao — 2026-10-24

- A `main` confirmada para o release #399 continua no SHA
  `36979b8adc4408bf9eaccdf77f742904fba152fc`; a PR #399 ja esta mesclada.
- A copia Windows existente foi revalidada com SHA-256
  `b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0`.
- O PostgreSQL do backup foi restaurado em ambiente WSL descartavel e isolado:
  `POSTGRES_RESTORE=PASS`. O ledger de origem preservou 221 versoes, sem
  duplicatas; o banco-base restaurado foi mantido separado da copia de teste.
- O arquivo fisico do Storage foi extraido e verificado por copia local, mas a
  recuperacao integral nao foi comprovada: 12.248 arquivos (352.364.428 bytes)
  nao puderam ser reconciliados com 21.990 linhas `storage.objects` cujos
  metadados declaram 599.629.064 bytes. Portanto
  `STORAGE_RECOVERY=PARTIAL` e `BACKUP_RESTORE=PARTIAL`.
- As 15 migrations autorizadas foram aplicadas individualmente apenas em uma
  copia descartavel do banco restaurado. O ledger final contem exatamente 236
  versoes, sem duplicatas; as 15 alvos estao presentes e
  `20261023000600` continua ausente. As tabelas preexistentes nao tiveram
  reducao de linhas; as tabelas/RPCs/RLS do Almoxarifado foram verificadas.
  `RESTORED_DATABASE_MIGRATION_TEST=PASS`.
- O gate de backup offsite continua `FAIL`: a copia local validada nao repara
  nem atesta a rotina offsite da VPS.
- A excecao operacional da branch exige agora o resultado verificado
  `BACKUP_EXCEPTION_RESTORE_STATUS=PARTIAL` e
  `BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL`, mantendo o gate offsite em `FAIL`
  e o aceite explicito do risco incompleto. A excecao nao aprova por si so uma
  escrita em producao.
- A migration `20261023000600` permanece excluida. A promocao continua
  individual, seletiva, com validacao de hash, dry-run e ledger exato; qualquer
  estado incerto continua exigindo leitura antes de qualquer tentativa.
- Nenhuma migration foi aplicada em producao; nenhum dado, ledger, Worker,
  Cloudflare ou VPS foi alterado nesta validacao local.
- O ajuste de menu permanece em branch/PR separado e contem somente o
  agrupamento do Almoxarifado em **Comunicacao e recursos**. A branch
  `codex/role-menu-groups` continua excluida desta entrega.
