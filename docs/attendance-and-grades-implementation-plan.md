# Plano de implementação de notas e frequência

## Estado remoto

A auditoria confirmou que estas tabelas estão ausentes no remoto:

- `assessments`
- `grades`
- `attendance_sessions`
- `attendance_records`

## Bloqueio

Existem migrations locais relacionadas a notas/frequência, mas o histórico remoto Supabase CLI não está reconciliado. Não executar `db push` agora.

## Ordem recomendada

1. Reconciliar/baseline do banco.
2. Validar schema em staging.
3. Criar migration incremental para notas/frequência.
4. Adicionar RLS.
5. Testar professor, aluno, responsável e admin/diretor.
6. Ativar telas reais.

## RLS esperado

- Admin/diretor vê tudo da instituição.
- Professor vê e lança dados das ofertas vinculadas.
- Aluno vê os próprios dados.
- Responsável vê dados dos estudantes vinculados.
- Usuário de outra instituição não acessa.

## Validações

- Unicidade de nota por aluno/avaliação.
- Unicidade de presença por aluno/sessão.
- Bloqueio de acesso fora da instituição.
- Consulta por turma, disciplina e período.

## Status da branch `feat/attendance-end-to-end`

- `attendance_sessions` usa `subject_offering_id` e `session_date`; `attendance_records` usa `attendance_session_id` e `student_id`.
- Status existentes reutilizados: sessões `DRAFT`, `OPEN`, `CLOSED`, `CANCELED`; registros `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`.
- Foi adicionada migration incremental para impedir mais de uma sessão não cancelada por atribuição/data, preservar histórico sem delete autenticado e permitir leitura por aluno/responsável via registros fechados.
- A lista de chamada considera matrícula ativa/status `ACTIVE`, aluno ativo e `enrolled_at` até o fim da data. O schema atual não possui data de encerramento da matrícula; correções de registros já existentes foram preservadas sem inferir histórico ausente.
- Frontend conectado com serviço real, hooks e painéis para professor, direção/admin, aluno e responsável. Nenhuma migration remota ou deploy foi executado.
