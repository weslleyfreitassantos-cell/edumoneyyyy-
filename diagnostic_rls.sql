-- ============================================================
-- RLS Diagnostic – 100% SELECT-only
-- ============================================================
-- Alvo: usuario@example.com (substitua pelo email real)
-- Execute CADA bloco separadamente no SQL Editor (Ctrl+Enter).
-- Nao modifica nenhum dado.
-- ============================================================

-- 1. Localizar o UUID do usuario alvo
SELECT
  u.id       AS target_user_id,
  u.email    AS email,
  p.active   AS profile_active,
  p.role     AS legacy_role,
  p.platform_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'usuario@example.com';

-- 2. Diagnostico completo — todas as instituicoes do usuario
--    Logica equivalente reproduzida SEM auth.uid(), usando
--    o UUID obtido do auth.users pelo email.
WITH
target AS (
  SELECT id AS target_user_id
  FROM auth.users
  WHERE email = 'usuario@example.com'
  LIMIT 1
)
SELECT
  t.target_user_id,

  -- membership
  m.id              AS membership_id,
  m.role            AS membership_role,
  m.active          AS membership_active,

  -- institution
  i.id              AS institution_id,
  i.name            AS institution_name,
  i.active          AS institution_active,
  i.account_id,

  -- account
  a.status          AS account_status,
  a.owner_profile_id,

  -- equivalent: is_platform_super_admin
  (p.active = true AND p.platform_role = 'SUPER_ADMIN')
    AS equivalent_is_platform_super_admin,

  -- equivalent: owns_institution (latest: JOIN accounts, is_institution_operational)
  (i.active = true
   AND a.status = 'ACTIVE'
   AND a.owner_profile_id = t.target_user_id)
    AS equivalent_owns_institution,

  -- equivalent: is_institution_operational
  (i.active = true
   AND (i.account_id IS NULL OR a.status = 'ACTIVE'))
    AS equivalent_is_institution_operational,

  -- equivalent: can_access_institution
  (  (i.active = true AND (i.account_id IS NULL OR a.status = 'ACTIVE'))
     AND (
       (p.active = true AND p.platform_role = 'SUPER_ADMIN')
       OR (i.active = true AND a.status = 'ACTIVE' AND a.owner_profile_id = t.target_user_id)
       OR EXISTS (
         SELECT 1
         FROM public.memberships m2
         WHERE m2.profile_id = t.target_user_id
           AND m2.institution_id = i.id
           AND m2.active = true
       )
     )
  ) AS equivalent_can_access_institution,

  -- equivalent: can_manage_institution_operations
  (  (i.active = true AND (i.account_id IS NULL OR a.status = 'ACTIVE'))
     AND (
       (p.active = true AND p.platform_role = 'SUPER_ADMIN')
       OR (i.active = true AND a.status = 'ACTIVE' AND a.owner_profile_id = t.target_user_id)
       OR EXISTS (
         SELECT 1
         FROM public.memberships m2
         WHERE m2.profile_id = t.target_user_id
           AND m2.institution_id = i.id
           AND m2.active = true
           AND m2.role IN ('DIRECTOR', 'SECRETARY')
       )
       OR EXISTS (
         SELECT 1
         FROM public.memberships m2
         WHERE m2.profile_id = t.target_user_id
           AND m2.institution_id = i.id
           AND m2.active = true
           AND m2.role = 'ADMIN'
           AND i.account_id IS NULL
       )
     )
  ) AS equivalent_can_manage_institution_operations

FROM target t
CROSS JOIN public.profiles p
JOIN public.memberships m ON m.profile_id = t.target_user_id
JOIN public.institutions i ON i.id = m.institution_id
LEFT JOIN public.accounts a ON a.id = i.account_id
WHERE p.id = t.target_user_id
ORDER BY i.name;

-- 3. Diagnostico filtrado por TARGET_INSTITUTION_ID (SUBSTITUA o UUID)
--    Se voce ja sabe qual instituicao falhou, cole o UUID aqui.
--    Caso contrario, rode o bloco 2 primeiro e depois preencha.
WITH
target AS (
  SELECT id AS target_user_id
  FROM auth.users
  WHERE email = 'usuario@example.com'
  LIMIT 1
),
inst AS (
  SELECT id, name, active, account_id
  FROM public.institutions
  WHERE id = 'TARGET_INSTITUTION_ID'
)
SELECT
  t.target_user_id,
  i.id                  AS institution_id,
  i.name                AS institution_name,
  i.active              AS institution_active,
  i.account_id,
  a.status              AS account_status,
  a.owner_profile_id,
  m.id                  AS membership_id,
  m.role                AS membership_role,
  m.active              AS membership_active,
  p.role                AS legacy_role,
  p.platform_role,
  p.active              AS profile_active,

  -- equivalente: is_institution_operational
  (i.active = true AND (i.account_id IS NULL OR a.status = 'ACTIVE'))
    AS equivalent_is_institution_operational,

  -- equivalente: can_manage_institution_operations
  (  (i.active = true AND (i.account_id IS NULL OR a.status = 'ACTIVE'))
     AND (
       (p.active = true AND p.platform_role = 'SUPER_ADMIN')
       OR (i.active = true AND a.status = 'ACTIVE' AND a.owner_profile_id = t.target_user_id)
       OR EXISTS (
         SELECT 1
         FROM public.memberships m2
         WHERE m2.profile_id = t.target_user_id
           AND m2.institution_id = i.id
           AND m2.active = true
           AND m2.role IN ('DIRECTOR', 'SECRETARY')
       )
       OR EXISTS (
         SELECT 1
         FROM public.memberships m2
         WHERE m2.profile_id = t.target_user_id
           AND m2.institution_id = i.id
           AND m2.active = true
           AND m2.role = 'ADMIN'
           AND i.account_id IS NULL
       )
     )
  ) AS equivalent_can_manage_institution_operations

FROM target t
CROSS JOIN inst i
LEFT JOIN public.accounts a ON a.id = i.account_id
LEFT JOIN public.memberships m ON m.profile_id = t.target_user_id AND m.institution_id = i.id
LEFT JOIN public.profiles p ON p.id = t.target_user_id;

-- 4. Politicas RLS instaladas para rooms e timetable_entries
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('rooms', 'timetable_entries')
ORDER BY tablename, cmd;

-- 5. Definicao atual das funcoes helpers no banco
SELECT
  proname AS function_name,
  pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'can_manage_institution_operations',
    'can_access_institution',
    'is_institution_operational'
  )
ORDER BY proname;
