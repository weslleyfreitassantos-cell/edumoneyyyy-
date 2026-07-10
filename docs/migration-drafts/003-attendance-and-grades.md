# 003 — Notas e frequência

Status: draft/documentação. Não executar diretamente.

## Estado remoto

A auditoria confirmou ausência de:

- `assessments`
- `grades`
- `attendance_sessions`
- `attendance_records`

## Objetivo

Planejar a criação das tabelas de avaliações, notas e frequência.

## Dependências

- Reconciliação de migrations.
- Confirmação do modelo de `subject_offerings`.
- RLS por instituição.
- Regras para professor lançar apenas em suas turmas, se aplicável.

## Modelo conceitual

- `assessments`: avaliações ligadas a oferta/disciplina/período.
- `grades`: notas por aluno e avaliação.
- `attendance_sessions`: chamadas/aulas por turma/oferta/data.
- `attendance_records`: presença/falta por aluno.

## RLS esperado

- Admin/diretor vê tudo da instituição.
- Professor vê/lança dados das ofertas em que está vinculado.
- Aluno vê os próprios dados.
- Responsável vê dados dos alunos vinculados via guardianship.

## Validação

- Criar avaliação.
- Lançar nota.
- Lançar frequência.
- Consultar como professor.
- Consultar como aluno.
- Consultar como responsável.
- Impedir acesso fora da instituição.
