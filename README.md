# EduManager Pro

Sistema de gestão acadêmica desenvolvido com React, TypeScript e Supabase.

O projeto está sendo evoluído de um protótipo visual para uma aplicação
acadêmica real, com autenticação, autorização por instituição, persistência de
dados, cadastros administrativos e dashboards conectados ao banco.

## Estado atual

A fundação da aplicação está funcional e o cadastro automatizado de alunos foi
validado de ponta a ponta.

### Funcionalidades implementadas

- autenticação com Supabase Auth;
- persistência de sessão;
- papéis de administrador, diretor, professor, aluno e responsável;
- rotas protegidas por papel;
- página de acesso não autorizado;
- identificação da instituição atual pelo vínculo em `memberships`;
- área administrativa;
- listagem de alunos;
- edição dos dados acadêmicos do aluno;
- ativação e desativação de alunos;
- geração automática de RA;
- cadastro automatizado de aluno por Edge Function;
- envio de convite por e-mail;
- React Query para consultas, mutações e invalidação de cache;
- carregamento sob demanda dos dashboards;
- testes automatizados;
- validação pelo GitHub Actions;
- typecheck separado entre frontend React e Edge Functions Deno.

## Cadastro automatizado de alunos

O cadastro administrativo utiliza o seguinte fluxo:

```text
Administrador autenticado
→ informa nome, e-mail, nascimento e CPF
→ frontend chama a Edge Function create-student
→ função verifica se o usuário é ADMIN ou DIRECTOR
→ usuário é criado no Supabase Auth
→ convite é enviado por e-mail
→ profile é criado
→ membership STUDENT é criado
→ student é criado
→ trigger gera o RA
→ novo aluno aparece na tabela
```

O fluxo foi validado com um convite real:

- o administrador cadastrou o aluno;
- o RA foi gerado automaticamente;
- o convite foi recebido por e-mail;
- o aluno aceitou o convite;
- a sessão do aluno foi criada;
- o aluno conseguiu acessar o dashboard.

## Alterações realizadas nesta etapa

### Frontend

Foram alterados:

- `src/pages/Admin/tabs/StudentsTab.tsx`;
- `src/hooks/useStudents.ts`;
- `src/services/studentService.ts`;
- `src/schemas/adminSchemas.ts`;
- `src/schemas/adminSchemas.test.ts`.

O formulário de criação não exige mais um perfil previamente cadastrado.

Agora ele solicita:

- nome completo;
- e-mail;
- data de nascimento;
- CPF opcional.

O frontend chama a Edge Function `create-student` e atualiza automaticamente a
listagem após o cadastro.

### Edge Function

A função está localizada em:

```text
supabase/functions/create-student/index.ts
```

Ela realiza:

- validação dos dados com Zod;
- validação da sessão;
- validação do vínculo institucional;
- autorização apenas para `ADMIN` e `DIRECTOR`;
- convite do usuário por e-mail;
- criação de `profile`;
- criação de `membership`;
- criação de `student`;
- retorno do RA gerado;
- remoção compensatória dos registros em caso de falha parcial.

### Tipagem do banco

Os tipos do banco foram gerados em:

```text
supabase/functions/_shared/database.types.ts
```

Como o RA é preenchido por um trigger antes da inserção, o tipo da tabela
`students` foi ajustado apenas dentro da Edge Function para permitir a omissão
de `registration_number` no `INSERT`.

O RA continua obrigatório nos registros lidos do banco.

### TypeScript e Deno

O typecheck do frontend foi separado das Edge Functions.

Arquivos envolvidos:

```text
tsconfig.json
tsconfig.app.json
package.json
supabase/functions/create-student/deno.json
supabase/functions/create-student/deno.lock
```

O frontend é validado com:

```bash
npm run typecheck
```

A Edge Function é validada separadamente com:

```powershell
deno check `
  --config .\supabase\functions\create-student\deno.json `
  .\supabase\functions\create-student\index.ts
```

## Validação atual

A última validação local apresentou:

```text
3 arquivos de teste aprovados
14 testes aprovados
TypeScript sem erros
Build de produção concluído
Deno check aprovado
```

A validação completa pode ser executada com:

```bash
npm run check
```

O build ainda apresenta um aviso não bloqueante relacionado ao tamanho do bundle
principal.

## Estado do banco de dados

O banco remoto já possui alterações aplicadas manualmente.

### Implementado no banco remoto

- políticas RLS para administradores e diretores;
- acesso institucional a perfis e vínculos;
- restrição única de RA por instituição;
- tabela `student_registration_counters`;
- função de geração de RA;
- função de preenchimento automático de RA;
- trigger de RA na tabela `students`;
- permissões restritas para funções e contador.

### Migration baseline

Existe uma migration de referência em:

```text
supabase/migrations/20260709000100_baseline_schema.sql
```

Essa migration representa o schema inicial para bancos novos.

> **Não executar `supabase db push` no banco remoto atual.**

As tabelas já existem no banco remoto e a migration baseline não faz parte do
histórico remoto original.

Ainda precisam ser criadas migrations específicas para registrar formalmente:

- políticas RLS aplicadas manualmente;
- funções de geração de RA;
- trigger de geração de RA;
- permissões e revogações;
- demais alterações realizadas diretamente no banco remoto.

## Configuração pendente no Supabase

A Edge Function local está sendo preparada para redirecionar os novos usuários
para:

```text
/set-password
```

Porém, o usuário atual não possui permissão administrativa suficiente no projeto
Supabase para concluir as configurações necessárias.

Um administrador autorizado deverá configurar:

### Secret da Edge Function

```powershell
npx supabase secrets set APP_URL=http://localhost:3000
```

Para produção, o valor deverá ser substituído pela URL real da aplicação.

### Configuração de autenticação

No Supabase Dashboard:

```text
Authentication
→ URL Configuration
```

Configurar no ambiente local:

```text
Site URL:
http://localhost:3000

Redirect URLs:
http://localhost:3000/set-password
```

A versão da Edge Function que exige `APP_URL` não deve ser publicada até que
esse secret esteja configurado.

## Pendências do fluxo de convite

Ainda falta implementar e validar:

- página `src/pages/SetPassword.tsx`;
- rota pública `/set-password`;
- definição da senha pelo usuário convidado;
- tratamento de convite inválido ou expirado;
- configuração das URLs de redirecionamento;
- configuração futura de SMTP próprio.

O convite atual já permite autenticar o aluno, mas o fluxo definitivo deve
direcioná-lo primeiro para a criação da senha.

## Dashboards

### Dashboard do aluno

O login do aluno já funciona, mas parte do conteúdo do dashboard ainda utiliza
dados simulados.

Ainda precisam ser conectados ao banco:

- nome exibido na saudação;
- disciplinas;
- horários;
- frequência;
- avaliações;
- notas;
- notificações.

### Dashboard do professor

O dashboard do professor ainda utiliza dados simulados.

Ele será conectado depois da implementação das tabelas de frequência e notas.

## Próximas etapas

Ordem planejada:

1. concluir `/set-password`;
2. registrar as alterações manuais do banco em migrations;
3. criar as tabelas de frequência;
4. criar as tabelas de avaliações e notas;
5. implementar a tela de frequência do professor;
6. implementar a tela de notas do professor;
7. conectar o dashboard do professor;
8. conectar o dashboard do aluno;
9. implementar professores e responsáveis;
10. configurar SMTP e ambiente de produção.

## Tecnologias

- React 19;
- TypeScript;
- Vite;
- Tailwind CSS;
- Supabase;
- Supabase Edge Functions;
- Deno;
- TanStack React Query;
- React Router;
- Zod;
- Vitest;
- Motion;
- Lucide React.

## Requisitos

- Node.js 22 ou superior;
- npm;
- Deno;
- acesso a um projeto Supabase;
- variáveis de ambiente do frontend.

## Configuração local

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env` com base em `.env.example`.

Inicie o frontend:

```bash
npm run dev
```

A aplicação local será disponibilizada em:

```text
http://localhost:3000
```

## Comandos de validação

Frontend, testes e build:

```bash
npm run check
```

Edge Function:

```powershell
deno check `
  --config .\supabase\functions\create-student\deno.json `
  .\supabase\functions\create-student\index.ts
```

Verificação de whitespace:

```bash
git diff --check
```

## Publicação da Edge Function

Depois que `APP_URL` e as URLs de autenticação estiverem configuradas:

```powershell
npx supabase functions deploy create-student --use-api
npx supabase functions list
```

## Segurança

- chaves administrativas não devem ser expostas no frontend;
- operações privilegiadas devem permanecer nas Edge Functions;
- autorização institucional deve utilizar `memberships`;
- o papel enviado pelo navegador nunca deve ser considerado confiável;
- a Edge Function deve validar o usuário e sua instituição;
- arquivos `.env` e outras credenciais não devem ser enviados ao Git.

## Validação antes dos commits

```powershell
deno check `
  --config .\supabase\functions\create-student\deno.json `
  .\supabase\functions\create-student\index.ts

npm run check

git diff --check

git status --short
```

## Commit do código e infraestrutura

```powershell
git add `
  .vscode `
  package.json `
  tsconfig.json `
  tsconfig.app.json `
  src/hooks/useStudents.ts `
  src/pages/Admin/tabs/StudentsTab.tsx `
  src/schemas/adminSchemas.ts `
  src/schemas/adminSchemas.test.ts `
  src/services/studentService.ts `
  supabase/config.toml `
  supabase/functions `
  supabase/migrations/20260709000100_baseline_schema.sql

git diff --cached --stat

git commit -m "feat: conclui cadastro automatizado de alunos"
```

## Commit separado da documentação

```powershell
git add README.md

git diff --cached --stat

git commit -m "docs: atualiza estado do projeto e pendencias do Supabase"
```

## Envio dos commits

```powershell
git push backup fix/estabilizar-fundacao

git status --short

git log --oneline -7
```

O `git status --short` deve terminar vazio. Caso algum arquivo já tenha sido
incluído em um commit anterior, o Git simplesmente não o adicionará novamente.
