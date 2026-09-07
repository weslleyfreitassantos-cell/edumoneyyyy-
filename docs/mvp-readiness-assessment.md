# Avaliação de prontidão do MVP

Atualizado em 2026-09-06.

## Resumo executivo

O projeto já cobre o núcleo de uma gestão acadêmica escolar: autenticação,
instituições, configuração acadêmica, pessoas, turmas, matrículas, matriz
curricular, atribuições, geração de grade, importação por planilha e dashboards
por papel.

Estimativa técnica, separando produto de operação:

| Dimensão | Estimativa | Leitura |
| --- | ---: | --- |
| MVP funcional de gestão acadêmica | ~75% | Os fluxos principais estão implementados e cobertos por testes locais. |
| Prontidão para homologação | ~60% | Ainda faltam testes ponta a ponta com dados reais e uma base de staging coerente. |
| Prontidão para uso produtivo | ~45% | O bloqueio principal é reconciliação do banco, não quantidade de telas. |

As porcentagens são uma avaliação de engenharia, não uma métrica automática do
produto.

## Estado do código

- Branch: `fix/email-resend-production`.
- Commit atual: `e67713f`.
- CI remoto: verde no run `34076232876`.
- Typecheck, build e suíte local: verdes (`1097/1097` testes).
- O commit `e67713f` restaurou o módulo **Materiais e avisos**, suas rotas,
  serviços, testes e migrations.
- A automação acadêmica continua presente na preparação da grade e na criação
  de atribuições para o ano letivo. Não foi encontrada uma perda de código nas
  outras branches; o que falta é uma ação independente e explícita para
  automatizar atribuições fora desses fluxos.
- O PR #152 está aberto, mas conflitante com `main`. Não fazer merge automático
  enquanto a origem das mudanças de `main` não for revisada.

## O que já compõe o MVP

### Núcleo acadêmico

- login, sessão protegida e escopo por instituição;
- ano letivo, períodos, turnos, intervalos e política acadêmica;
- disciplinas, turmas e matriz curricular;
- alunos, professores e responsáveis;
- matrículas e vínculos de responsáveis;
- atribuições de professores por turma, disciplina e período;
- preparação e geração automática da grade, com validações de disponibilidade,
  conflitos, carga e salas;
- importação de alunos e professores por XLS/XLSX, com campos obrigatórios,
  distribuição por série e validação de linhas;
- dashboards de diretor, professor, aluno e responsável;
- comunicação administrativa e o módulo restaurado de materiais e avisos.

### Itens existentes, mas ainda dependentes de homologação

- notas e frequência possuem componentes e migrations locais, mas a auditoria
  anterior registrou que as tabelas correspondentes não estavam confirmadas no
  banco remoto;
- financeiro possui interface e serviços, mas depende da estrutura financeira
  efetivamente aplicada no ambiente;
- câmeras possuem integração e gateway, porém exigem teste operacional por
  ambiente e rede;
- convites, redefinição e entrega de e-mail dependem de secrets, SMTP/Resend,
  redirects e logs remotos validados no ambiente alvo.

## Bloqueios de produção

### 1. Drift de migrations

Uma consulta read-only com `supabase migration list` mostrou:

- locais ainda não registrados no remoto: `20260905223339`, `20260906003859`
  e `20260906210000`;
- timestamps remotos sem arquivo correspondente neste branch:
  `20260906003653`, `20260906004102`, `20260906143016`, `20260906193456` e
  `20260906222415`.

Os timestamps remotos não foram interpretados por nome. É necessário identificar
o conteúdo e comparar o schema antes de usar `db push` ou `migration repair`.
O `db diff --linked` não pôde ser executado porque o Docker Desktop não estava
disponível para criar o shadow database.

### 2. PR conflitante

O PR #152 está com CI verde, mas o GitHub marca `mergeable: CONFLICTING`. A
branch não deve ser mesclada em `main` sem uma resolução manual que preserve:

- o fluxo de configuração guiada da escola;
- importação e matrícula;
- automação da grade;
- correções de autenticação e e-mail;
- materiais e avisos.

### 3. Staging e observabilidade

Ainda faltam homologação ponta a ponta em staging, monitoramento de erros do
frontend/Edge Functions, teste de isolamento entre instituições e um rollback
operacional documentado para cada migration nova.

### 4. Papéis futuros

`SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` não devem ser habilitados apenas no
frontend. Eles exigem enum, RLS, policies, claims e testes de autorização no
banco remoto.

## Plano mínimo para chegar ao MVP produtivo

1. Congelar a branch de release e resolver o conflito do PR manualmente.
2. Inventariar os cinco timestamps remotos desconhecidos e confirmar se algum já
   contém objetos de materiais, hardening ou advisors.
3. Criar um staging com backup, aplicar somente migrations incrementais
   reconciliadas e executar a auditoria read-only novamente.
4. Testar os fluxos reais com um usuário de cada papel: diretor, professor,
   aluno e responsável.
5. Validar importação parcial/completa, matrícula automática, atribuição,
   geração/publicação de grade, avisos e materiais.
6. Confirmar SMTP/Resend, redirects, secrets, RLS e logs antes do go-live.
7. Só então publicar frontend, Edge Functions e migrations em uma janela
   controlada, com rollback preparado.

## Decisão deste ciclo

O código do commit `e67713f` pode permanecer no branch e já passou pelo CI.
Não há uma nova publicação de produção necessária para organizar o repositório
agora. A próxima publicação segura depende da reconciliação do banco e da
resolução do conflito do PR.

