begin;

-- V4 public RPCs run through these private helpers for the authenticated
-- student/teacher request path. Keep the helpers hidden from anonymous users
-- while allowing the secured RPCs to execute their tenant-scoped checks.
grant execute on function private.learning_v2_scope_student(uuid, uuid),
  private.pick_learning_question_set_v2(uuid, uuid, uuid, text),
  private.refresh_learning_student_skill_state_v2(uuid, uuid, uuid),
  private.pick_learning_v2_next_skill(uuid, uuid, uuid),
  private.append_guided_v2_next_step(public.learning_guided_sessions, public.learning_guided_steps, text, text),
  private.append_guided_v4_next_step(public.learning_guided_sessions, public.learning_guided_steps, text, text)
to authenticated, service_role;

commit;
