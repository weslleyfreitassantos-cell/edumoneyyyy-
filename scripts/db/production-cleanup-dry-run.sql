-- =============================================================================
-- EduManager Pro — DRY RUN: Auditoria SELECT-only da limpeza de PRODUÇÃO
-- =============================================================================
-- Projeto: jrdmrhsqqclnrouoednn
-- Versao: 2.0 (inclui rooms, timetable_entries, term_closures,
--                student_term_results, account_domains)
-- =============================================================================

begin;

-----------------------------------------------------------------------------
-- 1. Confirmar ambiente
-----------------------------------------------------------------------------
select
  current_database() as database_name,
  current_schema as schema_name,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE') as total_user_tables;

-----------------------------------------------------------------------------
-- 2. Validar SUPER_ADMIN
-----------------------------------------------------------------------------
do $$
declare
  v_count integer;
  v_id uuid;
  v_profile record;
begin
  select count(*) into v_count from auth.users where email = 'superadmin@admin.com';

  if v_count = 0 then
    raise exception 'ABORT: superadmin@admin.com not found in auth.users';
  end if;

  if v_count > 1 then
    raise exception 'ABORT: found % records for superadmin@admin.com (expected 1)', v_count;
  end if;

  select id into v_id from auth.users where email = 'superadmin@admin.com';
  raise notice 'SUPER_ADMIN encontrado: OK (id mascarado)';

  select * into v_profile from public.profiles where id = v_id;

  if not found then
    raise exception 'ABORT: superadmin sem profile';
  end if;

  if v_profile.platform_role is distinct from 'SUPER_ADMIN' then
    raise exception 'ABORT: profile.platform_role = %, esperado SUPER_ADMIN', v_profile.platform_role;
  end if;

  if v_profile.active is not true then
    raise exception 'ABORT: profile do superadmin esta inativo';
  end if;

  raise notice 'Profile OK: role=%, platform_role=%, active=%',
    v_profile.role, v_profile.platform_role, v_profile.active;
end;
$$;

-----------------------------------------------------------------------------
-- 3. Contagens por tabela (total / preservar / remover)
-----------------------------------------------------------------------------
-- Auth
select 'auth.users' as tabela,
  (select count(*) from auth.users) as total,
  (select count(*) from auth.users where email = 'superadmin@admin.com') as preservar,
  (select count(*) from auth.users where email <> 'superadmin@admin.com') as remover;

-- Profiles
select 'public.profiles' as tabela,
  (select count(*) from public.profiles) as total,
  (select count(*) from public.profiles p
    where exists (select 1 from auth.users u where u.id = p.id and u.email = 'superadmin@admin.com')) as preservar,
  (select count(*) from public.profiles p
    where not exists (select 1 from auth.users u where u.id = p.id and u.email = 'superadmin@admin.com')) as remover;

-- Contas e dominios
select 'public.accounts' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.accounts;

select 'public.account_domains' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.account_domains;

select 'public.account_status_events' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.account_status_events;

select 'public.branding_settings' as tabela,
  count(*) as total,
  (select count(*) from public.branding_settings where scope_type = 'GLOBAL') as preservar,
  (select count(*) from public.branding_settings where scope_type = 'ACCOUNT') as remover;

-- Instituicoes e memberships
select 'public.institutions' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.institutions;

select 'public.memberships' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.memberships;

-- Academico: anos/periodos
select 'public.academic_years' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.academic_years;

select 'public.terms' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.terms;

select 'public.academic_policies' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.academic_policies;

-- Turmas, disciplinas, curriculo
select 'public.classes' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.classes;

select 'public.subjects' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.subjects;

select 'public.class_curriculum_items' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.class_curriculum_items;

-- Ofertas, alunos, matrículas
select 'public.subject_offerings' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.subject_offerings;

select 'public.students' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.students;

select 'public.guardianships' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.guardianships;

select 'public.enrollments' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.enrollments;

select 'public.student_registration_counters' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.student_registration_counters;

-- Salas e grade horaria (NOVO)
select 'public.rooms' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.rooms;

select 'public.timetable_entries' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.timetable_entries;

-- Avaliacoes, notas, frequencia
select 'public.assessments' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.assessments;

select 'public.grades' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.grades;

select 'public.attendance_sessions' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.attendance_sessions;

select 'public.attendance_records' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.attendance_records;

-- Fechamento e resultados (NOVO)
select 'public.term_closures' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.term_closures;

select 'public.student_term_results' as tabela,
  count(*) as total, 0::bigint as preservar, count(*) as remover from public.student_term_results;

-----------------------------------------------------------------------------
-- 4. Usuarios que serao removidos (emails mascarados)
-----------------------------------------------------------------------------
select
  encode(substring(id::text::bytea, 1, 4), 'hex') as id_prefix,
  left(email, 2) || '***@***' || substring(email from position('@' in email) + 1) as email_mascarado,
  created_at
from auth.users
where email <> 'superadmin@admin.com'
order by created_at;

-----------------------------------------------------------------------------
-- 5. Contas a remover
-----------------------------------------------------------------------------
select id, name, status, created_at from public.accounts order by created_at;

-----------------------------------------------------------------------------
-- 6. Instituicoes a remover
-----------------------------------------------------------------------------
select id, name, active, created_at from public.institutions order by created_at;

-----------------------------------------------------------------------------
-- 7. Resumo agregado
-----------------------------------------------------------------------------
with raw as (
  select 'auth.users' as item, count(*)::int as qtd from auth.users
  union all select 'public.profiles', count(*)::int from public.profiles
  union all select 'public.accounts', count(*)::int from public.accounts
  union all select 'public.account_domains', count(*)::int from public.account_domains
  union all select 'public.account_status_events', count(*)::int from public.account_status_events
  union all select 'public.branding_settings', count(*)::int from public.branding_settings
  union all select 'public.institutions', count(*)::int from public.institutions
  union all select 'public.memberships', count(*)::int from public.memberships
  union all select 'public.academic_years', count(*)::int from public.academic_years
  union all select 'public.terms', count(*)::int from public.terms
  union all select 'public.academic_policies', count(*)::int from public.academic_policies
  union all select 'public.classes', count(*)::int from public.classes
  union all select 'public.subjects', count(*)::int from public.subjects
  union all select 'public.class_curriculum_items', count(*)::int from public.class_curriculum_items
  union all select 'public.subject_offerings', count(*)::int from public.subject_offerings
  union all select 'public.students', count(*)::int from public.students
  union all select 'public.guardianships', count(*)::int from public.guardianships
  union all select 'public.enrollments', count(*)::int from public.enrollments
  union all select 'public.student_registration_counters', count(*)::int from public.student_registration_counters
  union all select 'public.rooms', count(*)::int from public.rooms
  union all select 'public.timetable_entries', count(*)::int from public.timetable_entries
  union all select 'public.assessments', count(*)::int from public.assessments
  union all select 'public.grades', count(*)::int from public.grades
  union all select 'public.attendance_sessions', count(*)::int from public.attendance_sessions
  union all select 'public.attendance_records', count(*)::int from public.attendance_records
  union all select 'public.term_closures', count(*)::int from public.term_closures
  union all select 'public.student_term_results', count(*)::int from public.student_term_results
)
select
  item,
  qtd,
  case
    when item = 'auth.users' then (select count(*) from auth.users where email = 'superadmin@admin.com')::int
    when item = 'public.profiles' then (select count(*) from public.profiles p
      where exists (select 1 from auth.users u where u.id = p.id and u.email = 'superadmin@admin.com'))::int
    when item = 'public.branding_settings' then (select count(*) from public.branding_settings where scope_type = 'GLOBAL')::int
    else 0
  end as preservados,
  case
    when item = 'auth.users' then (select count(*) from auth.users where email <> 'superadmin@admin.com')::int
    when item = 'public.profiles' then ((select count(*) from public.profiles) - (select count(*) from public.profiles p
      where exists (select 1 from auth.users u where u.id = p.id and u.email = 'superadmin@admin.com')))::int
    when item = 'public.branding_settings' then (select count(*) from public.branding_settings where scope_type = 'ACCOUNT')::int
    else qtd
  end as removidos
from raw
order by item;

-----------------------------------------------------------------------------
-- 8. Tabelas encontradas vs classificadas
-----------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE') as tabelas_encontradas,
  27 as tabelas_classificadas,
  case
    when (select count(*) from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE') = 27
    then 'OK: todas classificadas'
    else 'ATENCAO: diferenca de ' ||
      ((select count(*) from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE') - 27)::text ||
      ' tabelas nao classificadas'
  end as status;

commit;
