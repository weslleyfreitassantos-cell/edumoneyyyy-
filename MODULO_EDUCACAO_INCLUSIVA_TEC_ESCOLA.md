# Módulo Educação Inclusiva — Tec Escola

## Diagnóstico

O sistema já possui autenticação, seleção de instituição, papéis institucionais e menu lateral expansível. Não havia uma área de Educação Inclusiva dedicada. A primeira fase foi implementada sem criar uma segunda fonte de alunos, turmas, professores ou instituições.

## Arquitetura da primeira fase

- Rotas protegidas em `/inclusive-education` e `/inclusive-education/:section`.
- Componente reutilizável em `src/components/inclusive/InclusiveEducationPage.tsx`.
- Grupo expansível no `Sidebar` com sete entradas: Visão Geral, PEI dos Alunos, AEE / PAEE, Biblioteca de Atividades, Exercícios Interativos, Materiais para Download e Evolução Pedagógica.
- Acesso liberado para `ADMIN`, `DIRECTOR`, `SECRETARY` e `TEACHER`, respeitando a instituição atualmente selecionada pelo contexto existente.
- Alunos e responsáveis não recebem o item no menu nem passam nas rotas protegidas.

## Funcionalidades entregues

A Visão Geral apresenta as áreas do módulo e navegação real. Cada área possui uma tela inicial honesta, com estado de preparação e sem números fictícios. O texto deixa explícito que o próximo passo depende da definição das estruturas pedagógicas específicas.

## Dados, tabelas e migrations

Nenhuma tabela ou migration foi criada nesta fase. A implementação não consulta nem replica dados de alunos. Antes de persistir PEI, AEE/PAEE, atividades adaptadas ou evidências de evolução, deve ser apresentado um plano de schema, RLS e auditoria e obtida autorização específica para a mudança de banco.

Estruturas a avaliar posteriormente: planos PEI vinculados ao aluno existente, registros de atendimento AEE/PAEE vinculados à matrícula/instituição, biblioteca de atividades, materiais, exercícios e evidências pedagógicas. Não fazem parte do módulo diagnósticos clínicos ou avaliações médicas.

## Segurança e permissões

As rotas usam `ProtectedRoute` e os papéis já existentes. O escopo de instituição continua sendo resolvido por `InstitutionContext`; não há acesso por ID informado na URL nem leitura de dados nesta fase. O módulo não altera autenticação, banco, RLS ou sistema administrativo.

## Validação

Executar antes da entrega: `npm run typecheck`, `npm run test` e `npm run build`. Validar manualmente a navegação desktop/mobile, o fechamento do menu no mobile, redirecionamento de papéis não autorizados e preservação das rotas existentes.

## Pendências

- Definir com a escola o modelo pedagógico e os campos de PEI/AEE.
- Elaborar migration e políticas RLS somente após autorização.
- Conectar dados reais, auditoria, anexos e relatórios em fases posteriores.
- Criar testes E2E dos papéis e do isolamento entre instituições quando as telas com dados forem implementadas.

## Fase 2 — inspeção e plano aprovado para discussão

### Situação encontrada

O esquema auditado possui `students`, `enrollments`, `classes`, `academic_years`, `memberships`, `profiles` e `institutions`, com RLS habilitado nas entidades acadêmicas principais. Não existem tabelas de PEI, AEE/PAEE ou histórico específico para esses documentos. O modelo atual permite reutilizar os IDs existentes, sem criar cadastros paralelos.

Há duas restrições que precisam ser resolvidas antes da execução: o histórico de migrations do remoto não está reconciliado com o diretório local, e `SECRETARY` está presente no frontend mas não no enum `public.user_role` descrito na auditoria remota. Nenhuma migration foi executada.

### Matriz proposta de permissões

| Papel | Listar documentos | Criar/editar | Ver conteúdo sensível | Exportar PDF |
|---|---|---|---|---|
| `DIRECTOR` | Apenas sua instituição | Sim, dentro da instituição | Sim, conforme escopo institucional | Sim |
| `TEACHER` | Apenas estudantes com vínculo pedagógico autorizado | PEI/AEE sob vínculo autorizado | Apenas seu escopo pedagógico | Sim, no mesmo escopo |
| Profissional AEE | Apenas estudantes sob responsabilidade | PAEE e registros sob responsabilidade | Apenas estudantes atribuídos | Sim, no mesmo escopo |
| `SECRETARY` | Sem acesso ao conteúdo sensível por padrão | Não | Não | Não |
| `ADMIN`/owner | Não automático | Não automático | Somente autorização específica | Somente autorização específica |
| `STUDENT` / `GUARDIAN` | Não nesta área administrativa | Não | Não | Não |

Profissional AEE ainda não é um papel persistido no modelo atual. A alternativa segura é uma atribuição explícita por instituição e estudante, com RLS próprio, antes de liberar esse acesso.

### Modelo de dados proposto, ainda não executado

- `inclusive_pei_plans`: plano vinculado a `students.id`, `institution_id`, `academic_year_id`, turma opcional, status, versão, prazo de revisão e autoria.
- `inclusive_pei_sections`: seções pedagógicas estruturadas e configuráveis por plano, sem campos clínicos obrigatórios.
- `inclusive_aee_plans`: PAEE vinculado ao estudante e opcionalmente ao PEI, com profissional responsável e instituição.
- `inclusive_aee_sessions`: registros pedagógicos de atendimento, sem diagnóstico clínico.
- `inclusive_document_revisions`: histórico imutável de versões e autoria para PEI/PAEE.
- `inclusive_aee_assignments`: atribuição explícita de profissional AEE por instituição/estudante.

Todas as tabelas deverão ter `institution_id`, FKs para os registros existentes, `created_by`, `updated_by`, timestamps, RLS por instituição ativa e políticas adicionais por vínculo pedagógico/atribuição. PDFs e anexos deverão usar storage privado e URLs temporárias, sem links públicos permanentes.

### Decisão pendente

Antes de criar a migration e implementar o fluxo real, é necessária autorização explícita para:

1. criar as tabelas e policies da Fase 2 em ambiente de desenvolvimento/staging;
2. resolver a estratégia do papel/profissional AEE;
3. validar a matriz acima com o responsável da instituição;
4. reconciliar o baseline de migrations antes de qualquer aplicação remota.

## Fase 2 — estado da implementação autorizada

### Entregue localmente

- Migration `supabase/migrations/20261014000100_inclusive_education_foundation.sql` criada, sem alteração de enum.
- Tabelas locais preparadas para PEI, atribuições AEE, PAEE, sessões de atendimento e revisões.
- Índices por instituição/estudante e constraints de integridade adicionados.
- RLS preparado com três caminhos de acesso: diretor/administrador da instituição, professor com vínculo pedagógico via `subject_offerings` e profissional com atribuição AEE ativa.
- Secretaria não recebeu acesso automático ao conteúdo sensível; alunos e responsáveis não foram incluídos nas policies.
- Profissional AEE é resolvido por `inclusive_aee_assignments`, sem criar papel novo. `SECRETARY` não foi alterado.
- Tela de PEI conectada ao Supabase para listar estudantes autorizados, criar/editar rascunhos e iniciar impressão local do documento.
- Tela AEE/PAEE conectada à listagem autorizada e impressão local. O conteúdo clínico não faz parte do modelo.
- Serviço criado em `src/services/inclusiveEducationService.ts`.

### Testes executados

- `npm run typecheck`: aprovado.
- `npx vitest run supabase/tests/inclusive_education_foundation_migration.test.ts`: 3 testes aprovados.
- `npm run build`: aprovado.
- `py -m graphify . --update --code-only`: executado.

### Bloqueios e pendências

- `supabase status` não está disponível nesta máquina e não foi comprovada uma instância de staging separada. A migration não foi aplicada em nenhum banco remoto.
- Testes RLS de integração cross-tenant dependem de uma instância local/staging com as migrations-base carregadas, usuários de teste e chaves locais.
- A exportação atual usa impressão local do navegador; a geração de PDF server-side e anexos privados dependem da validação do storage e do ambiente seguro.
- Ainda faltam formulários completos de PAEE, sessões, revisões persistidas automaticamente e filtros avançados.
- Antes de qualquer aplicação remota, é obrigatório obter inventário read-only atualizado, reconciliar o baseline de migrations e validar as policies em staging.

### Publicação em produção — 14/10/2026

- Deploy autorizado publicado no Worker administrativo `edumoneyyyy`, pelo fluxo `npx wrangler deploy` e pela rota `*.grupotec.dev.br/*`.
- Versão publicada: `5635e9a8-162e-49b5-add1-c9a8618f7bdb`.
- Versão anterior registrada para reversão: `9b2ec94e-89d7-46f0-b738-4928455e69b9`.
- A rota `/inclusive-education` e o bundle da tela responderam em produção; o menu e as sete rotas estão disponíveis para usuários autenticados autorizados.
- PEI e AEE/PAEE permanecem em modo seguro de preparação: sem leitura, criação, edição ou exportação de dados sensíveis até validar RLS e aplicar a migration em ambiente aprovado.
- A migration `20261014000100_inclusive_education_foundation.sql` não foi aplicada. Não houve alteração em banco, enums, autenticação, DNS ou sistema institucional.
- Verificações externas: `/login` e `/inclusive-education` administrativos responderam HTTP 200; o site institucional também respondeu HTTP 200; o bundle `InclusiveEducationPage` foi servido corretamente.
