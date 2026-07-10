# Modelo de roles e permissoes

Esta entrega prepara o EduManager Pro para uma plataforma escolar multi-instituicao sem alterar o banco, migrations ou Edge Functions.

## Usuarios globais e usuarios da escola

Um usuario global pertence a plataforma. Ele existe antes de qualquer escola especifica e, no modelo futuro, podera administrar recursos da plataforma inteira, como a criacao de escolas.

Um usuario da escola atua dentro de uma instituicao especifica. A mesma pessoa pode existir como perfil global e receber um vinculo por escola, com permissoes limitadas ao contexto daquela instituicao.

## Profiles e memberships

`profiles` representa a identidade academica do usuario: nome, e-mail, avatar, status e o papel historico usado hoje pelo frontend em `profiles.role`.

`memberships` representa o vinculo do usuario com uma instituicao: escola, papel dentro da escola, status do vinculo e data de entrada. Esse deve se tornar o ponto principal para decisoes multi-instituicao.

Hoje o frontend ainda usa principalmente `profiles.role`. A migracao completa para `memberships.role` fica para uma etapa futura, depois da reconciliacao do banco.

## Instituicao ativa no frontend

O frontend agora possui a base de selecao de instituicao ativa. A selecao usa os
memberships ativos do usuario e as instituicoes ativas retornadas pelo banco.

Comportamento planejado nesta base:

- com uma escola ativa, ela e selecionada automaticamente;
- com multiplas escolas ativas, a ultima escola escolhida e restaurada quando
  ainda existe e esta ativa;
- quando a escolha salva nao existe mais, a primeira escola ativa e usada;
- sem escola ativa, o contexto retorna instituicao e membership como `null`,
  permitindo estados vazios nas telas.

O `localStorage` guarda somente o ID da escola selecionada, usando a chave
`edumanager.currentInstitutionId.{profileId}`. Nenhum segredo, e-mail, senha ou
dado sensivel e salvo nessa selecao.

As telas administrativas devem ler a escola atual pelo contexto/hook de
instituicao e filtrar dados por `institution_id`. As permissoes futuras devem
considerar o `memberships.role` da escola ativa, nao apenas `profiles.role`.

## Papel futuro de profiles.platform_role

`profiles.platform_role` deve guardar papeis globais da plataforma. O primeiro papel planejado e `SUPER_ADMIN`, responsavel por administrar a plataforma e criar escolas.

Esse campo ainda nao existe no banco atual.

## Papel futuro de memberships.role

`memberships.role` deve guardar papeis dentro de cada escola. No modelo futuro, ele deve suportar `SCHOOL_ADMIN`, `DIRECTOR`, `SECRETARY`, `TEACHER`, `STUDENT` e `GUARDIAN`.

Hoje o banco suporta apenas `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT` e `GUARDIAN`. `ADMIN` representa o papel administrativo compativel atual e deve ser dividido futuramente em `SUPER_ADMIN` e `SCHOOL_ADMIN`.

## Papeis atuais ativos

- `ADMIN`: papel administrativo compativel atual.
- `DIRECTOR`: direcao escolar, hoje com permissoes semelhantes a `ADMIN` por compatibilidade.
- `TEACHER`: professor.
- `STUDENT`: aluno.
- `GUARDIAN`: responsavel.

## Papeis futuros planejados

### SUPER_ADMIN

Papel global da plataforma. Deve criar escolas, visualizar indicadores globais e administrar recursos fora do escopo de uma escola especifica.

Permissoes planejadas:

- `create_school`
- `view_reports`

### SCHOOL_ADMIN

Papel administrativo interno de uma escola. Deve gerenciar usuarios, estrutura academica, turmas, disciplinas, matriculas, atribuicoes e relatorios da instituicao.

Permissoes planejadas:

- `manage_school`
- `manage_school_users`
- `manage_students`
- `manage_guardians`
- `manage_teachers`
- `manage_enrollments`
- `manage_academic_structure`
- `manage_assignments`
- `view_school_dashboard`
- `view_reports`

### DIRECTOR

Papel pedagogico e operacional da direcao. Hoje permanece equivalente a `ADMIN` no frontend por compatibilidade. Futuramente deve ter menos poderes que `SCHOOL_ADMIN`, especialmente para alteracoes de permissoes e administracao sensivel.

Permissoes atuais de compatibilidade:

- `manage_school`
- `manage_school_users`
- `manage_students`
- `manage_guardians`
- `manage_teachers`
- `manage_enrollments`
- `manage_academic_structure`
- `manage_assignments`
- `view_school_dashboard`
- `view_reports`

### SECRETARY

Papel de secretaria escolar. Deve cadastrar funcionarios, professores, alunos, responsaveis e gerenciar matriculas dentro da propria escola.

A secretaria nao deve criar ou excluir escolas, alterar permissoes globais, acessar outra escola, alterar `SUPER_ADMIN` ou alterar permissoes de `SCHOOL_ADMIN` sem autorizacao.

Permissoes planejadas:

- `manage_school_users`
- `manage_students`
- `manage_guardians`
- `manage_teachers`
- `manage_enrollments`
- `view_school_dashboard`

### TEACHER

Papel de professor. Deve visualizar suas turmas, alunos e dados pedagogicos vinculados as suas atribuicoes.

Permissao atual:

- `view_own_classes`

### STUDENT

Papel de aluno. Deve visualizar seus proprios dados academicos.

Permissao atual:

- `view_own_student_data`

### GUARDIAN

Papel de responsavel. Deve visualizar dados dos alunos vinculados.

Permissao atual:

- `view_linked_students`

## Limitacoes atuais

- `SECRETARY` nao existe no banco.
- `SCHOOL_ADMIN` nao existe no banco.
- `SUPER_ADMIN` nao existe no banco.
- `profiles.platform_role` nao existe no banco.
- O frontend ainda usa principalmente `profiles.role`.
- `ADMIN` e `DIRECTOR` ainda estao parcialmente misturados.
- `/admin` permite `ADMIN` e `DIRECTOR`.
- As Edge Functions de cadastro ainda aceitam o modelo atual.

## Por que SECRETARY ainda nao pode ser ativada

`SECRETARY` ainda nao pode ser ativada porque o banco remoto e as migrations locais precisam ser reconciliados antes de adicionar novos papeis. Tambem sera necessario revisar policies, claims, validacoes das Edge Functions e fluxos de convite/senha.

Ativar `SECRETARY` apenas no frontend criaria uma permissao falsa, sem garantia no banco e sem protecao completa nos fluxos de criacao.

## Migrations futuras necessarias

- Adicionar `profiles.platform_role` ou estrutura equivalente para papeis globais.
- Adicionar suporte a `SUPER_ADMIN`, `SCHOOL_ADMIN` e `SECRETARY`.
- Migrar o significado de `ADMIN` para os novos papeis sem perder usuarios existentes.
- Ajustar constraints, indexes e RLS para a decisao por instituicao.
- Garantir que `memberships.role` seja a fonte de autoridade escolar.
- Criar estrategia de backfill para usuarios administrativos existentes.

## Edge Functions a revisar futuramente

- `create-student`
- `create-teacher`
- `create-guardian`

Novas funcoes ou fluxos futuros podem incluir convites unificados, cadastro de secretaria, cadastro de diretor e administracao de usuarios da escola. Isso deve acontecer somente depois da reconciliacao das migrations e da homologacao do fluxo de convite/senha.

## Telas futuras

- `Usuarios da Escola`: ja existe como tela somente leitura em `/admin`,
  listando vinculos por instituicao via `memberships` + `profiles`. Ela mostra
  papeis atuais, informa papeis planejados e mantem o botao de novo usuario
  desabilitado. Ainda nao cria usuarios, nao chama Supabase Auth, nao chama Edge
  Functions e nao escreve no banco.
- `Escolas`: administracao de escolas pelo `SUPER_ADMIN`.
- `Secretaria`: operacao diaria de cadastros e matriculas.
- `Convites`: acompanhamento de convites e definicao de senha.
- `Permissoes`: governanca de papeis e autorizacoes por escola.

## Cadastro unificado de usuarios - previa visual

A aba `Usuarios da Escola` possui uma previa visual do fluxo futuro de cadastro
e convite unificado. A interface permite escolher o tipo de usuario, preencher
dados locais e revisar o que seria criado futuramente, mas nenhuma acao real e
executada nesta etapa.

Garantias desta etapa:

- nenhum usuario e criado;
- nenhum convite real e enviado;
- o botao de envio permanece desabilitado;
- nenhuma chamada a Supabase Auth, Edge Functions ou banco e feita;
- `SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` continuam nao ativos no banco;
- a criacao real depende da reconciliacao das migrations;
- a criacao real depende de Edge Functions e fluxo Auth seguros.

O fluxo visual cobre:

- alunos, que futuramente podem ter cadastro academico separado de login;
- professores, que precisarao de vinculos e atribuicoes academicas;
- responsaveis, que precisarao de vinculos via `guardianships`;
- diretor, usando o papel atual `DIRECTOR`;
- administracao escolar e secretaria escolar apenas como papeis planejados.

## Role efetiva por instituicao ativa

A aplicacao agora possui helpers de permissao para a transicao gradual entre `profiles.role` e `memberships.role`.

A role efetiva segue esta regra:

1. se existir `memberships.role` da instituicao ativa, ela tem prioridade;
2. se nao existir `memberships.role`, o sistema usa `profiles.role` como fallback temporario;
3. se nenhuma role existir, a permissao e negada.

Esse comportamento fica centralizado em:

- `getEffectiveRole`
- `hasEffectivePermission`
- `hasAnyEffectivePermission`
- `hasAllEffectivePermissions`

Os helpers aceitam apenas os papeis atuais do banco. Roles planejadas como
`SUPER_ADMIN`, `SCHOOL_ADMIN` e `SECRETARY` nao recebem permissao efetiva ate
existirem no schema, nas policies e nos fluxos privilegiados.

Essa etapa nao conclui a migracao total para `memberships.role`. Algumas partes globais, como `ProtectedRoute`, ainda podem usar `profiles.role` para proteger rotas gerais enquanto a transicao acontece de forma segura.

As Edge Functions existentes continuam validando os papeis atuais `ADMIN` e `DIRECTOR`.

O banco ainda possui somente os papeis atuais:

- `ADMIN`
- `DIRECTOR`
- `TEACHER`
- `STUDENT`
- `GUARDIAN`

Os papeis abaixo continuam apenas planejados e documentados:

- `SUPER_ADMIN`
- `SCHOOL_ADMIN`
- `SECRETARY`

Esta etapa nao altera migrations, nao altera enums do banco, nao altera Edge Functions e nao executa comandos Supabase remotos.
