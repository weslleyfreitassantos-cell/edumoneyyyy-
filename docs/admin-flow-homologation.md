# Homologacao do fluxo ADMIN

Status: em andamento.

Este documento registra a primeira rodada de homologacao local do fluxo ADMIN.
Nenhum comando Supabase remoto foi executado nesta etapa.

## Escopo desta rodada

- Login e shell autenticado.
- Rota `/admin`.
- Menu lateral e seletor de instituicao.
- Abas administrativas disponiveis por papel efetivo.
- Estados de carregamento, ausencia de permissao e redirecionamento.
- Validacoes automatizadas locais.

## Resultado tecnico inicial

- Branch local: `main`.
- Servidor local: `http://localhost:3001/`.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm run test`: passou com 38 arquivos e 255 testes.
- `git status --short`: limpo antes da criacao deste documento.

## Comportamento atual observado no codigo

### ADMIN

O papel efetivo `ADMIN` tem acesso a:

- `view_school_dashboard`
- `manage_school_users`
- `view_reports`
- permissoes de conta/plataforma localizadas no modelo atual

Na tela `/admin`, isso habilita:

- Visao geral
- Frequencia
- Notas
- Fechamento
- Usuarios

O `ADMIN` nao habilita diretamente, pelo frontend atual:

- Alunos
- Professores
- Responsaveis
- Ano letivo
- Turmas
- Disciplinas
- Politica Academica
- Matriculas
- Atribuicoes

Ponto de homologacao: confirmar se esse `ADMIN` representa o dono da conta ou
se o MVP espera que ele tambem opere toda a escola.

### DIRECTOR

O papel efetivo `DIRECTOR` tem a operacao academica completa em `/admin`:

- Visao geral
- Frequencia
- Notas
- Fechamento
- Usuarios
- Alunos
- Professores
- Responsaveis
- Ano letivo
- Turmas
- Disciplinas
- Politica Academica
- Matriculas
- Atribuicoes

### SECRETARY

Na base atual, `SECRETARY` ja aparece como role real no frontend e nos testes.
Ela tem acesso operacional a:

- Visao geral
- Frequencia
- Notas
- Fechamento
- Usuarios
- Alunos
- Professores
- Responsaveis
- Matriculas

Ela nao tem acesso a:

- Ano letivo
- Turmas
- Disciplinas
- Politica Academica
- Atribuicoes

Ponto critico: confrontar isso com o schema remoto e com o historico de
migrations antes de homologar escrita real. A base local ja contem migration
para `SECRETARY`, mas o diagnostico remoto anterior ainda dizia que ela estava
ausente no banco remoto auditado.

## Checklist manual do ADMIN

- [ ] Abrir `/login`.
- [ ] Entrar com usuario ADMIN de teste.
- [ ] Confirmar redirecionamento para dashboard/conta esperado.
- [ ] Abrir `/admin`.
- [ ] Confirmar titulo "Administracao" e shell autenticado.
- [ ] Confirmar menu lateral com `Conta` e `Administracao`.
- [ ] Confirmar seletor de instituicao quando houver escola ativa.
- [ ] Trocar instituicao e confirmar que os dados mudam de escopo.
- [ ] Abrir aba `Visao geral`.
- [ ] Abrir aba `Frequencia`.
- [ ] Abrir aba `Notas`.
- [ ] Abrir aba `Fechamento`.
- [ ] Abrir aba `Usuarios`.
- [ ] Confirmar que abas academicas restritas nao aparecem para ADMIN, se esse
  for o modelo desejado.
- [ ] Confirmar estados vazios quando nao houver instituicao ativa.
- [ ] Confirmar erro amigavel quando uma query falhar.
- [ ] Confirmar logout e retorno ao login.

## Riscos encontrados

- A permissao de `ADMIN` pode estar mais restrita do que a expectativa de
  "administrador escolar" do MVP.
- `SECRETARY` ja esta habilitada no frontend atual; isso precisa bater com o
  banco remoto antes de qualquer uso real.
- O fluxo de cadastro unificado agora chama `invite-school-user`; nao e mais
  somente uma previa visual.
- Qualquer teste manual com envio de convite pode escrever no banco e chamar
  Edge Function. Executar apenas com usuarios e ambiente de teste.

## Proximos passos da homologacao

1. Validar login ADMIN com uma conta de teste.
2. Conferir se `ADMIN` deve ou nao operar toda a estrutura academica.
3. Repetir o fluxo com `DIRECTOR` para comparar comportamento.
4. Repetir em uma segunda instituicao para validar isolamento.
5. Antes de escrita real, reconciliar migrations e confirmar schema remoto.
