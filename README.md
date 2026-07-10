# EduManager Pro

[![CI](https://github.com/SamDevlab/base/actions/workflows/ci.yml/badge.svg?branch=fix%2Festabilizar-fundacao)](https://github.com/SamDevlab/base/actions/workflows/ci.yml)

Sistema web de gestão acadêmica multi-instituição desenvolvido com React,
TypeScript e Supabase.

O EduManager Pro centraliza a operação acadêmica de uma instituição: usuários,
estrutura letiva, turmas, disciplinas, matrículas, atribuições de professores e
dashboards por perfil. O projeto evoluiu de um protótipo visual para uma
aplicação integrada ao banco, com autenticação, autorização institucional,
convites por e-mail e dados reais nos painéis.

> **Estado atual:** pronto para homologação funcional. Ainda requer revisão
> final de RLS, reconciliação das migrations, configuração de produção e testes
> end-to-end antes de uso em produção.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Papéis de acesso](#papéis-de-acesso)
- [Como a instituição funciona](#como-a-instituição-funciona)
- [Fluxos principais](#fluxos-principais)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Modelo acadêmico](#modelo-acadêmico)
- [Configuração local](#configuração-local)
- [Comandos disponíveis](#comandos-disponíveis)
- [Edge Functions](#edge-functions)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Validação e CI](#validação-e-ci)
- [Segurança](#segurança)
- [Limitações atuais](#limitações-atuais)
- [Roteiro de homologação](#roteiro-de-homologação)

---

## Funcionalidades

### Autenticação e acesso

- autenticação com Supabase Auth;
- persistência de sessão;
- login por e-mail e senha;
- fluxo público para definição de senha após convite;
- rotas protegidas;
- página de acesso não autorizado;
- carregamento do dashboard conforme o papel do usuário;
- separação dos dados por instituição.

### Administração acadêmica

A rota `/admin` está disponível para `ADMIN` e `DIRECTOR` e possui os seguintes
módulos:

- **Visão geral**
  - alunos ativos e inativos;
  - professores e responsáveis ativos;
  - turmas, disciplinas, matrículas e atribuições ativas;
  - ano letivo e período atuais;
  - avisos de pendências acadêmicas.

- **Alunos**
  - cadastro com convite por e-mail;
  - criação automática de perfil e vínculo institucional;
  - geração automática de RA;
  - edição dos dados acadêmicos;
  - ativação e desativação lógica.

- **Professores**
  - cadastro com convite por e-mail;
  - criação automática de perfil `TEACHER`;
  - vínculo à instituição;
  - ativação e desativação do vínculo.

- **Responsáveis**
  - cadastro com convite por e-mail;
  - criação de perfil `GUARDIAN`;
  - vínculo com um ou mais alunos;
  - definição de parentesco;
  - indicação de responsável principal;
  - ativação e desativação de vínculos.

- **Ano letivo e períodos**
  - criação e edição;
  - datas de início e fim;
  - ativação e desativação;
  - identificação do ano e período atuais;
  - validação de intervalos.

- **Turmas**
  - cadastro por instituição e ano letivo;
  - série ou nível;
  - turno;
  - capacidade;
  - contagem de matrículas e ofertas;
  - ativação e desativação.

- **Disciplinas**
  - nome e código;
  - carga horária;
  - contagem de ofertas;
  - ativação e desativação.

- **Matrículas**
  - criação;
  - filtros por aluno, turma, ano e status;
  - cancelamento e reativação sem apagar histórico;
  - transferência entre turmas;
  - validação de capacidade;
  - prevenção de matrícula ativa duplicada.

- **Atribuições**
  - vínculo entre professor, disciplina, turma e período;
  - filtros por professor, turma, disciplina, período e status;
  - prevenção de atribuição ativa duplicada;
  - ativação e desativação;
  - atualização dos dados exibidos no dashboard do professor.

### Dashboards

- **Professor**
  - ofertas acadêmicas ativas;
  - turmas e disciplinas atribuídas;
  - carga horária;
  - quantidade de alunos matriculados;
  - estado vazio quando não houver atribuições.

- **Aluno**
  - perfil e RA;
  - matrícula ativa;
  - turma e ano letivo;
  - disciplinas ofertadas;
  - professores responsáveis.

- **Responsável**
  - alunos vinculados;
  - RA;
  - turma e ano letivo;
  - disciplinas da turma;
  - alternância entre alunos vinculados.

- **Diretor e administrador**
  - indicadores institucionais;
  - ano letivo e período atuais;
  - pendências acadêmicas;
  - resumo de alunos, professores, turmas, disciplinas, matrículas e
    atribuições.

Os dashboards exibem somente dados disponíveis no schema atual. Notas,
frequência e agenda não são simuladas.

---

## Papéis de acesso

| Papel      | Escopo atual                                                |
| ---------- | ----------------------------------------------------------- |
| `ADMIN`    | Administração acadêmica e operacional da instituição        |
| `DIRECTOR` | Gestão acadêmica da instituição                             |
| `TEACHER`  | Visualização das próprias atribuições, turmas e disciplinas |
| `STUDENT`  | Visualização dos próprios dados e da matrícula              |
| `GUARDIAN` | Visualização dos alunos vinculados                          |

No estado atual, `ADMIN` e `DIRECTOR` possuem acesso semelhante aos módulos
acadêmicos de `/admin`. A separação futura pode reservar configurações técnicas,
permissões e integrações somente ao administrador.

Não existe ainda um papel global de plataforma como `SUPER_ADMIN`.

---

## Como a instituição funciona

A instituição representa a escola ou unidade acadêmica e atua como o tenant do
sistema.

```text
Instituição
├── usuários e memberships
├── alunos
├── responsáveis
├── anos letivos
│   └── períodos
├── turmas
├── disciplinas
├── matrículas
└── atribuições de professores
```

Os usuários são armazenados em `profiles`, enquanto `memberships` define:

- a instituição do usuário;
- o papel naquela instituição;
- se o vínculo está ativo.

```text
profile
└── membership
    ├── institution_id
    ├── role
    └── active
```

Os serviços do frontend obtêm a instituição atual pelo membership ativo e
filtram as operações pelo `institution_id`.

> A interface atual espera uma instituição ativa por usuário. O banco suporta
> múltiplos memberships, mas ainda não existe seletor de instituição.

---

## Fluxos principais

### Preparação acadêmica

```text
Ano letivo
→ Período
→ Turma
→ Disciplina
→ Professor
→ Aluno
→ Matrícula
→ Atribuição
→ Dashboards
```

### Cadastro de aluno

```text
ADMIN/DIRECTOR
→ informa nome, e-mail, nascimento e CPF
→ frontend chama create-student
→ Edge Function valida sessão e instituição
→ usuário é convidado no Supabase Auth
→ profile STUDENT é criado
→ membership STUDENT é criado
→ registro em students é criado
→ trigger gera o RA
→ listagem é atualizada
```

### Cadastro de professor

```text
ADMIN/DIRECTOR
→ informa nome e e-mail
→ frontend chama create-teacher
→ usuário recebe convite
→ profile TEACHER é criado
→ membership TEACHER é criado
→ professor pode receber atribuições
```

### Cadastro de responsável

```text
ADMIN/DIRECTOR
→ informa nome e e-mail
→ seleciona um ou mais alunos
→ informa parentesco e vínculo principal
→ frontend chama create-guardian
→ profile GUARDIAN é criado
→ membership GUARDIAN é criado
→ guardianships são criados
```

---

## Tecnologias

### Frontend

- React 19;
- TypeScript;
- Vite;
- React Router;
- TanStack React Query;
- Tailwind CSS;
- Motion;
- Lucide React;
- Zod;
- Vitest;
- Testing Library.

### Backend e infraestrutura

- Supabase Auth;
- PostgreSQL;
- Row Level Security;
- Supabase Edge Functions;
- Deno;
- Supabase CLI;
- GitHub Actions.

---

## Arquitetura

O frontend segue a separação:

```text
Componente/aba
→ hook React Query
→ service Supabase
→ banco ou Edge Function
```

Estrutura principal:

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── components/          # layout, tabelas e dashboards
│   ├── contexts/            # autenticação e sessão
│   ├── hooks/               # queries e mutations
│   ├── lib/                 # cliente Supabase e papéis
│   ├── pages/
│   │   └── Admin/
│   │       └── tabs/        # módulos administrativos
│   ├── schemas/             # validação Zod
│   ├── services/            # acesso a dados e regras de integração
│   └── types.ts
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   ├── create-student/
│   │   ├── create-teacher/
│   │   └── create-guardian/
│   ├── migrations/
│   └── config.toml
├── .env.example
├── package.json
├── tsconfig.app.json
└── vite.config.ts
```

As consultas e mutações utilizam chaves específicas do React Query e invalidam
os módulos relacionados após alterações acadêmicas.

---

## Modelo acadêmico

Principais tabelas:

| Tabela                          | Responsabilidade                               |
| ------------------------------- | ---------------------------------------------- |
| `institutions`                  | Escolas ou unidades acadêmicas                 |
| `profiles`                      | Perfil global do usuário                       |
| `memberships`                   | Papel e vínculo do usuário com uma instituição |
| `academic_years`                | Anos letivos                                   |
| `terms`                         | Períodos, bimestres ou semestres               |
| `students`                      | Registro acadêmico e RA do aluno               |
| `guardianships`                 | Relação entre responsável e aluno              |
| `classes`                       | Turmas                                         |
| `subjects`                      | Disciplinas                                    |
| `enrollments`                   | Matrícula do aluno em turma e ano letivo       |
| `subject_offerings`             | Professor + disciplina + turma + período       |
| `student_registration_counters` | Sequência institucional de RA                  |

Relações centrais:

```text
Aluno + Turma + Ano letivo
→ enrollment

Professor + Disciplina + Turma + Período
→ subject_offering

Responsável + Aluno
→ guardianship
```

---

## Configuração local

### Requisitos

- Node.js 22;
- npm;
- acesso a um projeto Supabase;
- Deno 2 para validar Edge Functions;
- Supabase CLI para desenvolvimento e deploy das funções.

### 1. Clone o repositório

```bash
git clone https://github.com/SamDevlab/base.git
cd base
git checkout fix/estabilizar-fundacao
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o ambiente

No PowerShell:

```powershell
Copy-Item .env.example .env
```

No bash:

```bash
cp .env.example .env
```

Preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

Use apenas a chave publicável no frontend. A `service_role` nunca deve ser
exposta no navegador.

### 4. Inicie a aplicação

```bash
npm run dev
```

Endereço padrão:

```text
http://localhost:3000
```

Caso a porta esteja ocupada, o Vite pode ser iniciado manualmente em outra
porta:

```bash
npx vite --port 3001 --host 0.0.0.0
```

---

## Comandos disponíveis

| Comando              | Descrição                            |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Inicia o servidor de desenvolvimento |
| `npm run build`      | Gera o build de produção             |
| `npm run preview`    | Abre o build localmente              |
| `npm run typecheck`  | Valida o frontend com TypeScript     |
| `npm run test`       | Executa os testes uma vez            |
| `npm run test:watch` | Executa os testes em modo watch      |
| `npm run check`      | Executa typecheck, testes e build    |
| `npm run clean`      | Remove o diretório `dist`            |

Validação recomendada antes de commit:

```bash
npm run check
git diff --check
git status --short
```

---

## Edge Functions

O projeto possui três funções privilegiadas:

```text
create-student
create-teacher
create-guardian
```

Cada função:

- aceita requisição autenticada;
- valida o payload com Zod;
- verifica membership ativo;
- autoriza somente `ADMIN` ou `DIRECTOR` da mesma instituição;
- usa o cliente administrativo apenas no servidor;
- cria o usuário no Supabase Auth;
- cria `profile` e `membership`;
- cria o registro acadêmico específico;
- realiza remoção compensatória em falhas parciais.

### Validação com Deno

PowerShell:

```powershell
deno check `
  --config .\supabase\functions\create-student\deno.json `
  .\supabase\functions\create-student\index.ts

deno check `
  --config .\supabase\functions\create-teacher\deno.json `
  .\supabase\functions\create-teacher\index.ts

deno check `
  --config .\supabase\functions\create-guardian\deno.json `
  .\supabase\functions\create-guardian\index.ts
```

### Deploy

```powershell
npx supabase functions deploy create-student `
  --project-ref SEU_PROJECT_REF

npx supabase functions deploy create-teacher `
  --project-ref SEU_PROJECT_REF

npx supabase functions deploy create-guardian `
  --project-ref SEU_PROJECT_REF
```

### Redirecionamento de convites

Para direcionar convidados à tela de definição de senha, configure:

```text
APP_URL=https://sua-aplicacao.com
```

No Supabase Auth, permita:

```text
https://sua-aplicacao.com/set-password
```

Para ambiente local:

```text
http://localhost:3000/set-password
```

---

## Banco de dados e migrations

O diretório `supabase/migrations` contém:

```text
20260709000100_baseline_schema.sql
20260710000200_attendance_and_grades.sql
20260710000300_attendance_and_grades_rls.sql
20260710000400_attendance_and_grades_integrity.sql
```

### Atenção ao banco remoto atual

> **Não execute `supabase db push`, `supabase db reset` ou
> `supabase migration repair` no projeto remoto atual sem reconciliar o
> histórico de migrations.**

O banco remoto já possuía tabelas e alterações aplicadas antes da criação da
migration baseline. Aplicar a baseline diretamente pode tentar recriar objetos
existentes ou produzir um histórico inconsistente.

A sequência segura é:

1. gerar um inventário do schema remoto;
2. comparar com as migrations versionadas;
3. registrar as alterações manuais;
4. reconciliar o histórico;
5. testar em um ambiente descartável;
6. somente depois aplicar em produção.

As migrations de avaliações, notas e frequência estão versionadas, mas esses
módulos ainda não são utilizados pelos dashboards atuais.

---

## Validação e CI

O workflow `.github/workflows/ci.yml` executa em pushes e pull requests:

```text
npm ci
npm run check
```

O job utiliza Node.js 22 e variáveis públicas fictícias do Supabase para
permitir typecheck, testes e build sem credenciais reais.

`npm run check` executa:

```text
TypeScript
→ Vitest
→ Vite build
```

A validação das Edge Functions com Deno ainda deve ser executada localmente. Um
job dedicado para Deno é uma melhoria recomendada para o CI.

O Vite pode emitir aviso de chunk principal acima de 500 kB. O aviso não
bloqueia o build, mas indica oportunidade futura de divisão adicional do bundle.

---

## Segurança

Princípios aplicados:

- credenciais administrativas ficam fora do frontend;
- a chave `service_role` é usada somente em Edge Functions;
- operações privilegiadas validam o usuário autenticado;
- `institution_id` enviado pelo navegador não é confiado sem validação;
- `memberships` determina instituição e papel;
- RLS limita consultas e alterações no banco;
- desativação lógica preserva histórico acadêmico;
- arquivos `.env` não devem ser versionados;
- relações Supabase são normalizadas quando podem retornar objeto, lista ou
  `null`.

Revisões ainda recomendadas antes de produção:

- teste sistemático de isolamento entre duas instituições;
- auditoria completa das políticas RLS;
- testes de autorização para todos os papéis;
- proteção contra duplicidades em nível de banco;
- configuração de SMTP próprio;
- política de backup e recuperação;
- logs e trilha de auditoria.

---

## Limitações atuais

- não há interface de `SUPER_ADMIN` para cadastrar instituições;
- a criação da instituição e do primeiro administrador ainda depende de
  onboarding técnico;
- não há seletor para usuários vinculados a várias instituições;
- `profiles.role` ainda participa do roteamento, enquanto o papel institucional
  vive em `memberships`;
- notas, frequência e agenda ainda não estão expostas no frontend;
- as migrations do banco remoto precisam ser reconciliadas;
- as Edge Functions ainda não são verificadas pelo GitHub Actions;
- é necessário configurar SMTP e URLs de produção;
- o projeto ainda precisa de homologação multi-instituição antes de produção.

---

## Roteiro de homologação

Execute o fluxo com contas e e-mails de teste:

1. criar um ano letivo;
2. criar um período;
3. criar uma turma;
4. criar uma disciplina;
5. cadastrar um professor;
6. cadastrar um aluno;
7. matricular o aluno na turma;
8. atribuir professor, disciplina, turma e período;
9. abrir o dashboard do professor;
10. abrir o dashboard do aluno;
11. cadastrar um responsável;
12. vincular o responsável ao aluno;
13. abrir o dashboard do responsável;
14. testar cancelamento e reativação de matrícula;
15. testar transferência de turma;
16. desativar e reativar uma atribuição;
17. repetir os testes com uma segunda instituição;
18. confirmar que usuários da instituição A não acessam dados da instituição B.

---

## Status resumido

| Área                          | Status                               |
| ----------------------------- | ------------------------------------ |
| Autenticação e sessão         | Implementado                         |
| Autorização por papel         | Implementado                         |
| Isolamento institucional      | Implementado; requer auditoria final |
| Administração acadêmica       | Implementado                         |
| Convites de usuários          | Implementado                         |
| Dashboards com dados reais    | Implementado                         |
| Testes frontend               | Implementado                         |
| CI de frontend                | Implementado                         |
| CI de Edge Functions          | Pendente                             |
| Notas e frequência            | Schema versionado; frontend pendente |
| Gestão global de instituições | Pendente                             |
| Produção                      | Ainda não recomendada                |
| Homologação                   | Disponível                           |

---

Desenvolvido como uma base para gestão acadêmica institucional, com foco em
separação de responsabilidades, preservação de histórico e segurança
multi-tenant.
