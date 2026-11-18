# Mapeamento da Plataforma Escolar e Proposta do Modulo Creche

Documento preparado para orientar a criacao de um modulo de creche dentro do EduManager Pro sem quebrar o fluxo atual das escolas.

## 1. Objetivo

Adicionar um tipo de instituicao `CRECHE` ao mesmo produto que hoje atende escolas, mantendo a mesma base de autenticacao, usuarios, responsaveis, matriculas, comunicacao, documentos, financeiro, marca e isolamento entre instituicoes.

A selecao deve acontecer por instituicao licenciada. Uma mesma conta administrativa pode ter mais de uma instituicao, e cada instituicao pode ser configurada como:

- `SCHOOL`: escola regular, do ensino fundamental ao ensino medio;
- `DAYCARE`: creche/educacao infantil;
- estrutura preparada para futuros tipos, sem transformar a regra em um simples `if` fixo para dois casos.

O tipo deve ser uma propriedade da instituicao, e nao da conta inteira. Assim, a mesma conta pode administrar uma escola e uma creche sem misturar dados, menus ou regras.

## 2. Retrato atual da plataforma

### 2.1 Camada de plataforma e multi-instituicao

Ja existe:

- contas de clientes e administradores;
- limite de instituicoes por conta;
- instituicoes vinculadas a uma conta;
- selecao da instituicao ativa;
- isolamento por `institution_id`;
- perfis globais e vinculos por instituicao;
- branding, dominio e identidade visual por instituicao;
- status da conta e historico de acoes administrativas;
- painel de plataforma para criar, consultar, suspender, reativar e administrar contas;
- rotas protegidas e controle de acesso por papel.

Ponto que ainda falta para a creche:

- o cadastro de instituicao/licenca ainda nao possui o campo de tipo `SCHOOL` ou `DAYCARE`;
- ainda nao existe uma matriz de modulos habilitados por instituicao;
- o menu atual e predominantemente orientado a escola regular.

### 2.2 Autenticacao, identidade e acesso

Ja existe:

- login por e-mail e senha;
- convite de usuario e definicao de senha;
- recuperacao de senha;
- rotas protegidas;
- tela de acesso nao autorizado;
- troca e persistencia da instituicao ativa;
- personalizacao da tela de login;
- permissao por papel e por instituicao;
- separacao entre administrador da plataforma e usuarios da instituicao.

Reaproveitamento para creche: direto, sem precisar criar uma nova forma de login.

### 2.3 Papeis atuais

Os papeis internos atuais sao:

- `SUPER_ADMIN`: administracao global da plataforma;
- `ADMIN`: dono/administrador da conta e das instituicoes;
- `DIRECTOR`: gestao pedagogica e operacional da instituicao;
- `SECRETARY`: operacao administrativa autorizada;
- `TEACHER`: professor e operacao pedagogica das turmas atribuídas;
- `STUDENT`: acesso do aluno;
- `GUARDIAN`: acesso do responsavel aos dependentes.

Para a creche, a primeira versao pode reaproveitar:

- `DIRECTOR` para direcao;
- `SECRETARY` para secretaria;
- `TEACHER` exibido como `Educador(a)` ou `Professor(a)`;
- `GUARDIAN` exibido como `Responsavel`;
- `ADMIN` e `SUPER_ADMIN` sem alteracao.

Novos perfis podem ser necessarios depois:

- coordenador pedagogico;
- auxiliar de sala;
- cuidador;
- profissional de saude;
- portaria/recepcao;
- financeiro.

Recomendacao: nao criar varios papeis novos no primeiro passo. Usar os papeis atuais com uma funcao profissional adicional quando a diferenca for apenas de nomenclatura. Criar um novo papel somente quando houver permissoes realmente diferentes, principalmente em saude, retirada da crianca e dados sensiveis.

### 2.4 Pessoas e cadastros

Ja existe:

- cadastro e convite de alunos;
- cadastro de professores;
- cadastro de responsaveis;
- vinculo de um ou mais responsaveis ao aluno;
- definicao de responsavel principal;
- dados de perfil e contato;
- matricula e RA;
- ativacao e desativacao sem apagar historico;
- importacao por planilha em partes do cadastro;
- documentos do aluno;
- endereco do aluno;
- informacoes de saude do aluno.

Para creche, o registro de `students` pode continuar sendo usado internamente para evitar quebrar matricula, responsavel, financeiro e relatorios. A interface deve chamar a pessoa de `crianca`, e uma tabela complementar `child_care_profiles` pode guardar dados especificos da primeira infancia.

Dados adicionais recomendados para crianca:

- nome completo, nome social e apelido usado no dia a dia;
- data de nascimento e faixa etaria;
- foto;
- certidao/documentos;
- endereco e contatos da familia;
- alergias e restricoes alimentares;
- medicamentos autorizados;
- condicoes de saude relevantes;
- pessoas autorizadas a buscar;
- pessoas impedidas ou restricoes judiciais, quando aplicavel;
- contatos de emergencia;
- observacoes de adaptacao;
- consentimentos para fotos, videos, comunicacao e atividades externas.

Dados de saude e custodia exigem acesso restrito, auditoria e tratamento adequado pela instituicao.

### 2.5 Estrutura academica e operacional atual

Ja existe:

- ano letivo;
- periodos/bimestres/semestres;
- turmas;
- salas;
- turnos e configuracoes de horario;
- disciplinas;
- matriz curricular;
- atribuicoes de professor, disciplina, turma e periodo;
- grade horaria;
- calendario escolar;
- matriculas por turma e ano;
- transferencia, cancelamento, reativacao e validacao de capacidade;
- acompanhamento de frequencia;
- diario de classe;
- notas e avaliacoes;
- fechamento de periodo;
- recuperacao;
- conselho de classe;
- acompanhamento pedagogico;
- documentos e relatorios academicos.

Reaproveitamento na creche:

- ano letivo, periodos, salas, capacidade e matricula: direto;
- turmas: adaptar para grupos/salas por faixa etaria;
- professores: adaptar para educadores e auxiliares;
- grade horaria: adaptar para rotina diaria;
- frequencia: adaptar para presenca, entrada e saida;
- calendario: direto, com eventos de rotina e familia;
- notas, provas e fechamento: nao usar da mesma forma.

### 2.6 Fluxo academico atual da escola

O fluxo principal hoje e:

```text
Ano letivo
-> periodo
-> politica academica
-> turma
-> disciplina
-> professor
-> aluno
-> matricula
-> atribuicao
-> grade horaria
-> frequencia
-> avaliacoes
-> notas
-> fechamento
-> boletim/resultado oficial
```

Na creche, o fluxo deve ser:

```text
Ano letivo
-> faixa etaria
-> grupo/sala
-> educador e auxiliar
-> crianca
-> responsavel
-> matricula
-> periodo de adaptacao
-> rotina diaria
-> presenca e retirada
-> observacoes de desenvolvimento
-> relatorio descritivo/portfolio
```

## 3. Inventario dos modulos existentes

### 3.1 Gestao administrativa

- visao geral da instituicao;
- usuarios;
- alunos;
- professores;
- responsaveis;
- diretores;
- secretaria;
- atribuicoes;
- controle de acesso por papel;
- personalizacao da identidade visual;
- configuracao de dominio e marca;
- conta e administracao da plataforma.

### 3.2 Configuracao academica

- ano letivo;
- periodos;
- disciplinas;
- turmas;
- salas;
- matriz curricular;
- politica academica;
- calendario escolar;
- grade horaria;
- disponibilidade de professores;
- intervalos e horarios;
- versoes e automacao da grade.

### 3.3 Operacao escolar

- matriculas;
- diario de classe;
- frequencia;
- notas;
- avaliacoes;
- fechamento de periodo;
- recuperacao;
- conselho de classe;
- acompanhamento pedagogico;
- prontuario academico;
- documentos academicos;
- relatorios academicos.

### 3.4 Comunicacao e recursos

- avisos da instituicao;
- e-mail institucional;
- materiais e comunicados;
- biblioteca;
- TV Escola/terminais;
- cameras ao vivo, quando integradas;
- portaria/controle de acesso, quando configurado;
- assistente da plataforma;
- importacoes por planilha.

### 3.5 Aprendizagem e pedagogia

- Central de Estudos;
- jornadas guiadas;
- licoes e etapas;
- atividades publicadas;
- biblioteca de aprendizagem;
- praticas e simulacoes;
- caderno de erros;
- gamificacao;
- conteudo adaptativo;
- Central Pedagogica do professor;
- mapa de habilidades;
- jornadas pedagogicas;
- acompanhamento individual;
- conteudos e atividades do professor;
- educacao inclusiva;
- PEI;
- AEE/PAEE;
- biblioteca de atividades inclusivas;
- exercicios interativos;
- materiais para download;
- evolucao pedagogica.

Para creche, esse conjunto deve ser opcional e simplificado. A crianca pequena nao deve receber o mesmo fluxo de provas, simulacoes, ENEM, notas e tarefas da escola regular.

### 3.6 Financeiro

Ja existe estrutura para:

- contratos financeiros;
- parcelas/faturas;
- vencimentos;
- valores em centavos;
- pagamentos;
- pagamentos parciais;
- inadimplencia;
- ajustes de contrato;
- lembretes;
- contas bancarias por instituicao;
- remessa e retorno planejados;
- recibos/boletos no fluxo de desenvolvimento.

Observacao importante: a existencia das telas e servicos financeiros nao significa, por si so, que toda integracao bancaria real esteja homologada. A integracao de cada banco precisa ser validada separadamente.

Para creche, o financeiro pode reaproveitar contratos, parcelas, pagamentos, descontos e relatorios, acrescentando:

- taxa de matricula;
- mensalidade por turno;
- periodo integral ou parcial;
- alimentacao;
- horario estendido;
- transporte;
- atividades extras;
- descontos por irmaos;
- descontos e bolsas;
- multa e juros configuraveis.

## 4. O que reutilizar, adaptar ou criar

### 4.1 Reutilizar diretamente

- autenticacao e recuperacao de senha;
- multi-instituicao e isolamento por instituicao;
- contas, limites e dominio;
- branding e tela de login;
- perfis, memberships e convites;
- diretor, secretaria e responsavel;
- cadastro base de aluno/crianca;
- vinculo responsavel-crianca;
- matricula;
- salas e capacidade;
- comunicados e e-mail;
- documentos e anexos;
- relatorios e exportacao;
- financeiro base;
- trilha de auditoria e seguranca;
- educacao inclusiva e PEI, quando aplicavel.

### 4.2 Reutilizar com adaptacao

- `students` -> interface de criancas e perfil complementar de cuidados;
- `classes` -> grupos, salas e faixas etarias;
- `teachers` -> educadores, professores e auxiliares;
- `enrollments` -> matricula, adaptacao e situacao da vaga;
- `attendance` -> presenca, entrada, saida, atraso e justificativa;
- `timetable` -> rotina diaria, refeicoes, sono, higiene e atividades;
- `academic_calendar` -> calendario de funcionamento, eventos e reunioes;
- `guardianships` -> familia, autorizados e contatos de emergencia;
- `student_documents` -> documentos de matricula e autorizacoes;
- `student_health_information` -> alergias, medicamentos e alertas de cuidado;
- `report_card` -> relatorio descritivo e portfolio;
- `pedagogical_monitoring` -> observacoes de desenvolvimento;
- `portaria` -> controle de retirada da crianca;
- `cameras` -> apenas se a politica e a integracao forem aprovadas;
- `announcements` -> comunicacao diaria com a familia;
- `dashboard` -> indicadores de ocupacao, presenca e rotina.

### 4.3 Nao reutilizar sem mudanca

- notas numericas como centro do acompanhamento;
- provas e simulados;
- recuperacao e fechamento de notas;
- conselho de classe no formato escolar;
- disciplinas e carga horaria como obrigacao;
- boletim com aprovacao/reprovacao;
- conteudo de ensino medio, ENEM e vestibular;
- gamificacao competitiva para criancas pequenas;
- tarefas e trilhas adaptativas projetadas para alunos maiores.

### 4.4 Modulos novos da creche

1. **Configuracao da creche**: faixa etaria, grupos, turnos, capacidade, proporcao de adultos por grupo e regras de funcionamento.
2. **Perfil da crianca**: dados de cuidado, saude, rotina, autorizacoes e contatos de emergencia.
3. **Periodo de adaptacao**: inicio gradual, responsavel presente, observacoes e conclusao da adaptacao.
4. **Entrada e saida**: registro de chegada, retirada, pessoa autorizada, documento, horario, atraso e ocorrencia.
5. **Rotina diaria**: refeicao, sono, higiene, fralda/banheiro, humor, repouso, atividade e observacao.
6. **Medicacao e saude**: autorizacao, horario, dose informada pela familia, registro de aplicacao e ocorrencia. Nao substitui sistema medico.
7. **Incidentes**: queda, febre, acidente, comunicacao com a familia e providencia adotada.
8. **Desenvolvimento infantil**: observacoes por campos da educacao infantil, sem transformar o processo em prova ou nota.
9. **Portfolio**: registros, fotos, videos e producoes, com consentimento e controle de visibilidade.
10. **Diario da familia**: resumo do dia, avisos, rotina e mensagens.
11. **Lista de espera**: interesse, prioridade, faixa etaria, disponibilidade de vaga e conversao em matricula.
12. **Planejamento de grupo**: atividades, objetivos de desenvolvimento, materiais e observacoes do educador.
13. **Relatorio descritivo**: periodo, conquistas, pontos de atencao e registros para a familia.
14. **Financeiro da creche**: mensalidade, matricula, turno, servicos extras, descontos e cobranca.

## 5. Proposta para escolha da instituicao na licenca

### 5.1 Modelo recomendado

Adicionar no cadastro de cada instituicao:

```text
institution_type: SCHOOL | DAYCARE
```

E, em uma estrutura extensivel, habilitar modulos:

```text
institution_features:
- academic_school
- daycare_care
- finance
- communication
- inclusive_education
- access_control
- cameras
- learning_center
```

O tipo define o conjunto inicial de modulos, mas a licenca pode habilitar ou desabilitar recursos adicionais.

### 5.2 Fluxo do administrador da plataforma

1. Criar ou abrir a conta do cliente.
2. Criar a instituicao.
3. Informar nome, dominio e identidade visual.
4. Escolher `Escola` ou `Creche`.
5. Confirmar os modulos padrao sugeridos.
6. Ajustar modulos opcionais da licenca.
7. Convidar o administrador da instituicao.
8. A instituicao passa a abrir com o menu e os fluxos corretos.

### 5.3 Regras de compatibilidade

- Instituicoes existentes devem receber `SCHOOL` por padrao na migracao.
- Nenhuma escola atual pode perder menus ou dados.
- O tipo deve ser lido pelo backend e pelo frontend.
- A ocultacao de menu nunca pode ser a unica protecao; as permissoes e as politicas RLS continuam obrigatorias.
- A troca de tipo deve ser restrita ao administrador da plataforma e registrar auditoria.
- Uma conta pode possuir instituicoes de tipos diferentes.
- Dados de uma escola nunca podem aparecer no contexto de uma creche, mesmo que pertençam a mesma conta.

## 6. Permissoes sugeridas para creche

### Direcao

- configurar a creche;
- gerir grupos, salas, vagas e turnos;
- gerir equipe;
- acompanhar criancas e responsaveis;
- consultar saude, ocorrencias e autorizacoes conforme permissao;
- validar matriculas e transferencias;
- acompanhar presenca, retirada e rotina;
- acessar relatorios;
- gerir comunicados;
- gerir financeiro quando autorizado.

### Secretaria

- cadastrar criancas e responsaveis;
- organizar documentos;
- preparar matricula;
- acompanhar lista de espera;
- registrar entrada e saida, se autorizada;
- enviar comunicados;
- acompanhar financeiro conforme permissao;
- nao alterar regras sensiveis de saude sem autorizacao.

### Educador/professor

- visualizar seus grupos;
- registrar presenca;
- registrar rotina diaria;
- registrar observacoes de desenvolvimento;
- criar planejamento e atividades;
- registrar ocorrencias;
- comunicar a familia dentro do fluxo aprovado;
- consultar somente as informacoes de cuidado necessarias ao trabalho.

### Auxiliar/cuidador

- visualizar criancas do grupo designado;
- registrar rotina e cuidados;
- registrar ocorrencias;
- nao acessar financeiro, documentos completos ou dados que nao sejam necessarios.

### Responsavel

- acompanhar criancas vinculadas;
- confirmar dados, contatos e autorizacoes;
- informar alergias, restricoes e medicamentos;
- consultar diario, presenca, ocorrencias e comunicados;
- acompanhar matricula, contrato e financeiro;
- autorizar retirada e receber notificacoes.

### Crianca

Na primeira versao, a crianca nao precisa ter login proprio. O acesso deve acontecer pelo responsavel.

## 7. Modelo de dados inicial sugerido

### Alteracoes de compatibilidade

- adicionar `institution_type` em `institutions`, com default `SCHOOL`;
- criar tabela de modulos/licenca por instituicao;
- adicionar classificacao de grupo/faixa etaria em `classes` ou em uma tabela de grupos;
- manter `students` para preservar as relacoes existentes;
- criar `child_care_profiles` ligado a `students`;
- reutilizar `guardianships`, `enrollments`, `rooms`, `student_documents` e `student_health_information` onde fizer sentido.

### Entidades novas recomendadas

- `daycare_groups` ou extensao de `classes`;
- `child_care_profiles`;
- `care_authorized_pickups`;
- `care_daily_records`;
- `care_meal_records`;
- `care_sleep_records`;
- `care_hygiene_records`;
- `care_medications`;
- `care_incidents`;
- `care_adaptation_periods`;
- `child_development_observations`;
- `child_portfolio_items`;
- `family_consents`;
- `enrollment_waitlist`.

Todas devem ter `institution_id`, politicas RLS, auditoria e vinculos claros com a crianca e o responsavel.

## 8. Plano de entrega recomendado

### Fase 0 - Fundacao

- migracao de `institution_type`;
- modulos habilitados por instituicao;
- selecao Escola/Creche no painel de licencas;
- regras de menu e permissao;
- defaults para instituicoes existentes;
- testes de isolamento entre duas instituicoes.

### Fase 1 - Cadastro e matricula

- grupos por faixa etaria;
- salas, turnos e capacidade;
- crianca e perfil de cuidado;
- responsaveis e autorizados;
- documentos;
- lista de espera;
- matricula e periodo de adaptacao.

### Fase 2 - Operacao diaria

- entrada e saida;
- presenca;
- rotina de refeicao, sono e higiene;
- medicacao autorizada;
- ocorrencias;
- notificacao para a familia.

### Fase 3 - Pedagogia e familia

- planejamento por grupo;
- observacoes de desenvolvimento;
- portfolio;
- relatorio descritivo;
- comunicacao diaria;
- consentimento de fotos e videos.

### Fase 4 - Complementos

- financeiro especifico da creche;
- transporte;
- cardapio e alimentacao;
- controle de materiais;
- cameras e portaria, somente apos homologacao;
- indicadores avancados.

## 9. Criterios de aceite

- Ao criar uma nova instituicao, o administrador consegue escolher Escola ou Creche.
- Uma instituicao existente continua funcionando como escola sem alteracao visual ou funcional inesperada.
- Uma creche nao exibe ENEM, notas, provas, conselho de classe ou disciplinas escolares como obrigatorios.
- Uma escola nao perde notas, frequencia, fechamento, boletim ou recursos atuais.
- Direcao, secretaria, educador, auxiliar e responsavel enxergam apenas o que devem enxergar.
- Duas instituicoes nunca acessam dados uma da outra.
- A crianca pode ser matriculada em grupo, sala, turno e ano.
- O responsavel consegue consultar rotina, comunicados e situacao financeira.
- Entrada, saida e pessoa autorizada ficam auditadas.
- Informacoes de saude e custodia possuem acesso restrito.
- O relatorio da creche e descritivo e nao usa aprovacao/reprovacao por nota.
- O financeiro continua isolado por instituicao.
- Cada alteracao sensivel fica registrada em auditoria.

## 10. Texto pronto para enviar ao outro chat

```text
Analise o repositorio EduManager Pro e crie um plano tecnico para adicionar o modulo Creche sem quebrar o modulo Escola existente.

O produto e multi-instituicao e ja possui autenticacao, perfis, memberships, papeis ADMIN, DIRECTOR, SECRETARY, TEACHER, STUDENT e GUARDIAN, cadastro de alunos, professores e responsaveis, guardianships, anos letivos, periodos, turmas, salas, matriculas, atribuicoes, grade horaria, frequencia, notas, avaliacoes, fechamento, boletim, documentos, comunicados, e-mail, biblioteca, Central de Estudos, Central Pedagogica, educacao inclusiva, financeiro, dominio, branding e controle de acesso.

Primeiro, mapeie o que existe no codigo, nas rotas, nos servicos, nas migrations e nas politicas RLS. Depois implemente a base para que cada instituicao tenha institution_type = SCHOOL ou DAYCARE. Instituicoes existentes devem receber SCHOOL por default.

Essa escolha deve aparecer no painel de administracao/licencas e ser uma propriedade da instituicao, nao da conta inteira. A mesma conta pode ter uma escola e uma creche. Alem do tipo, prepare uma estrutura de modulos habilitados por instituicao.

Reaproveite autenticacao, multi-tenancy, memberships, permissoes, direcao, secretaria, responsavel, cadastro base, guardianships, matriculas, salas, documentos, comunicacao, branding, financeiro e auditoria.

Para a creche, adapte alunos para criancas, turmas para grupos por faixa etaria, professores para educadores, grade para rotina, frequencia para presenca e entrada/saida, boletim para relatorio descritivo e acompanhamento pedagogico para observacoes de desenvolvimento.

Crie como escopo especifico de creche: perfil de cuidados, periodo de adaptacao, lista de espera, grupos e capacidade, entrada e saida, pessoas autorizadas a buscar, rotina diaria, refeicoes, sono, higiene, fraldas/banheiro, medicacao autorizada, alergias, ocorrencias, comunicacao diaria com responsaveis, portfolio, observacoes de desenvolvimento alinhadas a educacao infantil, relatorio descritivo e financeiro com turno, alimentacao, horario estendido e servicos extras.

Nao reutilize sem adaptacao notas, provas, recuperacao, conselho de classe, ENEM, disciplinas e boletim de aprovacao/reprovacao. A crianca nao precisa de login proprio na primeira versao; o acesso deve ser pelo responsavel.

Entregue em fases: fundacao da licenca e do tipo, cadastro/matricula, operacao diaria, pedagogia/familia e complementos. Inclua migrations, tipos, servicos, telas, permissoes, RLS, testes de isolamento entre instituicoes, testes por papel e criterios de aceite. Nao altere o comportamento das escolas existentes sem uma feature flag ou migracao retrocompativel.
```

## 11. Decisoes que precisam ser confirmadas antes do desenvolvimento

- A creche atendera somente 0 a 5 anos ou tambem pre-escola ate 6 anos?
- Havera periodo integral, meio periodo e horario estendido?
- Uma mesma instituicao podera ter escola regular e creche no mesmo dominio?
- Auxiliar tera permissao propria ou sera uma funcao de usuario `TEACHER`?
- A portaria sera usada para entrada e retirada desde o MVP?
- Fotos e videos serao compartilhados com responsaveis? Qual sera o consentimento?
- O financeiro da creche usara o mesmo contrato e boleto da escola?
- Havera transporte, refeicao e controle de estoque na primeira versao?
- O relatorio pedagogico seguira campos da BNCC de Educacao Infantil definidos pela instituicao?

