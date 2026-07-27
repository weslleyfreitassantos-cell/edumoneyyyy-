# Roadmap de calendário por turma

## ✅ Matriz Curricular — CONCLUÍDO

Permite definir quais disciplinas pertencem a cada turma, com contagem de aulas semanais, duração e cálculo de carga horária. Integra-se com as atribuições existentes para garantir a integridade dos dados.

### Funcionalidades Implementadas
- **Migration** (`20260724000100_class_curriculum_matrix.sql`): Cria tabela `class_curriculum_items` com FKs, unique constraint, triggers de integridade, backfill das `subject_offerings`, políticas RLS
- **Proteção de Dados**: Impede criação de atribuição sem item na matriz (`CURRICULUM_COMPONENT_REQUIRED`), impede desativação se há ofertas ativas
- **Service** (`curriculumService.ts`): list, create, update, setActive, getTeachersByItem
- **Hooks** (`useCurriculum.ts`): query keys, useQuery, useMutation com invalidação de cache
- **Admin UI Tab** (`CurriculumTab.tsx`): Filtros ano/turma, sumário, DataTable com colunas por período, modal criar/editar, navegação para atribuições
- **Overview Integration**: Métricas e avisos da matriz na Visão Geral
- **Classes Integration**: `active_curriculum_items_count` no ClassRow
- **Assignments Integration**: Filtros via URL (`classId`/`subjectId`), erro amigável para `CURRICULUM_COMPONENT_REQUIRED`

## Etapa 2 — concluída neste incremento

- Disciplinas base da instituição, com modelos curriculares BNCC para acelerar a configuração inicial.
- Checklist de configuração inicial da escola na visão geral da Administração.
- Navegação administrativa simplificada e agrupada.
- Matriz curricular por turma.
- Definição de aulas semanais por disciplina.
- Definição da duração da aula.
- Professor responsável por componente curricular em cada turma/período (colunas dinâmicas por período).

## Etapa 3 — futura

- Grade semanal de horários.
- Segunda a sábado.
- Horário inicial e final de cada aula.
- Sala.
- Detecção de conflitos de turma.
- Detecção de conflitos de professor.
- Detecção de conflitos de sala.
