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
