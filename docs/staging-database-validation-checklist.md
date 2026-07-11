# Checklist de validacao de banco em staging

Este checklist prepara a validacao de baseline, migrations incrementais e
hardening de RLS em um projeto Supabase separado. Ele nao cria staging, nao
executa SQL e nao executa Supabase CLI.

## Antes

- [ ] Projeto staging separado do remoto principal.
- [ ] Secrets separados para staging.
- [ ] URLs e redirects separados.
- [ ] Backup/export planejado antes de qualquer escrita futura.
- [ ] Migrations locais revisadas.
- [ ] Matriz de reconciliacao revisada.
- [ ] Candidato de RLS revisado.
- [ ] Usuarios de teste definidos.
- [ ] Roles de teste definidas: `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT`,
  `GUARDIAN`.
- [ ] Membership ativa para cada papel de teste.
- [ ] Membership inativa para teste negativo.
- [ ] Usuario sem membership para teste negativo.
- [ ] Usuario de outra instituicao para teste de isolamento.
- [ ] Dados de escola, turma, disciplina, ano letivo, periodo, aluno,
  responsavel, matricula e atribuicao preparados.

## Durante

- [ ] Aplicar baseline aprovado em staging.
- [ ] Validar schema.
- [ ] Validar tabelas do nucleo escolar.
- [ ] Validar enum `public.user_role`.
- [ ] Validar `students.profile_id` obrigatorio.
- [ ] Validar funcoes de RA.
- [ ] Validar trigger `students_generate_registration_number`.
- [ ] Validar constraints.
- [ ] Validar indices.
- [ ] Aplicar migration incremental aprovada.
- [ ] Validar policies.
- [ ] Validar functions.
- [ ] Validar triggers.
- [ ] Validar grants e privileges.
- [ ] Aplicar candidato de RLS somente se aprovado para staging.
- [ ] Confirmar que revogacao de `anon` em funcoes auxiliares continua
  opcional e testada separadamente.

## Testes por papel

- [ ] `ADMIN` ativo acessa painel administrativo.
- [ ] `ADMIN` ativo ve usuarios da escola.
- [ ] `ADMIN` ativo ve usuarios/memberships inativas para gestao.
- [ ] `DIRECTOR` ativo acessa escopo administrativo esperado.
- [ ] `TEACHER` ativo acessa turmas e atribuicoes esperadas.
- [ ] `STUDENT` ativo acessa seus dados.
- [ ] `GUARDIAN` ativo acessa alunos vinculados.
- [ ] Usuario com membership inativa nao acessa dados institucionais.
- [ ] Usuario sem membership nao acessa dados institucionais.
- [ ] Usuario de outra instituicao nao ve dados cruzados.

## Fluxos

- [ ] Login.
- [ ] Troca de instituicao.
- [ ] Listagem de alunos.
- [ ] Listagem de professores.
- [ ] Listagem de responsaveis.
- [ ] Matricula.
- [ ] Atribuicao.
- [ ] Dashboard de admin/diretor.
- [ ] Dashboard de professor.
- [ ] Dashboard de aluno.
- [ ] Dashboard de responsavel.
- [ ] Gestao de usuarios inativos.
- [ ] Cadastro visual continua sem escrita real quando o fluxo estiver
  bloqueado.

## Depois

- [ ] `npm run check`.
- [ ] Auditoria de policies.
- [ ] Auditoria de funcoes.
- [ ] Auditoria de RLS.
- [ ] Auditoria de constraints.
- [ ] Auditoria de dados.
- [ ] Validacao de memberships ativas/inativas.
- [ ] Validacao de isolamento entre instituicoes.
- [ ] Plano de rollback validado.
- [ ] Evidencias de staging registradas sem dados sensiveis.
