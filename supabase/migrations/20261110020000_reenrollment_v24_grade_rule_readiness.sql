begin;

-- Keep the proven V2.3 visibility implementation as a private-to-the-API core;
-- the public wrapper adds the same progression-rule readiness check enforced
-- by create_reenrollment_request_v2.
do $$
begin
  if to_regprocedure('public.get_my_reenrollment_status_core_v23(uuid)') is null
    and to_regprocedure('public.get_my_reenrollment_status_v23(uuid)') is not null then
    execute 'alter function public.get_my_reenrollment_status_v23(uuid) rename to get_my_reenrollment_status_core_v23';
  end if;
end;
$$;

revoke all on function public.get_my_reenrollment_status_core_v23(uuid)
  from public, anon, authenticated;
grant execute on function public.get_my_reenrollment_status_core_v23(uuid)
  to current_user;

create or replace function public.get_my_reenrollment_status_v23(
  p_institution_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  status_payload jsonb;
  updated_campaigns jsonb := '[]'::jsonb;
  updated_students jsonb;
  campaign_item jsonb;
  student_item jsonb;
  grade_rule_ready boolean;
  grade_is_ineligible boolean;
  v_campaign_id uuid;
  v_source_grade text;
begin
  status_payload := public.get_my_reenrollment_status_core_v23(p_institution_id);

  if coalesce(jsonb_typeof(status_payload -> 'campaigns'), '') <> 'array' then
    return status_payload;
  end if;

  for campaign_item in
    select value from jsonb_array_elements(status_payload -> 'campaigns')
  loop
    v_campaign_id := (campaign_item -> 'campaign' ->> 'id')::uuid;
    updated_students := '[]'::jsonb;

    for student_item in
      select value from jsonb_array_elements(
        coalesce(campaign_item -> 'eligible_students', '[]'::jsonb)
      )
    loop
      if student_item ->> 'eligibility_state' = 'ELIGIBLE' then
        v_source_grade := student_item ->> 'current_grade_level';

        select
          exists (
            select 1
            from public.reenrollment_grade_mappings mapping
            where mapping.campaign_id = v_campaign_id
              and mapping.active is true
              and lower(trim(mapping.source_grade_level)) = lower(trim(coalesce(v_source_grade, '')))
              and mapping.promotion_policy = 'NOT_ELIGIBLE'
          ),
          exists (
            select 1
            from public.reenrollment_grade_mappings mapping
            where mapping.campaign_id = v_campaign_id
              and mapping.active is true
              and lower(trim(mapping.source_grade_level)) = lower(trim(coalesce(v_source_grade, '')))
              and mapping.promotion_policy <> 'NOT_ELIGIBLE'
              and nullif(trim(mapping.destination_grade_level), '') is not null
          )
          or exists (
            select 1
            from public.reenrollment_grade_rules rule
            where rule.institution_id = p_institution_id
              and rule.active is true
              and lower(trim(rule.source_grade_level)) = lower(trim(coalesce(v_source_grade, '')))
          )
        into grade_is_ineligible, grade_rule_ready;

        if grade_is_ineligible then
          student_item := jsonb_set(
            student_item,
            '{eligibility_state}',
            to_jsonb('STUDENT_INELIGIBLE'::text),
            true
          );
        elsif not grade_rule_ready then
          student_item := jsonb_set(
            student_item,
            '{eligibility_state}',
            to_jsonb('GRADE_RULE_REQUIRED'::text),
            true
          );
        end if;
      end if;

      updated_students := updated_students || jsonb_build_array(student_item);
    end loop;

    campaign_item := jsonb_set(
      campaign_item,
      '{eligible_students}',
      updated_students,
      true
    );
    updated_campaigns := updated_campaigns || jsonb_build_array(campaign_item);
  end loop;

  return jsonb_set(status_payload, '{campaigns}', updated_campaigns, true);
end;
$$;

revoke all on function public.get_my_reenrollment_status_v23(uuid) from public, anon;
grant execute on function public.get_my_reenrollment_status_v23(uuid) to authenticated;

-- Save a progression rule atomically against the existing normalized unique
-- index. SECURITY INVOKER keeps the table's staff-only RLS policy in force.
create or replace function public.save_reenrollment_grade_rule_v24(
  p_institution_id uuid,
  p_source_grade_level text,
  p_destination_grade_level text,
  p_destination_stage text,
  p_promotion_policy text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_rule public.reenrollment_grade_rules%rowtype;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'REENROLLMENT_GRADE_RULE_NOT_ALLOWED' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_source_grade_level, '')), '') is null then
    raise exception 'REENROLLMENT_SOURCE_GRADE_REQUIRED';
  end if;
  if p_promotion_policy not in ('PROMOTE', 'RETAIN', 'GRADUATE', 'MANUAL') then
    raise exception 'REENROLLMENT_PROMOTION_POLICY_INVALID';
  end if;
  if p_promotion_policy <> 'GRADUATE'
    and nullif(trim(coalesce(p_destination_grade_level, '')), '') is null then
    raise exception 'REENROLLMENT_DESTINATION_GRADE_REQUIRED';
  end if;

  insert into public.reenrollment_grade_rules (
    institution_id,
    source_grade_level,
    destination_grade_level,
    destination_stage,
    promotion_policy,
    active,
    created_by
  ) values (
    p_institution_id,
    trim(p_source_grade_level),
    nullif(trim(coalesce(p_destination_grade_level, '')), ''),
    nullif(trim(coalesce(p_destination_stage, '')), ''),
    p_promotion_policy,
    true,
    auth.uid()
  )
  on conflict (institution_id, (lower(trim(source_grade_level))))
  do update set
    destination_grade_level = excluded.destination_grade_level,
    destination_stage = excluded.destination_stage,
    promotion_policy = excluded.promotion_policy,
    active = true,
    updated_at = now()
  returning * into saved_rule;

  return to_jsonb(saved_rule);
end;
$$;

revoke all on function public.save_reenrollment_grade_rule_v24(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.save_reenrollment_grade_rule_v24(uuid, text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
