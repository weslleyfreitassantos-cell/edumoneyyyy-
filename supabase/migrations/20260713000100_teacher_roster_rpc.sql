-- 20260713000100_teacher_roster_rpc.sql

CREATE OR REPLACE FUNCTION public.get_teacher_offering_rosters(
  target_offering_ids uuid[],
  effective_date date DEFAULT NULL
) RETURNS TABLE (
  offering_id uuid,
  enrollment_id uuid,
  student_id uuid,
  profile_id uuid,
  full_name text,
  registration_number text,
  class_id uuid,
  academic_year_id uuid,
  enrolled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_teacher_profile_id uuid := auth.uid();
  v_invalid_count int;
  v_invalid_date boolean;
BEGIN
  -- 1. Validate that all passed offering_ids belong to the teacher and are active
  SELECT count(DISTINCT so.id)
  INTO v_invalid_count
  FROM unnest(target_offering_ids) AS req_id
  LEFT JOIN public.subject_offerings so ON so.id = req_id
  LEFT JOIN public.classes c ON c.id = so.class_id
  LEFT JOIN public.terms t ON t.id = so.term_id
  LEFT JOIN public.memberships m ON m.institution_id = c.institution_id AND m.profile_id = v_teacher_profile_id
  WHERE so.teacher_profile_id = v_teacher_profile_id
    AND so.active = true
    AND c.active = true
    AND t.active = true
    AND m.role = 'TEACHER'
    AND m.active = true;

  IF v_invalid_count <> (SELECT count(DISTINCT x) FROM unnest(target_offering_ids) AS x) THEN
    RAISE EXCEPTION 'Acesso negado ou oferta invalida/inativa solicitada.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate effective_date against term bounds if provided
  IF effective_date IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM unnest(target_offering_ids) AS req_id
      JOIN public.subject_offerings so ON so.id = req_id
      JOIN public.terms t ON t.id = so.term_id
      WHERE effective_date < t.start_date OR effective_date > t.end_date
    ) INTO v_invalid_date;

    IF v_invalid_date THEN
      RAISE EXCEPTION 'Data da chamada ou avaliacao fora do periodo letivo.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 3. Return the roster
  RETURN QUERY
  SELECT 
    so.id AS offering_id,
    e.id AS enrollment_id,
    s.id AS student_id,
    p.id AS profile_id,
    p.full_name,
    s.registration_number,
    e.class_id,
    e.academic_year_id,
    e.enrolled_at
  FROM unnest(target_offering_ids) AS req_id
  JOIN public.subject_offerings so ON so.id = req_id
  JOIN public.classes c ON c.id = so.class_id
  JOIN public.enrollments e ON e.class_id = c.id AND e.academic_year_id = c.academic_year_id
  JOIN public.students s ON s.id = e.student_id
  JOIN public.profiles p ON p.id = s.profile_id
  WHERE e.active = true
    AND upper(trim(e.status)) = 'ACTIVE'
    AND s.active = true
    AND s.institution_id = c.institution_id
    AND p.active = true
    AND (
      effective_date IS NULL
      OR e.enrolled_at < (effective_date + interval '1 day')
    );
END;
$$;

-- Security hardening
REVOKE EXECUTE ON FUNCTION public.get_teacher_offering_rosters(uuid[], date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_offering_rosters(uuid[], date) TO authenticated, service_role;
