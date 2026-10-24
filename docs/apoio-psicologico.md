# Apoio psicológico

O módulo conecta estudantes a uma psicóloga ou psicólogo humano por agendamento. Conversas e anotações ficam separadas dos registros acadêmicos. Não há diagnóstico automatizado, terapeuta de IA ou monitoramento contínuo.

## Arquitetura

- Interface React em `src/pages/Psychology/PsychologyPage.tsx`, carregada sob `/psychology/*` e protegida por papel e instituição.
- Serviços em `src/services/psychologyService.ts`; alterações clínicas e operacionais passam por RPCs no servidor.
- Papel institucional `PSYCHOLOGIST`, atribuído por convite de usuário e armazenado em `memberships`.
- Entidades próprias para perfil profissional, vínculos com estudantes, autorizações, disponibilidade, bloqueios, agendamentos, sessões, mensagens, anotações versionadas e eventos de auditoria.
- `psychology_module_settings.enabled` começa falso. A ativação/desativação por ADMIN/DIRECTOR/SECRETARY autorizado usa `psychology_set_module_enabled`; desativar preserva registros existentes e bloqueia novas operações clínicas.
- A reserva cria uma sessão `WAITING` na mesma transação. Restrições de intervalo no Postgres impedem sobreposição para estudante e profissional; a chave idempotente protege tentativas repetidas.
- Mensagens persistem em `psychology_messages`; o Realtime notifica inserções e a leitura continua sujeita a RLS e a uma verificação atual de acesso. A tela consulta periodicamente mensagens posteriores ao último cursor como recuperação de rede, sem gravar conteúdo clínico em armazenamento local.
- Anotações são privadas da profissional autora. Rascunhos têm versão otimista; finalização e adendos criam versões auditáveis sem substituir o histórico.
- As versões clínicas também ficam restritas à autora; outra profissional atribuída ao mesmo estudante não consegue consultar o prontuário.
- O registro de nova autorização depende do módulo habilitado e de vínculo escolar ativo. Revogar uma autorização continua permitido mesmo após desativar o módulo.

## Acesso

| Perfil | Acesso implementado |
| --- | --- |
| Estudante | Autorizar o próprio atendimento quando adulto, ver horários e consultas próprias, conversar apenas na sessão em andamento. |
| Responsável | Autorizar apenas estudante menor com vínculo legal ativo. Não recebe acesso automático a consultas, conversas ou anotações. |
| Psicóloga(o) | Agenda, disponibilidade, conversas e registros somente para estudantes com autorização e vínculo de acompanhamento ativos. |
| ADMIN/DIRECTOR/SECRETARY autorizado | Convidar e preparar profissionais, registrar a verificação humana do CRP, vincular estudantes e gerir a ativação. A visão operacional não retorna mensagens nem anotações. |
| Professor e demais perfis | Sem rota nem acesso clínico. |

Conhecer um ID de estudante, sessão ou agendamento não concede acesso. Desativação de perfil, vínculo, autorização ou módulo é reavaliada no servidor e invalida a leitura e o envio clínicos. As policies também limitam leitura direta; os clientes não recebem grants de escrita nas tabelas.

## Habilitar no ambiente local

1. Inicie o Supabase local descartável e aplique todas as migrations na ordem do projeto.
2. Convide uma conta fictícia com o papel **Psicóloga(o)** em Usuários. O convite cria o papel institucional sem substituir outros vínculos da pessoa.
3. Entre como ADMIN, DIRECTOR ou SECRETARY autorizado e abra **Apoio psicológico → Configuração**.
4. Registre o CRP fictício e use **Confirmo verificação humana do CRP** somente no ambiente local de demonstração. Isso grava responsável e data; não consulta nem atesta a validade real do CRP.
5. Habilite o módulo na instituição local. Cadastre um estudante fictício, atribua-o à profissional e registre a autorização como estudante adulto ou com uma conta responsável vinculada.
6. Entre como profissional, publique disponibilidade semanal e, como estudante, selecione horário e confirme a consulta.
7. A profissional inicia a sessão dentro da janela permitida. As duas contas trocam mensagens; a profissional pode salvar e finalizar a anotação ou registrar um adendo.

Não há seed com pessoas reais nem ativação automática por migration. Os testes locais criam contas `@local.test` aleatórias e registros fictícios no Supabase descartável; eles permanecem nesse banco até serem removidos ou o projeto local ser descartado. Ao terminar a demonstração, desative o módulo pela configuração ou descarte todo o projeto local.

## Validação

```powershell
npm ci
npm run typecheck
npx vitest run supabase/tests/psychology_foundation_migrations.test.ts supabase/tests/psychologyWorkflows.local.test.ts src/pages/Admin/tabs/FullStudentEnrollmentWizard.test.tsx src/services/inclusiveEducationRoster.test.ts supabase/tests/inclusive_student_registration_explicit_migration.test.ts
npm run build
```

Os testes marcados `.local.test.ts` precisam das variáveis `MULTI_TENANT_SUPABASE_URL`, `MULTI_TENANT_SUPABASE_ANON_KEY` e `MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY` apontando para o Supabase descartável; não use credenciais de produção. `npm run test:full:local` também exige Docker.

## Desativação e preservação

Use o botão **Desativar módulo** na configuração institucional. Isso grava `enabled=false`, registra o evento de auditoria e bloqueia operações clínicas no servidor. Não apague tabelas nem registros para interromper o recurso. Para reativar em desenvolvimento, habilite novamente pela mesma tela após confirmar vínculos e autorizações. As migrations estruturais não são revertidas durante uma desativação.

## Decisões antes de uso real

- Identificar a responsável técnica e o procedimento de conferência documental e atualização da situação do CRP.
- Aprovar aviso de privacidade, base legal, texto de autorização e processo de autorização de menores com responsáveis competentes.
- Definir política institucional de guarda, acesso formal, correção, descarte e resposta a incidentes para registros clínicos.
- Definir contato e fluxo de encaminhamento para situações urgentes. O módulo não é serviço de emergência.
- Revisar prazos de cancelamento e regras de operação por instituição.

O software registra autorização e papéis de acesso, mas não certifica conformidade jurídica ou profissional. O banco guarda o conteúdo clínico persistente; não se promete criptografia ponta a ponta nem sigilo contra operadores autorizados da infraestrutura.
