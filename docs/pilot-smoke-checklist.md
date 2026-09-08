# Checklist de smoke para piloto

> Navegador. Usar dados reais de 1–3 escolas de teste.

---

## SUPER_ADMIN

### Login e conta

- [ ] Login com e-mail/senha funciona
- [ ] Forgot password enlace e redefine
- [ ] Dashboard da plataforma carrega corretamente

### Contas

- [ ] Lista contas com dados reais (nome, status, instituições, owner)
- [ ] Cria nova conta com dados válidos
- [ ] Erro ao criar conta com e-mail já existente
- [ ] Suspende conta ativa → instituições da conta somem do seletor
- [ ] Reativa conta suspensa → instituições voltam ao seletor
- [ ] Encerra conta → apenas histórico visível, sem ações operacionais
- [ ] Ver histórico de status da conta
- [ ] Limite de instituições: altera e persiste

### Instituições

- [ ] Cria instituição em conta ativa
- [ ] Suspende instituição → E2E: DIRECTOR perde acesso
- [ ] Reativa instituição → E2E: DIRECTOR recupera acesso
- [ ] Seleciona instituição → navega para `/admin`
- [ ] Conta cancelada: instituição não fica selecionada, vai para `/platform`
- [ ] Conta cancelada: instituição não aparece no seletor de instituições

### Branding global

- [ ] Altera branding (logo, cores) → persiste
- [ ] Branding aparece no login de qualquer conta

### Domain requests

- [ ] Domain requests visível e funcional

---

## DIRECTOR

### Login

- [ ] Login com e-mail/senha
- [ ] Dashboard do diretor carrega

### Alunos

- [ ] Cria aluno com dados válidos
- [ ] Cria aluno com CPF duplicado → erro
- [ ] Lista alunos da instituição
- [ ] Edita dados do aluno
- [ ] Não vê alunos de outra instituição

### Responsáveis

- [ ] Cria responsável vinculado a aluno
- [ ] Lista responsáveis
- [ ] Edita responsável

### Professores

- [ ] Cria professor
- [ ] Lista professores
- [ ] Edita professor

### Usuários (SchoolUsersTab)

- [ ] Convida DIRECTOR → e-mail enviado
- [ ] Convida SECRETARY
- [ ] Convida TEACHER
- [ ] Convida STUDENT
- [ ] Convida GUARDIAN
- [ ] Fluxo completo: convite → e-mail → definir senha → login

### Estrutura acadêmica

- [ ] Cria ano letivo
- [ ] Cria disciplina
- [ ] Cria turma
- [ ] Cria matriz curricular (selecionar disciplinas por etapa)
- [ ] Cria sala
- [ ] Atribui professor a disciplina/turma
- [ ] Cria horário sem sala
- [ ] Cria horário com sala
- [ ] Edita horário
- [ ] Conflito de horário: sistema detecta e informa
- [ ] Grade horária visível para professores

### Matrículas

- [ ] Matricula aluno em turma
- [ ] Lista matrículas
- [ ] Tranca/desvincula matrícula

### Fechamento de período

- [ ] Inicia fechamento de período
- [ ] Visualiza relatório de fechamento

---

## TEACHER

### Login e dashboard

- [ ] Login funciona
- [ ] Dashboard do professor carrega

### Aulas e frequência

- [ ] Visualiza próprias atribuições (turmas, disciplinas, horários)
- [ ] Registra frequência dos alunos
- [ ] Edita frequência (se permitido)
- [ ] Não vê turmas de outros professores

### Avaliações e notas

- [ ] Cria avaliação para turma
- [ ] Lança notas
- [ ] Edita notas
- [ ] Visualiza notas lançadas
- [ ] Não acessa avaliações de outros professores

### Bloqueios

- [ ] Não vê menu "Gestão institucional"
- [ ] Não acessa `/admin`
- [ ] Não vê dados de outras instituições
- [ ] Não cria/edita usuários

---

## STUDENT

### Login

- [ ] Login (definir senha após convite)
- [ ] Dashboard do aluno carrega

### Acesso

- [ ] Vê próprias notas
- [ ] Vê própria frequência
- [ ] Vê próprio boletim/relatório
- [ ] Vê própria grade horária

### Bloqueios

- [ ] Não vê dados de outros alunos
- [ ] Não acessa `/admin`
- [ ] Não acessa `/platform`
- [ ] Não cria/edita nada

---

## GUARDIAN

### Login

- [ ] Login
- [ ] Dashboard carrega

### Acesso

- [ ] Vê boletim dos dependentes
- [ ] Vê frequência dos dependentes
- [ ] Vê horário dos dependentes

### Bloqueios

- [ ] Não vê alunos não vinculados
- [ ] Não acessa `/admin`
- [ ] Não acessa `/platform`
- [ ] Não edita dados

---

## Conta suspensa

- [ ] Usuário de conta suspensa tenta login → mensagem: "Conta desativada"
- [ ] Sessão existente de conta suspensa é encerrada
- [ ] Instituições de conta suspensa não aparecem no seletor
- [ ] Instituição de conta suspensa: `profile.active` = false ou `account.status` = SUSPENDED

---

## Conta cancelada

- [ ] Conta cancelada visível na lista da plataforma (somente SUPER_ADMIN)
- [ ] Botão "Ver histórico" funciona
- [ ] Conta cancelada **não** tem botões "Encerrar conta", "Reativar", "Acessar escolas"
- [ ] Após encerramento: seleção limpa, navega para `/platform`
- [ ] Instituição da conta cancelada não aparece no seletor

---

## Cross-tenant (validação mínima)

- [ ] Ver checklist específico em `cross-tenant-smoke-checklist.md`
- [ ] Mínimo: DIRECTOR de A não acessa alunos de B
- [ ] Mínimo: TEACHER de A não vê turmas de B
- [ ] Mínimo: STUDENT de A não vê notas de B
