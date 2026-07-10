# Especificacao futura de Edge Functions para convites

Esta especificacao e planejamento. Nenhuma Edge Function real foi alterada
nesta entrega.

## Dependencias antes de implementar

- Reconciliacao de migrations.
- Confirmacao de roles atuais e futuras.
- Fluxo Auth seguro.
- `APP_URL`, redirects, SMTP e secrets corretos.
- Testes em staging.
- Logs e trilha de auditoria.

## Estado remoto confirmado pela auditoria

- Roles ativas no enum remoto: `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT` e
  `GUARDIAN`.
- `SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` seguem apenas planejadas.
- `students.profile_id` e obrigatorio, e `profiles.id` referencia
  `auth.users.id`; aluno sem login precisa de migration futura.
- `generate_student_registration_number` e `set_student_registration_number`
  estao protegidas para `service_role`; usuarios comuns nao devem chamar RA
  diretamente.
- `is_institution_admin` e `can_view_institution_profile` consideram
  `ADMIN`/`DIRECTOR`, mas precisam de hardening para `membership.active is true`.
- Cadastro real continua bloqueado ate reconciliacao de migrations, hardening de
  RLS e revisao das Edge Functions em staging.

## Edge Functions existentes

### create-student

Status atual: implementada, nao alterada nesta entrega.

Hoje recebe dados basicos do aluno, valida usuario autenticado, verifica
membership `ADMIN` ou `DIRECTOR`, chama Auth Admin, cria `profile`,
`membership` e `students`, com limpeza compensatoria em falhas.

### create-teacher

Status atual: implementada, nao alterada nesta entrega.

Hoje recebe dados basicos do professor, valida usuario autenticado, verifica
membership `ADMIN` ou `DIRECTOR`, chama Auth Admin e cria `profile` e
`membership`.

### create-guardian

Status atual: implementada, nao alterada nesta entrega.

Hoje recebe dados do responsavel e vinculos de alunos, valida usuario
autenticado, verifica membership `ADMIN` ou `DIRECTOR`, chama Auth Admin, cria
ou reativa `profile`/`membership` e escreve `guardianships`.

## Funcoes planejadas

### create-school-user-invite

- Objetivo: criar convite unificado para usuario da escola.
- Input esperado: institution_id, target_type, nome, e-mail opcional,
  telefone opcional, campos especificos por tipo.
- Validacoes: sessao, membership ativo, permissao `manage_school_users`, role
  permitida, instituicao ativa, e-mail unico quando houver login.
- Permissoes necessarias: `ADMIN` ou `DIRECTOR` atuais; futuramente
  `SCHOOL_ADMIN` e talvez `SECRETARY` com escopo limitado.
- Tabelas envolvidas: `profiles`, `memberships`, tabelas futuras de convites,
  `students`, `guardianships`, se aplicavel.
- Escrita esperada: convite pendente e registros controlados.
- Riscos: duplicidade de usuario, convite para instituicao errada, role futura
  sem suporte no banco.
- Logs/auditoria: autor, instituicao, alvo, e-mail mascarado, status, erro.
- Status atual: planejado, nao implementado.

### accept-school-user-invite

- Objetivo: concluir aceite de convite e definicao de acesso.
- Input esperado: token seguro, senha quando aplicavel, aceite de termos.
- Validacoes: token valido, expiracao, status pendente, instituicao ativa.
- Permissoes necessarias: token de convite valido.
- Tabelas envolvidas: Auth, `profiles`, `memberships`, convites futuros.
- Escrita esperada: ativacao de acesso e marca de aceite.
- Riscos: replay de token, token vazado, expiracao ignorada.
- Logs/auditoria: token hash, status, IP quando disponivel, user id.
- Status atual: planejado, nao implementado.

### create-director

- Objetivo: criar diretor com role atual `DIRECTOR`.
- Input esperado: institution_id, nome, e-mail.
- Validacoes: admin escolar autorizado, e-mail unico, instituicao ativa.
- Permissoes necessarias: `ADMIN`; futuramente `SCHOOL_ADMIN` ou
  `SUPER_ADMIN` conforme escopo.
- Tabelas envolvidas: Auth, `profiles`, `memberships`.
- Escrita esperada: usuario Auth, profile e membership `DIRECTOR`.
- Riscos: elevacao indevida de privilegio.
- Logs/auditoria: criador, instituicao, usuario criado, role.
- Status atual: planejado, nao implementado.

### create-secretary

- Objetivo: criar secretaria escolar futura.
- Input esperado: institution_id, nome, e-mail.
- Validacoes: role `SECRETARY` existente no banco, policies revisadas.
- Permissoes necessarias: futura administracao escolar autorizada.
- Tabelas envolvidas: Auth, `profiles`, `memberships`.
- Escrita esperada: profile e membership com role futura.
- Riscos: ativar role sem RLS e sem constraints.
- Logs/auditoria: criador, instituicao, usuario criado.
- Status atual: planejado, nao implementado.

### create-school-admin

- Objetivo: criar administrador interno da escola futuro.
- Input esperado: institution_id, nome, e-mail.
- Validacoes: `SCHOOL_ADMIN` existente no banco, escopo institucional.
- Permissoes necessarias: futura administracao global ou escolar autorizada.
- Tabelas envolvidas: Auth, `profiles`, `memberships`.
- Escrita esperada: profile e membership com role futura.
- Riscos: poder excessivo dentro da escola.
- Logs/auditoria: criador, instituicao, usuario criado, role.
- Status atual: planejado, nao implementado.

### link-guardian-to-student

- Objetivo: vincular responsavel existente a aluno.
- Input esperado: institution_id, guardian_profile_id, student_id,
  relationship, is_primary.
- Validacoes: ambos na mesma instituicao, vinculo nao duplicado, regra de
  principal unico.
- Permissoes necessarias: `manage_guardians`.
- Tabelas envolvidas: `guardianships`, `students`, `memberships`.
- Escrita esperada: novo guardianship ou reativacao.
- Riscos: vinculo entre instituicoes diferentes.
- Logs/auditoria: autor, responsavel, aluno, relacao.
- Status atual: planejado, nao implementado.

### create-student-without-login

- Objetivo: criar registro academico de aluno sem acesso Auth.
- Input esperado: institution_id, nome, dados academicos e identificadores.
- Validacoes: instituicao ativa, duplicidade, RA/codigo.
- Permissoes necessarias: `manage_students`.
- Tabelas envolvidas: `students` e possivel estrutura futura de identidade sem
  login.
- Escrita esperada: registro academico sem Auth user.
- Riscos: conflito futuro ao ativar login.
- Logs/auditoria: autor, aluno, instituicao.
- Status atual: planejado, nao implementado.

### resend-invite

- Objetivo: reenviar convite pendente.
- Input esperado: invite_id.
- Validacoes: convite pendente, expiracao, limite de tentativas.
- Permissoes necessarias: `manage_school_users`.
- Tabelas envolvidas: convites futuros, Auth quando aplicavel.
- Escrita esperada: novo envio e registro de tentativa.
- Riscos: spam, envio para e-mail errado.
- Logs/auditoria: autor, convite, tentativa.
- Status atual: planejado, nao implementado.

### revoke-invite

- Objetivo: revogar convite pendente.
- Input esperado: invite_id, motivo opcional.
- Validacoes: convite pendente, instituicao do autor.
- Permissoes necessarias: `manage_school_users`.
- Tabelas envolvidas: convites futuros.
- Escrita esperada: status revogado.
- Riscos: revogar convite de outra instituicao.
- Logs/auditoria: autor, convite, motivo.
- Status atual: planejado, nao implementado.

## Consolidação pós-auditoria manual

O banco atual permite `DIRECTOR` no enum remoto, mas ainda não há fluxo real unificado de convite. Aluno, professor, responsável e diretor devem ser ativados por Edge Function segura apenas após reconciliação.

`SECRETARY` e `SCHOOL_ADMIN` não devem ser aceitos por Edge Function real enquanto não existirem no enum remoto e nas policies.
