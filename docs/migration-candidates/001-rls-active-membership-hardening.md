# Candidato 001 — Hardening de RLS com membership ativa

## 1. Status

- Revisao apenas.
- Nao executar diretamente.
- Nao aplicar via Supabase CLI.
- Nao mover para `supabase/migrations` sem aprovacao.

## 2. Base tecnica confirmada

- `supabase_migrations.schema_migrations` esta ausente/null no remoto.
- RLS esta ativo nas tabelas publicas auditadas.
- As funcoes `is_institution_admin` e `can_view_institution_profile` existem.
- Ambas consideram `ADMIN` e `DIRECTOR`.
- Ambas nao filtram `membership.active is true`.
- Varias policies de leitura consultam `memberships` sem filtrar
  `active is true`.
- `subject_offerings` ja filtra membership ativa.
- Memberships atuais confirmadas: `ADMIN active true`: 1,
  `TEACHER active true`: 1, `STUDENT active true`: 3.
- Nao foram encontrados orfaos principais.
- Roles reais: `ADMIN`, `DIRECTOR`, `TEACHER`, `STUDENT`, `GUARDIAN`.

## 3. Objetivo

- Impedir que memberships inativas mantenham acesso.
- Padronizar policies de leitura por instituicao.
- Garantir que admin/diretor ativo continue gerenciando.
- Preservar a capacidade de admin ativo visualizar memberships/profiles da
  instituicao, inclusive para gestao.

## 4. Escopo do SQL candidato

- Recriar `is_institution_admin`.
- Recriar `can_view_institution_profile`.
- Recriar policies de leitura com `memberships.active is true`.
- Manter insert/update de `students` via `is_institution_admin`.
- Deixar revogacao de `EXECUTE` para `anon` como etapa opcional/revisavel,
  nao automatica.

## 5. Fora de escopo

- Notas e frequencia.
- Convites reais.
- Roles novas.
- Aluno sem login.
- Alteracao de Edge Functions.
- Alteracao de Auth.
- Alteracao de migrations reais.

## 6. Riscos

- Usuarios com memberships inativas perderao acesso.
- Policies podem bloquear telas se algum dado estiver com `active` nulo/falso
  indevidamente.
- Admin precisa continuar vendo usuarios inativos para gestao.
- Revogar `EXECUTE` de `anon` pode quebrar consultas se feito sem teste.

## 7. Pre-checks obrigatorios

SELECTs para rodar antes, apenas como referencia documental:

```sql
select role, active, count(*) from public.memberships group by role, active order by role, active;

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select p.proname, pg_get_functiondef(p.oid)
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_institution_admin', 'can_view_institution_profile')
order by p.proname;

select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'academic_years',
    'classes',
    'enrollments',
    'guardianships',
    'institutions',
    'memberships',
    'profiles',
    'students',
    'subject_offerings',
    'subjects',
    'terms'
  )
order by c.relname;
```

Validar tambem usuarios de teste para admin ativo, admin inativo, professor,
aluno, usuario fora da instituicao e usuario sem membership ativa.

## 8. Testes pos-aplicacao em staging

- Admin ativo acessa painel.
- Admin ativo ve usuarios da escola.
- Admin ativo ve memberships inativas, se existirem.
- Admin inativo nao acessa.
- Professor ativo ve seu escopo.
- Aluno ativo ve seus dados.
- Usuario fora da instituicao nao ve dados.
- Usuario sem membership ativa nao ve dados.
- Cadastro visual continua sem escrita.

## 9. Rollback conceitual

- Restaurar funcoes/policies anteriores.
- Usar backup/export.
- Validar RLS novamente.
