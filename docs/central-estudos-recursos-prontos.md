# Central de Estudos: recursos prontos

## Objetivo

Criar uma biblioteca institucional de materiais revisados que a escola possa disponibilizar para professores e que os professores possam reutilizar nas próprias turmas, sem obrigar cada docente a começar uma coleção do zero.

Esta proposta complementa as coleções atuais. Nesta etapa não cria tabelas, migrations ou conteúdo fictício.

## Experiência proposta

### Escola

- cadastrar pacotes por etapa, série, turno e disciplina;
- revisar título, descrição, fonte, faixa etária e licença antes de publicar;
- publicar, arquivar ou substituir uma versão sem quebrar links já utilizados;
- acompanhar quais pacotes estão disponíveis e quais foram usados pelas turmas.

### Professor

- abrir a biblioteca por disciplina e habilidade;
- filtrar por tipo, dificuldade, duração e etapa;
- visualizar o material antes de usar;
- adicionar uma cópia à sua coleção ou atribuí-la diretamente a uma turma;
- adaptar instruções sem alterar a versão institucional original.

### Aluno

- ver somente recursos publicados e atribuídos ao seu contexto;
- identificar se o item é vídeo, leitura, atividade, material para impressão ou link externo;
- abrir o recurso em uma ação clara, com retorno para a Central de Estudos.

## Catálogo inicial sugerido

Começar com poucos modelos de alta recorrência:

1. revisão rápida de conteúdo;
2. lista de exercícios com gabarito para o professor;
3. roteiro de estudo de 15, 30 e 50 minutos;
4. vídeo ou leitura de fonte oficial;
5. atividade de recuperação e reforço;
6. material de apoio para aula prática;
7. checklist de preparação para avaliação.

Cada modelo deve informar a disciplina, unidade/habilidade, etapa, duração estimada, nível de dificuldade e indicação de uso.

## Modelo de dados futuro

Reutilizar `learning_collections` e `learning_resources` como base, evoluindo apenas quando o fluxo estiver validado. Os campos que provavelmente serão necessários são:

- `origin`: `INSTITUTION`, `TEACHER` ou `CATALOG`;
- `visibility`: institucional, turma ou privado do professor;
- `grade_level` e `school_year_id`;
- `skill_id` opcional;
- `difficulty` e `estimated_minutes`;
- `review_status`, `reviewed_by` e `reviewed_at`;
- `version` e `replaced_by` para atualização sem apagar histórico;
- `license` e `source_attribution` para fontes externas.

O catálogo deve separar o recurso original da cópia usada por uma turma. Assim, a escola pode atualizar um modelo sem alterar retroativamente uma atividade já publicada.

## Permissões

- `ADMIN`: administra o catálogo global somente se essa capacidade for explicitamente habilitada;
- `DIRECTOR` e `SECRETARY`: administram o catálogo da instituição;
- `TEACHER`: usa, adapta e atribui recursos autorizados às próprias turmas;
- `STUDENT`: consulta recursos publicados e atribuídos;
- `GUARDIAN`: acesso somente ao que a política pedagógica da escola decidir expor.

Toda leitura e atribuição deve continuar limitada por instituição, turma, disciplina e membership ativa. O frontend não é a barreira de autorização.

## Entrega incremental

### Fase 1: biblioteca curada

Adicionar filtros e uma área de biblioteca para professores, usando os tipos de recurso existentes e sem upload. Validar navegação, revisão e atribuição com links oficiais.

### Fase 2: duplicar e adaptar

Permitir que o professor copie um recurso institucional para a própria coleção, edite instruções e atribua à turma.

### Fase 3: pacotes de aprendizagem

Agrupar materiais, práticas e uma habilidade em um roteiro reutilizável, com duração e ordem sugeridas.

### Fase 4: governança

Adicionar revisão, versionamento, arquivamento, atribuição de licença e métricas de uso. Só depois avaliar upload de arquivos e armazenamento privado.

## Melhorias de produto recomendadas

- mostrar “Continuar estudando” com a última unidade acessada;
- destacar práticas com prazo próximo sem usar alarmes excessivos;
- permitir salvar um recurso para depois;
- exibir estados vazios com próximo passo claro;
- manter filtros na URL somente quando houver uma tela de busca dedicada;
- adicionar acessibilidade a links externos e indicar quando uma nova aba será aberta;
- medir abertura e conclusão, sem transformar a Central em um painel de vigilância;
- testar primeiro com uma turma e uma disciplina antes de popular a escola inteira.
