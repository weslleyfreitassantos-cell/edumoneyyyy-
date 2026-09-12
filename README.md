# EduManager Pro

[![CI](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/actions/workflows/ci.yml)

Sistema web de gestão acadêmica multi-instituição desenvolvido com React,
TypeScript e Supabase.

O EduManager Pro centraliza a operação acadêmica de uma instituição: usuários,
estrutura letiva, turmas, disciplinas, matrículas, atribuições de professores e
dashboards por perfil. O projeto evoluiu de um protótipo visual para uma
aplicação integrada ao banco, com autenticação, autorização institucional,
convites por e-mail e dados reais nos painéis.

> **Estado atual:** o núcleo acadêmico está integrado ao Supabase, com fluxo
> de avaliações, notas, frequência, fechamento e boletim validado em ambiente
> local descartável. Deploy remoto, staging, backup e operação de produção
> continuam dependendo da configuração de infraestrutura correspondente.

---

## Estado atual do projeto

- multi-instituição ativo com `InstitutionContext` e `InstitutionSwitcher`;
- role efetiva em telas contextuais, priorizando `memberships.role`;
- usuários, alunos, professores e responsáveis vinculados por instituição;
- ano letivo, períodos, currículo, atribuições, grade e frequência persistidos;
- avaliações, notas e fechamento acadêmico com autorização por papel;
- boletim aberto calculado a partir de avaliações publicadas e boletim fechado
  baseado em `student_term_results`.

Documentos de readiness:

- [Auditoria read-only do banco](docs/database-readonly-audit.md)
- [SQL read-only para auditoria manual](docs/supabase-readonly-audit.sql)
- [Plano de reconciliação das migrations](docs/migration-reconciliation-plan.md)
- [Runbook de reconciliacao do baseline](docs/database-baseline-reconciliation-runbook.md)
- [Matriz de reconciliacao do schema](docs/database-schema-reconciliation-matrix.md)
- [Checklist de staging do banco](docs/staging-database-validation-checklist.md)
- [Especificação futura de convites](docs/edge-functions-user-invite-spec.md)
- [Matriz de roles](docs/roles-matrix.md)
- [Checklist de produção](docs/release-readiness-checklist.md)
- [Fluxo acadêmico de resultados](docs/academic-results-flow.md)
- [Avaliação de prontidão do MVP](docs/mvp-readiness-assessment.md)
- [Auditoria de escritas frontend](docs/frontend-write-audit.md)

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Papéis de acesso](#papéis-de-acesso)
- [Como a instituição funciona](#como-a-instituição-funciona)
- [Instituição ativa selecionada](#instituição-ativa-selecionada)
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

- **Usuários da Escola**
  - listagem de usuários vinculados à escola via `memberships` + `profiles`;
  - exibição dos papéis institucionais `ADMIN`, `DIRECTOR`, `SECRETARY`,
    `TEACHER`, `STUDENT` e `GUARDIAN`;
  - painéis especializados para Direção, Secretaria, Professores, Alunos e
    Responsáveis, além da visão global de usuários;
  - ações protegidas por membership, papel e autorização do backend.

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
- **Resultados acadêmicos**
  - avaliações com estados `DRAFT`, `PUBLISHED`, `CLOSED` e `CANCELED`;
  - notas `PENDING`, `GRADED` e `EXCUSED`;
  - fechamento por oferta e período, com reabertura justificada;
  - boletim aberto e snapshots oficiais em `student_term_results`.

- **Diretor e administrador**
  - indicadores institucionais;
  - ano letivo e período atuais;
  - pendências acadêmicas;
  - resumo de alunos, professores, turmas, disciplinas, matrículas e
    atribuições.

Os dashboards exibem dados persistidos e autorizados pelo schema atual. O
fechamento acadêmico congela o resultado oficial até uma reabertura autorizada.

---

## Papéis de acesso

| Papel      | Escopo atual                                                |
| ---------- | ----------------------------------------------------------- |
| `ADMIN`     | Proprietário da conta e gestão administrativa não acadêmica             |
| `DIRECTOR`  | Gestão acadêmica e operacional da instituição                           |
| `SECRETARY` | Operação acadêmica autorizada da instituição                           |
| `TEACHER`   | Próprias atribuições, turmas, avaliações, notas e frequência             |
| `STUDENT`   | Próprios dados, matrícula, agenda, resultados e materiais autorizados    |
| `GUARDIAN`  | Alunos vinculados e seus resultados autorizados                          |
| `SUPER_ADMIN` | Administração da plataforma, quando habilitado                         |

`ADMIN` mantém a propriedade comercial da conta, mas não substitui `DIRECTOR`
ou `SECRETARY` nas operações acadêmicas da escola. A autorização efetiva é
avaliada no banco e considera membership ativa, instituição e perfil ativo.

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

---

## Instituição ativa selecionada

O frontend possui a base de seleção de instituição ativa para preparar o uso
multi-instituição. A seleção usa os vínculos ativos de `memberships` combinados
com instituições ativas em `institutions`.

Comportamento atual:

- se o usuário tiver uma escola ativa, ela é selecionada automaticamente;
- se o usuário tiver múltiplas escolas ativas, o sistema tenta restaurar a
  última escola escolhida;
- se a escolha salva não existir mais, a primeira escola ativa é selecionada;
- se o usuário não tiver escola ativa, as telas exibem orientação sem quebrar a
  aplicação.

A escolha é persistida no `localStorage` com a chave
`edumanager.currentInstitutionId.{profileId}`. Apenas o ID da escola é salvo;
nenhum dado sensível é gravado no navegador.

As telas administrativas e o dashboard compartilhado de `ADMIN`/`DIRECTOR`
exibem o seletor de escola. As consultas acadêmicas continuam usando
`institution_id`, agora vindo da instituição selecionada no contexto.
Nas telas administrativas seguras, permissões e rótulos já usam a role efetiva
da instituição ativa, priorizando `memberships.role` e mantendo `profiles.role`
como fallback temporário.

Essa entrega cria a base frontend da seleção de instituição ativa. O fluxo
multi-instituição ainda requer homologação, revisão de RLS e evolução futura das
permissões por `memberships.role`.

---

## Fluxos principais

### Preparação acadêmica

```text
Ano letivo
→ Período
→ Política acadêmica
→ Turma
→ Disciplina
→ Professor
→ Aluno
→ Matrícula
→ Atribuição
→ Grade
→ Frequência
→ Avaliações
→ Notas
→ Fechamento
→ Boletim
```

O fluxo de resultados está detalhado em
[docs/academic-results-flow.md](docs/academic-results-flow.md).

### Cadastro de aluno

```text
DIRECTOR/SECRETARY
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
DIRECTOR/SECRETARY
→ informa nome e e-mail
→ frontend chama create-teacher
→ usuário recebe convite
→ profile TEACHER é criado
→ membership TEACHER é criado
→ professor pode receber atribuições
```

### Cadastro de responsável

```text
DIRECTOR/SECRETARY
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
| `assessments`                   | Avaliações da oferta e do período              |
| `grades`                        | Notas dos alunos nas avaliações                |
| `academic_policies`             | Regras de aprovação e arredondamento           |
| `term_closures`                  | Estado de revisão e fechamento                 |
| `student_term_results`           | Resultado oficial congelado                    |
| `student_registration_counters` | Sequência institucional de RA                  |

Relações centrais:

```text
Aluno + Turma + Ano letivo
→ enrollment

Professor + Disciplina + Turma + Período
→ subject_offering

Avaliações + Notas + Frequência + Política
→ fechamento do período
→ student_term_results

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
git clone https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git
cd edumoneyyyy-
git checkout main
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
20260710000200_attendance_and_grades.sql
20260710000300_attendance_and_grades_rls.sql
20260710000400_attendance_and_grades_integrity.sql
20260712000300_term_closing_report_cards.sql
20260911000600_academic_results_hardening.sql
```

As migrations de resultados acadêmicos são forward-only. A migration de
hardening adiciona bloqueios em nível de banco para impedir alterações
incompatíveis em avaliações, notas e resultados depois do fechamento.

O reset e o diff foram validados em um projeto Supabase local descartável. O
banco remoto não é alterado por `npm run check`; aplicações remotas devem seguir
o processo de release e backup do ambiente correspondente.

> **Não execute `supabase migration repair` para corrigir comportamento de
> aplicação.** Use repair somente quando a equipe de banco tiver evidência do
> histórico remoto e um plano de reconciliação aprovado.

O fluxo técnico de avaliações, notas, frequência, fechamento e boletim está em
[docs/academic-results-flow.md](docs/academic-results-flow.md).

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
- a criação da instituição e do primeiro administrador depende do fluxo de
  onboarding configurado no ambiente;
- não há seletor para usuários vinculados a várias instituições;
- `profiles.role` ainda participa do roteamento global em pontos legados;
- as Edge Functions dependem da configuração de runtime do ambiente;
- é necessário configurar SMTP e URLs de produção;
- staging, backup/restore e observabilidade de produção devem ser comprovados
  no ambiente operacional.

Próximos passos planejados:

- configurar e validar staging;
- comprovar backup/restore e observabilidade;
- homologar o fluxo de convite e definição de senha com SMTP do ambiente;
- completar a cobertura E2E dos fluxos operacionais restantes.

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
| Isolamento institucional      | Implementado; validado nos cenários locais |
| Administração acadêmica       | Implementado                         |
| Convites de usuários          | Implementado                         |
| Dashboards com dados reais    | Implementado                         |
| Testes frontend               | Implementado                         |
| CI de frontend                | Implementado                         |
| CI de Edge Functions          | Conforme workflows configurados       |
| Notas, frequência e boletim   | Fluxo implementado e validado localmente |
| Gestão global de instituições | Pendente                             |
| Produção                      | Depende de staging e operação comprovados |
| Homologação                   | Disponível                           |

---

Desenvolvido como uma base para gestão acadêmica institucional, com foco em
separação de responsabilidades, preservação de histórico e segurança
multi-tenant.

## Estado do banco

O schema versionado inclui o núcleo acadêmico, avaliações, notas, frequência,
fechamento e snapshots de boletim. O estado remoto deve ser verificado pelo
runbook de release antes de cada aplicação; esta documentação não substitui a
confirmação de deploy, backup ou migração no ambiente de produção.
