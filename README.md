# EduManager Pro

Sistema de gestão acadêmica desenvolvido com React, TypeScript e Supabase.

O projeto está sendo migrado de um protótipo visual para uma aplicação acadêmica real, com autenticação, autorização por perfil, persistência de dados e isolamento entre instituições.

## Estado atual

### Implementado

- autenticação com Supabase Auth;
- persistência de sessão;
- papéis de administrador, diretor, professor, aluno e responsável;
- rotas protegidas;
- bloqueio de usuários sem perfil autorizado;
- área administrativa inicial;
- painel do diretor parcialmente conectado ao banco;
- React Query para consultas e cache;
- carregamento sob demanda dos dashboards;
- testes básicos de papéis;
- validação automatizada pelo GitHub Actions.

### Em desenvolvimento

- versionamento completo do banco por migrations;
- revisão das políticas RLS;
- vínculo institucional por `memberships`;
- cadastros de professores e responsáveis;
- turmas, disciplinas e matrículas;
- painel real do professor;
- painel real do aluno;
- painel real do responsável;
- frequência;
- avaliações e notas;
- notificações;
- relatórios;
- auditoria.

## Tecnologias

- React 19;
- TypeScript;
- Vite;
- Tailwind CSS;
- Supabase;
- TanStack React Query;
- React Router;
- Vitest;
- Motion;
- Lucide React.

## Requisitos

- Node.js 22 ou superior;
- npm;
- acesso ao projeto Supabase.

Docker Desktop e WSL 2 serão necessários para alguns comandos locais do Supabase CLI, como a captura e validação do schema remoto.

## Configuração local

Instale as dependências:

```bash
npm install