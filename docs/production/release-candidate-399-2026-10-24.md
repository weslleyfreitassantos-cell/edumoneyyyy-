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
`scripts/db/promote-single-migration.postgres.test.sh`: cria dois bancos
isolados no PostgreSQL descartavel do Supabase local, aplica uma migration
historica e outra cronologica pelo promotor real (`APPLY=1` somente nesses
bancos de CI), e confirma tanto o efeito SQL quanto o ledger final exato e o
maior timestamp correto. A rotina remove esses bancos ao terminar. Nenhum
ledger remoto ou de producao e alterado.

| Ordem | Versao | Migration | SHA-256 |
|---:|---|---|---|
| 1 | `20261013003200` | `bncc_english_infer_text_question_first_v5` | `d9f2daf215b4fdf993c1d9eb57b720a1719c317876c07f7aefcb111606768fc4` |
| 2 | `20261015000700` | `bncc_english_relate_language_culture_question_first_v5` | `51477488a74afb0a3dfd664734ab90294bb08250e17b6ba300c6bb6cc439dbd7` |
| 3 | `20261015000800` | `bncc_english_context_vocabulary_question_first_v5` | `f6c1f1a2c91e0d4991e919ea16f6b20187adad8aa289a852106114e5abddec54` |
| 4 | `20261015004100` | `bncc_english_infer_from_text_library_expansion_v6` | `4222ef4effb04d496496eefaa4f5d7c81cf7b614a792d6a859ee02bc60c834cb` |
| 5 | `20261016000400` | `bncc_english_inference_library_expansion_v8` | `5abbf6dfde4e2b560197825dd07608689da8d7893a08b32b6f4ce2eb2f3ad846` |
| 6 | `20261022000200` | `inventory_management` | `7eb047b126c418985f9c0c0cdc70430a02bec732b0e14913bf2782ff90a01f8e` |
| 7 | `20261023000100` | `inventory_physical_count` | `6817941efbc1136060b8417de23ed2eb4fd5bb5990bff9cbf6f76f8d42377048` |
| 8 | `20261023000200` | `guided_study_demo_preview_state` | `d0b206199f7749e214a4c2da13e113934bd3175c5ee0b5703d8380ac65655ff0` |
| 9 | `20261023000300` | `student_document_review_history` | `0d0da254e14aa30149767702d060ab570a6ebb6887833fd3fcdf037dca7af1d0` |
| 10 | `20261023000400` | `student_enrollment_drafts` | `1648fbf4ccfafff89d6a9f09af335f6c29b1dec10ad2d7678114c67e1809b30f` |
| 11 | `20261023000500` | `academic_document_issuance_audit` | `3055c379e5a69c4584129d7a99ed279d695636f303b6d7ffeba8084f5908bba5` |
| 12 | `20261023000700` | `psychologist_membership_role` | `1c4d461a124a434e8bad5bdf03b98676abd496190e714fe6101c34dac86a185b` |
| 13 | `20261023000800` | `psychology_data_foundation` | `39385c77789dc0850a9705f19056679e12ad2270119d132a8602dd201c8b1481` |
| 14 | `20261023000900` | `psychology_secure_workflows` | `8117b14f85a6fbd2962c5e6691e2063ebbcf42b8330149cdb9bbbe9d0c946c72` |
| 15 | `20261024000100` | `psychology_private_realtime_broadcast` | `9a7fc8b0014581918a93b130c6981ebeeb8020d093f6b8594dd7b48328610615` |

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
