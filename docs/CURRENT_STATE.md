# Estado canonico do TecEscola

**Atualizado:** 2026-09-25
**Baseline:** `e550ad575f9d06e67f7b91d54501c3ed4216dbc7`
**Qualificacao em andamento:** `release/tecescola-production-qualification`

Este e o ponto inicial para agentes e operadores. O codigo e as migrations desta
branch descrevem o estado versionado; a producao self-hosted so e considerada
confirmada quando o inventario privilegiado read-only estiver anexado ao estado
em `docs/production/current-production-state.md`.

## Arquitetura observada no repositorio

- Frontend React 19, TypeScript, Vite e Cloudflare Worker configurado em
  `wrangler.jsonc`; o Worker serve `dist` como SPA.
- Backend Supabase self-hosted: PostgreSQL, Auth, PostgREST, Realtime, Storage e
  Edge Functions; migrations locais em `supabase/migrations`.
- O baseline contem 121 arquivos SQL timestamped de migration. `npm run
  test:full:local` reconstruiu o banco local do zero sem drift.
- `attendance_sessions` e a identidade persistida de cada aula; frequencia,
  Diario de Classe, avaliacoes, resultados, documentos, comunicacao, financeiro,
  cameras e controle de acesso possuem implementacao no repositorio em graus
  diferentes de maturidade.

## Papeis

- `profiles.platform_role`: `USER` ou `SUPER_ADMIN`; escopo global de plataforma.
- `profiles.role`: papel historico/compatibilidade, nao deve substituir o papel
  de membership quando a tela opera no contexto de uma instituicao.
- `memberships.role`: `ADMIN`, `DIRECTOR`, `SECRETARY`, `TEACHER`, `STUDENT`,
  `GUARDIAN`; `active` e parte da autorizacao.
- `ADMIN` representa dono/administrador da conta do cliente e tem apenas os
  poderes escolares explicitamente previstos. `DIRECTOR` e `SECRETARY` sao os
  papeis operacionais institucionais; professor, aluno e responsavel ficam no
  escopo autorizado da propria instituicao.

As migrations/code atuais sao a fonte versionada para permissao. Esse modelo nao
prova que o schema ou os dados da VPS estejam alinhados.

## Seguranca e operacao

- SheetJS esta pinado ao pacote oficial 0.20.3; imports desabilitam parsing de
  formulas/HTML em celulas e preservam suporte `.xls` coberto por teste.
- `npm audit` e `npm audit --omit=dev` passaram sem vulnerabilidades reportadas
  na execucao de 2026-09-25.
- O teste completo local reinicia o Supabase e confirma persistencia do volume.
- Producao: consulte o inventario e os blockers em
  `docs/production/current-production-state.md` e
  `docs/production/PRODUCTION_QUALIFICATION_2026-09-25.md`.
- Operacao self-hosted e recuperacao: `docs/operations/self-hosted-production-runbook.md`.

## Maturidade dos modulos com dependencias externas

| Area | Classificacao | Base da classificacao |
|---|---|---|
| Financeiro | `EXPERIMENTAL` | O servico ainda fornece `MockPaymentProvider`/pagamento manual; nenhum provedor real foi qualificado. |
| Cameras | `INTEGRATION_REQUIRED` | Fluxos e gateway existem, mas o funcionamento fisico depende de hardware/rede do piloto ainda nao ensaiados nesta campanha. |
| Portaria / controle de acesso | `INTEGRATION_REQUIRED` | cadastro de dispositivo e schema existem; nao foi comprovado ingestao ao vivo em equipamento real. |

Essas classificacoes descrevem evidencia desta campanha, nao disponibilidade de
contratos ou equipamentos.

## Decisao de piloto

**NOT READY neste momento.** Os gates locais passaram, mas falta acesso
privilegiado/read-only comprovavel a VPS e tenant dedicado para reconciliar
schema, validar backup/restauracao de producao, Auth/email e isolamento remoto.
