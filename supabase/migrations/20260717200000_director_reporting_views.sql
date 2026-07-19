-- Migration for Director Reporting Views

CREATE OR REPLACE VIEW public.director_alerts
WITH (security_invoker = true)
AS
  SELECT NULL::uuid AS student_id,
    NULL::text AS student_name,
    NULL::uuid AS institution_id,
    NULL::numeric AS attendance_percentage,
    NULL::text AS alert_type
  WHERE 1 = 0;

CREATE OR REPLACE VIEW public.director_class_summary
WITH (security_invoker = true)
AS
  SELECT i.id AS institution_id,
    count(DISTINCT c.id) AS total_classes,
    count(DISTINCT
        CASE
            WHEN c.active = true THEN c.id
            ELSE NULL::uuid
        END) AS active_classes,
    COALESCE(avg(s.student_count), 0::numeric) AS avg_students_per_class
   FROM public.institutions i
     LEFT JOIN public.classes c ON c.institution_id = i.id
     LEFT JOIN ( SELECT enrollments.class_id,
            count(*) AS student_count
           FROM public.enrollments
          WHERE enrollments.active = true AND enrollments.status = 'active'::text
          GROUP BY enrollments.class_id) s ON s.class_id = c.id
  GROUP BY i.id;

CREATE OR REPLACE VIEW public.director_student_summary
WITH (security_invoker = true)
AS
  SELECT i.id AS institution_id,
    count(DISTINCT s.id) AS total_students,
    count(DISTINCT
        CASE
            WHEN s.active = true THEN s.id
            ELSE NULL::uuid
        END) AS active_students,
    count(DISTINCT
        CASE
            WHEN e.status = 'active'::text THEN e.student_id
            ELSE NULL::uuid
        END) AS enrolled_students
   FROM public.institutions i
     LEFT JOIN public.students s ON s.institution_id = i.id
     LEFT JOIN public.enrollments e ON e.student_id = s.id AND e.active = true
  GROUP BY i.id;

CREATE OR REPLACE VIEW public.director_teacher_summary
WITH (security_invoker = true)
AS
  SELECT i.id AS institution_id,
    count(DISTINCT p.id) AS total_teachers,
    count(DISTINCT
        CASE
            WHEN p.active = true THEN p.id
            ELSE NULL::uuid
        END) AS active_teachers
   FROM public.institutions i
     LEFT JOIN public.memberships m ON m.institution_id = i.id AND m.role = 'TEACHER'::public.user_role
     LEFT JOIN public.profiles p ON p.id = m.profile_id
  GROUP BY i.id;

CREATE OR REPLACE VIEW public.director_upcoming_events
WITH (security_invoker = true)
AS
  SELECT NULL::uuid AS id,
    NULL::uuid AS institution_id,
    NULL::text AS title,
    NULL::text AS description,
    NULL::timestamp with time zone AS start_date,
    NULL::timestamp with time zone AS end_date,
    NULL::text AS location,
    NULL::text AS type
  WHERE 1 = 0;

REVOKE ALL ON public.director_alerts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.director_class_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.director_student_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.director_teacher_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.director_upcoming_events FROM PUBLIC, anon, authenticated;
