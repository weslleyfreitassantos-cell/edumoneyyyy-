-- Execute only against a disposable database with migrations applied.
begin;

insert into auth.users(id, email) values
  ('91000000-0000-0000-0000-000000000001', 'manager-a@example.invalid'),
  ('91000000-0000-0000-0000-000000000002', 'manager-b@example.invalid'),
  ('91000000-0000-0000-0000-000000000003', 'professional-a@example.invalid'),
  ('91000000-0000-0000-0000-000000000004', 'student-a@example.invalid'),
  ('91000000-0000-0000-0000-000000000005', 'student-b@example.invalid');

insert into public.profiles(id, full_name, email, role) values
  ('91000000-0000-0000-0000-000000000001', 'Manager A', 'manager-a@example.invalid', 'DIRECTOR'),
  ('91000000-0000-0000-0000-000000000002', 'Manager B', 'manager-b@example.invalid', 'DIRECTOR'),
  ('91000000-0000-0000-0000-000000000003', 'Professional A', 'professional-a@example.invalid', 'TEACHER'),
  ('91000000-0000-0000-0000-000000000004', 'Student A', 'student-a@example.invalid', 'STUDENT'),
  ('91000000-0000-0000-0000-000000000005', 'Student B', 'student-b@example.invalid', 'STUDENT');

insert into public.institutions(id, name, plan) values
  ('92000000-0000-0000-0000-000000000001', 'Inclusive A fixture', 'PROFESSIONAL'),
  ('92000000-0000-0000-0000-000000000002', 'Inclusive B fixture', 'PROFESSIONAL');

insert into public.memberships(profile_id, institution_id, role) values
  ('91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'DIRECTOR'),
  ('91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'DIRECTOR'),
  ('91000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', 'TEACHER');

insert into public.students(id, profile_id, institution_id, registration_number) values
  ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000001', 'RLS-A'),
  ('93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000005', '92000000-0000-0000-0000-000000000002', 'RLS-B');

insert into public.inclusive_pei_plans(id, institution_id, student_id, created_by, updated_by) values
  ('94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001'),
  ('94000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002');

insert into public.inclusive_aee_assignments(id, institution_id, student_id, professional_profile_id, created_by) values
  ('95000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001'),
  ('95000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000002');

insert into public.inclusive_document_revisions(id, institution_id, document_type, document_id, version, snapshot, changed_by) values
  ('96000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'PEI', '94000000-0000-0000-0000-000000000001', 1, '{}'::jsonb, '91000000-0000-0000-0000-000000000001'),
  ('96000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'PEI', '94000000-0000-0000-0000-000000000002', 1, '{}'::jsonb, '91000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);

do $$
begin
  if (select count(*) from public.inclusive_aee_assignments) <> 1 then
    raise exception 'assigned professional must only see assignments in institutions where they are an active member';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);

do $$
begin
  if (select count(*) from public.inclusive_aee_assignments) <> 1 then
    raise exception 'institution manager must not see assignments from another institution';
  end if;
  if (select count(*) from public.inclusive_document_revisions) <> 1 then
    raise exception 'changed_by alone must not expose revisions from another institution';
  end if;

  begin
    insert into public.inclusive_document_revisions(
      institution_id, document_type, document_id, version, snapshot, changed_by
    ) values (
      '92000000-0000-0000-0000-000000000002', 'PEI', '94000000-0000-0000-0000-000000000002', 2, '{}'::jsonb,
      '91000000-0000-0000-0000-000000000001'
    );
    raise exception 'cross-institution revision insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.inclusive_aee_assignments(
      institution_id, student_id, professional_profile_id, created_by
    ) values (
      '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001'
    );
    raise exception 'assignment to a professional without institution membership unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.inclusive_document_revisions(
    institution_id, document_type, document_id, version, snapshot, changed_by
  ) values (
    '92000000-0000-0000-0000-000000000001', 'PEI', '94000000-0000-0000-0000-000000000001', 2, '{}'::jsonb,
    '91000000-0000-0000-0000-000000000001'
  );
end;
$$;

rollback;
