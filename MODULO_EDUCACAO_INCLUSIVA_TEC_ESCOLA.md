# Educação Inclusiva — estado da PR #363

## Escopo entregue

A PR adiciona uma base de navegação para Educação Inclusiva: rota protegida, painel inicial e entradas para PEI, AEE/PAEE, biblioteca de atividades, exercícios, materiais e evolução pedagógica. O menu só aparece quando há instituição selecionada e o vínculo ativo tem papel `ADMIN`, `DIRECTOR`, `SECRETARY` ou `TEACHER`.

As telas de PEI e AEE/PAEE ainda são estados de preparação. Não há formulários ativos nem operações de leitura ou gravação na interface. Biblioteca, exercícios, materiais e evolução também são apenas estrutura visual. Não apresentar esta entrega como módulo pedagógico funcional.

## Banco e segurança

A migration `20261014000100_inclusive_education_foundation.sql` define a base de tabelas e RLS para planos PEI, atribuições e planos AEE, sessões e revisões. O serviço mantém `INCLUSIVE_EDUCATION_DATA_ENABLED=false`; a interface não consulta nem altera esses dados. A migration está incluída na PR, mas não foi aplicada em produção.

As policies limitam planos pelo vínculo do aluno à instituição e pelo escopo de gestão, docência ou atribuição AEE. Atribuições exigem aluno e profissional vinculados à mesma instituição. Revisões imutáveis são, nesta fase, acessíveis somente à gestão institucional; a autoria de uma revisão, por si só, não concede acesso. Ao inserir revisão, `changed_by` também precisa corresponder ao usuário autenticado.

Não foram adicionados diagnósticos clínicos, cadastros paralelos de alunos/profissionais nem permissões para estudantes ou responsáveis.

## Publicação

Esta PR não representa publicação em produção. Qualquer referência histórica a deploy, versão do Worker ou disponibilidade em produção não descreve o estado atual e não deve ser usada como evidência de deploy desta PR. A migration não foi aplicada em ambiente remoto.

## Validação e pendências

- Nesta revisão: typecheck aprovado; 53 testes focados aprovados (Sidebar, AppShell e migration); build aprovado; `git diff --check` aprovado.
- Não foi possível validar a migration em um banco descartável local. O job `database` anterior falhou ao iniciar o Supabase descartável, antes de testar a migration; os logs públicos não expõem a causa detalhada. Esse resultado não comprova sucesso nem defeito da migration.
- Antes de ativar operações de dados, adicionar testes RLS de integração cross-tenant, validar referências entre documentos e alunos, e implementar formulários acessíveis de PEI/AEE com auditoria.
- Submeter o conteúdo e o fluxo do módulo a revisão pedagógica e às aprovações institucionais pertinentes antes de publicação funcional.
