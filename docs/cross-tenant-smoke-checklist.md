# Plano de validação cross-tenant

> Pré-requisito: duas instituições configuradas (Instituição A e B) com ao menos um DIRECTOR em cada.

---

## 1. Estrutura escolar

### Anos letivos

- [ ] Usuário A cria ano letivo na Instituição A
- [ ] Usuário B **não vê** o ano letivo de A
- [ ] Usuário A **não vê** o ano letivo de B
- [ ] Usuário B **não consegue editar** o ano letivo de A via RLS ou URL

### Disciplinas

- [ ] Usuário A cria disciplina na Instituição A
- [ ] Usuário B **não acessa** disciplina de A
- [ ] Usuário A **não acessa** disciplina de B
- [ ] Usuário B **não consegue editar** disciplina de A

### Turmas

- [ ] Usuário A cria turma na Instituição A
- [ ] Usuário B **não vê** turma de A
- [ ] Usuário A **não vê** turma de B

### Matriz curricular

- [ ] Usuário A cria matriz na Instituição A
- [ ] Usuário B **não acessa** matriz de A

### Atribuições de professor

- [ ] Atribuição criada na Instituição A só afeta A
- [ ] Professor de A não vê turmas de B

### Salas

- [ ] Sala criada em A não aparece em B
- [ ] Editar sala de A via URL de B é bloqueado

### Grade horária

- [ ] Horário de A não afeta B
- [ ] Conflito de horário em A não afeta B

---

## 2. Pessoas

### Usuários

- [ ] Usuário cadastrado em A não aparece na lista de B
- [ ] SUPER_ADMIN vê todos (via PlatformPage)
- [ ] DIRECTOR de A não vê usuários de B

### Alunos

- [ ] Aluno de A não aparece em B
- [ ] Aluno de A não pode ser matriculado em B
- [ ] Aluno visualiza próprios dados, não de outros

### Responsáveis

- [ ] Responsável de A vê apenas alunos vinculados
- [ ] Responsável de A não vê alunos de B

### Matrículas

- [ ] Matrícula em A não afeta B
- [ ] Aluno de A não pode ser matriculado em turma de B

---

## 3. Acadêmico

### Frequência

- [ ] Professor de A registra frequência apenas de seus alunos
- [ ] Professor de B não vê frequência de A
- [ ] Aluno de A vê própria frequência
- [ ] Aluno de A não vê frequência de B

### Avaliações

- [ ] Avaliação criada em A não aparece em B
- [ ] Nota de A não aparece em B
- [ ] Aluno de A vê própria nota
- [ ] Aluno de A não vê nota de B
- [ ] DIRECTOR de A não vê avaliações de B

### Notas / boletim

- [ ] Boletim de A só contém dados de A
- [ ] Responsável de B vê boletim apenas de seus dependentes

---

## 4. Plataforma

### Contas

- [ ] SUPER_ADMIN vê todas as contas
- [ ] Account owner vê apenas própria conta
- [ ] Conta cancelada visível apenas como histórico

### Instituições

- [ ] SUPER_ADMIN vê todas as instituições
- [ ] Account owner vê apenas instituições da própria conta
- [ ] DIRECTOR vê apenas instituição onde tem membership

### Branding

- [ ] Branding de A não aparece em B
- [ ] Branding global aparece para todos (se configurado)
- [ ] Editar branding de A não afeta B

---

## 5. Acessos indevidos (testes de segurança)

### Via URL

- [ ] Usuário A não acessa `/admin?module=subjects` com ID de B na URL
- [ ] Usuário A não acessa painel de B alterando `institutionId` no query param
- [ ] Usuário B não acessa `/platform` (rota SUPER_ADMIN)

### Via API

- [ ] Usuário A não consulta dados de B via Supabase client (RLS bloqueia)
- [ ] Usuário A não modifica dados de B via mutation

### Via Edge Function

- [ ] Invite de A não cria usuário em B
- [ ] Ação de SUPER_ADMIN em A não afeta B indevidamente

---

## 6. Metodologia

### Usuários de teste sugeridos

| ID | Papel | Instituição |
|----|-------|-------------|
| U-A1 | DIRECTOR | A |
| U-A2 | TEACHER | A |
| U-A3 | STUDENT | A |
| U-B1 | DIRECTOR | B |
| U-B2 | TEACHER | B |
| U-B3 | STUDENT | B |
| U-SUPER | SUPER_ADMIN | Global |

### Validação

Para cada item acima:
1. Logar como usuário A
2. Criar/consultar recurso na Instituição A
3. Logar como usuário B
4. Tentar acessar o mesmo recurso
5. Confirmar que RLS retorna vazio ou erro de permissão

### Registro

Usar tabela:

| # | Recurso | Ação | Usuário A vê | Usuário B vê | RLS ok? |
|---|---------|------|-------------|-------------|---------|
| 1 | Disciplina "Matemática" em A | SELECT | ✓ | ✗ | ✓ |
