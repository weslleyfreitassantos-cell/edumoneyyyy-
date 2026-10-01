begin;

-- Calendar audience policies call these SECURITY DEFINER helpers while the
-- authenticated role queries the events table. Keep their execution scoped
-- to authenticated callers and server-side service operations.
grant usage on schema private to authenticated, service_role;

grant execute on function private.is_active_student_of_calendar_class(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.is_active_guardian_of_calendar_class(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.is_active_teacher_of_calendar_class(uuid, uuid)
  to authenticated, service_role;

-- Qualify the outer event institution. The previous unqualified expression
-- resolved both sides to membership.institution_id, removing that tenant
-- check from the teacher policy.
drop policy if exists academic_calendar_events_teacher_select
  on public.academic_calendar_events;

create policy academic_calendar_events_teacher_select
on public.academic_calendar_events
for select
to authenticated
using (
  academic_calendar_events.active is true
  and (
    academic_calendar_events.audience in ('ALL', 'TEACHERS')
    or (
      academic_calendar_events.audience = 'CLASS'
      and private.is_active_teacher_of_calendar_class(
        academic_calendar_events.institution_id,
        academic_calendar_events.class_id
      )
    )
  )
  and exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = academic_calendar_events.institution_id
      and membership.role = 'TEACHER'::public.user_role
      and membership.active is true
  )
);

commit;
