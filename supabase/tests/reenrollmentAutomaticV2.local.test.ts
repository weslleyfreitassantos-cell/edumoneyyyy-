import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

type AnyClient = SupabaseClient<any, any, any>;

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(localUrl && anonKey && serviceRoleKey);
const localDescribe = enabled ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined)
    throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(
  client: AnyClient,
  table: string,
  row: Record<string, unknown>,
) {
  const { data, error } = await client
    .from(table)
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert result`);
}

async function createActor(
  admin: AnyClient,
  role: string,
  label: string,
  suffix: string,
): Promise<{ id: string; client: AnyClient }> {
  const email = `reenrollment-${suffix}-${label}@local.test`;
  const password = "ReenrollmentAudit!2026";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`auth ${label}: ${JSON.stringify({
      message: error.message,
      code: error.code,
      status: error.status,
      name: error.name,
    })}`);
  }
  const user = required(data.user, `auth ${label}`);

  await insertOne(admin, "profiles", {
    id: user.id,
    full_name: `Rematricula ${label}`,
    email,
    role,
    active: true,
    platform_role: "USER",
  });

  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(
      `sign in ${label}: ${signIn.error?.message ?? "no session"}`,
    );
  }
  return { id: user.id, client };
}

async function publishCampaign(
  client: AnyClient,
  input: {
    institutionId: string;
    sourceYearId: string;
    destinationYearId: string;
    title: string;
    createdBy: string;
    opensAt?: string;
    closesAt?: string;
    eventId?: string;
    eligibleGrades?: string[];
    showFutureNotice?: boolean;
  },
): Promise<string> {
  const opensAt = input.opensAt ?? new Date(Date.now() - 60_000).toISOString();
  const closesAt = input.closesAt ?? new Date(Date.now() + 86_400_000).toISOString();
  const { data, error } = await client.rpc("publish_reenrollment_calendar_event_v21", {
    p_event_id: input.eventId ?? null,
    p_institution_id: input.institutionId,
    p_event: {
      institution_id: input.institutionId,
      academic_year_id: input.sourceYearId,
      title: input.title,
      description: "Campanha de teste integrada ao calendário acadêmico.",
      event_type: "RE_ENROLLMENT",
      starts_at: opensAt,
      ends_at: closesAt,
      all_day: false,
      audience: "ALL",
      class_id: null,
      subject_id: null,
      active: true,
      created_by: input.createdBy,
    },
    p_campaign: {
      source_academic_year_id: input.sourceYearId,
      destination_academic_year_id: input.destinationYearId,
      eligible_grade_levels: input.eligibleGrades ?? ["1º ano"],
      contract_version: "v1",
      contract_body: "Este contrato integrado é válido para o teste de rematrícula.",
      finance_mode: "NOT_REQUIRED",
      show_future_notice: input.showFutureNotice ?? false,
    },
  });
  if (error) throw new Error(`publish ${input.title}: ${error.message}`);
  const campaign = (data as { campaign?: { id?: string } } | null)?.campaign;
  return required(campaign?.id, `campaign ${input.title}`);
}

localDescribe("reenrollment V2 RLS against local Supabase", () => {
  it("isolates institutions and enforces adult or guardian authorization", async () => {
    const admin = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const directorA = await createActor(
      admin,
      "DIRECTOR",
      "director-a",
      suffix,
    );
    const secretaryA = await createActor(
      admin,
      "SECRETARY",
      "secretary-a",
      suffix,
    );
    const studentA = await createActor(admin, "STUDENT", "student-a", suffix);
    const studentASecond = await createActor(admin, "STUDENT", "student-a-second", suffix);
    const guardianA = await createActor(
      admin,
      "GUARDIAN",
      "guardian-a",
      suffix,
    );
    const adultStudentA = await createActor(
      admin,
      "STUDENT",
      "adult-student-a",
      suffix,
    );
    const directorB = await createActor(
      admin,
      "DIRECTOR",
      "director-b",
      suffix,
    );
    const studentB = await createActor(admin, "STUDENT", "student-b", suffix);
    const guardianB = await createActor(admin, "GUARDIAN", "guardian-b", suffix);

    const accountA = (
      await insertOne(admin, "accounts", {
        name: `Reenrollment A ${suffix}`,
        owner_profile_id: directorA.id,
        institution_limit: 1,
        status: "ACTIVE",
      })
    ).id;
    const accountB = (
      await insertOne(admin, "accounts", {
        name: `Reenrollment B ${suffix}`,
        owner_profile_id: directorB.id,
        institution_limit: 1,
        status: "ACTIVE",
      })
    ).id;
    const institutionA = (
      await insertOne(admin, "institutions", {
        account_id: accountA,
        name: `Reenrollment Institution A ${suffix}`,
        active: true,
      })
    ).id;
    const institutionB = (
      await insertOne(admin, "institutions", {
        account_id: accountB,
        name: `Reenrollment Institution B ${suffix}`,
        active: true,
      })
    ).id;

    for (const [profileId, institutionId, role] of [
      [directorA.id, institutionA, "DIRECTOR"],
      [secretaryA.id, institutionA, "SECRETARY"],
      [studentA.id, institutionA, "STUDENT"],
      [studentASecond.id, institutionA, "STUDENT"],
      [guardianA.id, institutionA, "GUARDIAN"],
      [adultStudentA.id, institutionA, "STUDENT"],
      [directorB.id, institutionB, "DIRECTOR"],
      [studentB.id, institutionB, "STUDENT"],
      [guardianB.id, institutionB, "GUARDIAN"],
    ] as const) {
      await insertOne(admin, "memberships", {
        profile_id: profileId,
        institution_id: institutionId,
        role,
        active: true,
      });
    }

    const sourceYear = (
      await insertOne(admin, "academic_years", {
        institution_id: institutionA,
        name: `2026 source ${suffix}`,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        active: true,
      })
    ).id;
    const destinationYear = (
      await insertOne(admin, "academic_years", {
        institution_id: institutionA,
        name: `2027 destination ${suffix}`,
        start_date: "2027-01-01",
        end_date: "2027-12-31",
        active: true,
      })
    ).id;
    const legacyDestinationYear = (
      await insertOne(admin, "academic_years", {
        institution_id: institutionA,
        name: `2028 legacy destination ${suffix}`,
        start_date: "2028-01-01",
        end_date: "2028-12-31",
        active: true,
      })
    ).id;
    const futureDestinationYear = (
      await insertOne(admin, "academic_years", {
        institution_id: institutionA,
        name: `2029 future destination ${suffix}`,
        start_date: "2029-01-01",
        end_date: "2029-12-31",
        active: true,
      })
    ).id;
    const sourceYearB = (
      await insertOne(admin, "academic_years", {
        institution_id: institutionB,
        name: `2026 source B ${suffix}`,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        active: true,
      })
    ).id;
    const destinationYearB = (
      await insertOne(admin, "academic_years", {
        institution_id: institutionB,
        name: `2027 destination B ${suffix}`,
        start_date: "2027-01-01",
        end_date: "2027-12-31",
        active: true,
      })
    ).id;

    const studentRowA = (
      await insertOne(admin, "students", {
        profile_id: studentA.id,
        institution_id: institutionA,
        registration_number: `RA-${suffix}`,
        birth_date: "2010-01-01",
        active: true,
      })
    ).id;
    const adultStudentRowA = (
      await insertOne(admin, "students", {
        profile_id: adultStudentA.id,
        institution_id: institutionA,
        registration_number: `RA-ADULT-${suffix}`,
        birth_date: "1990-01-01",
        active: true,
      })
    ).id;
    const secondStudentRowA = (
      await insertOne(admin, "students", {
        profile_id: studentASecond.id,
        institution_id: institutionA,
        registration_number: `RA-SECOND-${suffix}`,
        birth_date: "2011-01-01",
        active: true,
      })
    ).id;
    const studentRowB = (
      await insertOne(admin, "students", {
        profile_id: studentB.id,
        institution_id: institutionB,
        registration_number: `RB-${suffix}`,
        birth_date: "2010-01-01",
        active: true,
      })
    ).id;
    const classA = (
      await insertOne(admin, "classes", {
        institution_id: institutionA,
        academic_year_id: sourceYear,
        name: `1º ano A ${suffix}`,
        grade_level: "1º ano",
        shift: "MATUTINO",
        capacity: 30,
        active: true,
      })
    ).id;
    const classASecond = (
      await insertOne(admin, "classes", {
        institution_id: institutionA,
        academic_year_id: sourceYear,
        name: `2º ano A ${suffix}`,
        grade_level: "2º ano",
        shift: "VESPERTINO",
        capacity: 30,
        active: true,
      })
    ).id;
    const classB = (
      await insertOne(admin, "classes", {
        institution_id: institutionB,
        academic_year_id: sourceYearB,
        name: `1º ano B ${suffix}`,
        grade_level: "1º ano",
        shift: "MATUTINO",
        capacity: 30,
        active: true,
      })
    ).id;
    await insertOne(admin, "enrollments", {
      student_id: studentRowA,
      class_id: classA,
      academic_year_id: sourceYear,
      status: "ACTIVE",
      enrolled_at: "2026-01-01T00:00:00Z",
      active: true,
    });
    await insertOne(admin, "enrollments", {
      student_id: adultStudentRowA,
      class_id: classA,
      academic_year_id: sourceYear,
      status: "ACTIVE",
      enrolled_at: "2026-01-01T00:00:00Z",
      active: true,
    });
    await insertOne(admin, "enrollments", {
      student_id: secondStudentRowA,
      class_id: classASecond,
      academic_year_id: sourceYear,
      status: "ACTIVE",
      enrolled_at: "2026-01-01T00:00:00Z",
      active: true,
    });
    await insertOne(admin, "enrollments", {
      student_id: studentRowB,
      class_id: classB,
      academic_year_id: sourceYearB,
      status: "ACTIVE",
      enrolled_at: "2026-01-01T00:00:00Z",
      active: true,
    });
    await insertOne(admin, "guardianships", {
      student_id: studentRowA,
      guardian_profile_id: guardianA.id,
      relationship: "PARENT",
      is_primary: true,
      active: true,
    });
    await insertOne(admin, "guardianships", {
      student_id: secondStudentRowA,
      guardian_profile_id: guardianA.id,
      relationship: "PARENT",
      is_primary: true,
      active: true,
    });
    await insertOne(admin, "guardianships", {
      student_id: studentRowB,
      guardian_profile_id: guardianB.id,
      relationship: "PARENT",
      is_primary: true,
      active: true,
    });

    const campaignAInput = {
      institutionId: institutionA,
      sourceYearId: sourceYear,
      destinationYearId: destinationYear,
      title: `Campanha A ${suffix}`,
      createdBy: directorA.id,
      opensAt: new Date(Date.now() - 60_000).toISOString(),
      closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const [campaignA, concurrentCampaignA] = await Promise.all([
      publishCampaign(directorA.client, campaignAInput),
      publishCampaign(directorA.client, campaignAInput),
    ]);
    expect(concurrentCampaignA).toBe(campaignA);

    const legacyDate = new Date().toISOString().slice(0, 10);
    const legacyEvent = await insertOne(admin, "academic_calendar_events", {
      institution_id: institutionA,
      academic_year_id: sourceYear,
      title: `Rematrícula da escola ${suffix}`,
      description: "Campanha de teste integrada ao calendário acadêmico.",
      event_type: "RE_ENROLLMENT",
      starts_at: `${legacyDate}T00:00:00.000Z`,
      ends_at: `${legacyDate}T00:00:00.000Z`,
      all_day: true,
      audience: "ALL",
      class_id: null,
      subject_id: null,
      active: true,
      created_by: directorA.id,
    });
    const legacyCampaignInput = {
      institutionId: institutionA,
      sourceYearId: sourceYear,
      destinationYearId: legacyDestinationYear,
      title: `Rematrícula da escola ${suffix}`,
      createdBy: directorA.id,
      eligibleGrades: ["2º ano"],
      opensAt: new Date(Date.now() - 60_000).toISOString(),
      closesAt: new Date(Date.now() + 86_400_000).toISOString(),
      eventId: legacyEvent.id,
    };
    const [legacyCampaignId, concurrentLegacyCampaignId] = await Promise.all([
      publishCampaign(directorA.client, legacyCampaignInput),
      publishCampaign(directorA.client, legacyCampaignInput),
    ]);
    expect(concurrentLegacyCampaignId).toBe(legacyCampaignId);
    await insertOne(directorA.client, "reenrollment_grade_mappings", {
      campaign_id: legacyCampaignId,
      source_grade_level: "2º ano",
      destination_grade_level: null,
      promotion_policy: "NOT_ELIGIBLE",
      active: true,
    });
    const convertedLegacyEvent = await admin
      .from("academic_calendar_events")
      .select("id, title, description, event_type, all_day, active")
      .eq("id", legacyEvent.id)
      .single();
    expect(convertedLegacyEvent.error).toBeNull();
    expect(convertedLegacyEvent.data).toMatchObject({
      id: legacyEvent.id,
      title: legacyEvent.title,
      description: legacyEvent.description,
      event_type: "RE_ENROLLMENT",
      all_day: false,
      active: true,
    });
    const legacyLinkedCampaign = await directorA.client
      .from("reenrollment_campaigns")
      .select("id, academic_calendar_event_id")
      .eq("id", legacyCampaignId)
      .single();
    expect(legacyLinkedCampaign.data).toMatchObject({
      id: legacyCampaignId,
      academic_calendar_event_id: legacyEvent.id,
    });
    const legacyEventCount = await admin
      .from("academic_calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionA)
      .eq("title", legacyEvent.title);
    expect(legacyEventCount.count).toBe(1);

    const futureCampaign = await publishCampaign(directorA.client, {
      institutionId: institutionA,
      sourceYearId: sourceYear,
      destinationYearId: futureDestinationYear,
      title: `Campanha futura ${suffix}`,
      createdBy: directorA.id,
      opensAt: new Date(Date.now() + 86_400_000).toISOString(),
      closesAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      showFutureNotice: true,
    });

    const publishedEventCount = await directorA.client
      .from("academic_calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionA)
      .eq("event_type", "RE_ENROLLMENT")
      .eq("title", campaignAInput.title);
    expect(publishedEventCount.error).toBeNull();
    expect(publishedEventCount.count).toBe(1);

    const campaignB = await publishCampaign(directorB.client, {
      institutionId: institutionB,
      sourceYearId: sourceYearB,
      destinationYearId: destinationYearB,
      title: `Campanha B ${suffix}`,
      createdBy: directorB.id,
      opensAt: new Date(Date.now() + 86_400_000).toISOString(),
      closesAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      showFutureNotice: false,
    });
    const hiddenFutureStatus = await guardianB.client.rpc("get_my_reenrollment_status_v23", {
      p_institution_id: institutionB,
    });
    expect(hiddenFutureStatus.error).toBeNull();
    expect(hiddenFutureStatus.data?.state).toBe("CAMPAIGN_UPCOMING");
    expect(hiddenFutureStatus.data?.campaigns).toHaveLength(0);
    const crossTenantStatus = await guardianA.client.rpc("get_my_reenrollment_status_v23", {
      p_institution_id: institutionB,
    });
    expect(crossTenantStatus.data).toBeNull();
    expect(crossTenantStatus.error?.code).toBe("42501");
    const linkedCampaign = await directorA.client
      .from("reenrollment_campaigns")
      .select("academic_calendar_event_id, contract_version, contract_hash")
      .eq("id", campaignA)
      .single();
    expect(linkedCampaign.error).toBeNull();
    expect(linkedCampaign.data?.academic_calendar_event_id).toBeTruthy();
    expect(linkedCampaign.data?.contract_hash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const directCampaignUpdate = await directorA.client
      .from("reenrollment_campaigns")
      .update({ status: "CLOSED" })
      .eq("id", campaignA);
    expect(directCampaignUpdate.error).not.toBeNull();

    const [guardianStatus, underageStatus, adultStatus] = await Promise.all([
      guardianA.client.rpc("get_my_reenrollment_status_v23", {
        p_institution_id: institutionA,
      }),
      studentA.client.rpc("get_my_reenrollment_status_v23", {
        p_institution_id: institutionA,
      }),
      adultStudentA.client.rpc("get_my_reenrollment_status_v23", {
        p_institution_id: institutionA,
      }),
    ]);
    expect(guardianStatus.error).toBeNull();
    expect(underageStatus.error).toBeNull();
    expect(adultStatus.error).toBeNull();
    const guardianCampaign = guardianStatus.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === campaignA,
    );
    const underageCampaign = underageStatus.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === campaignA,
    );
    const adultCampaign = adultStatus.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === campaignA,
    );
    expect(guardianStatus.data?.state).toBe("AVAILABLE");
    expect(guardianCampaign?.state).toBe("OPEN");
    expect(guardianCampaign?.eligible_students).toContainEqual(expect.objectContaining({
      student_id: studentRowA,
      can_confirm: true,
      eligibility_state: "GRADE_RULE_REQUIRED",
      current_grade_level: "1º ano",
    }));
    expect(guardianCampaign?.eligible_students).toContainEqual(expect.objectContaining({
      student_id: secondStudentRowA,
      can_confirm: true,
      eligibility_state: "STUDENT_INELIGIBLE",
      current_grade_level: "2º ano",
    }));
    const legacyStatusCampaign = guardianStatus.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === legacyCampaignId,
    );
    expect(legacyStatusCampaign?.eligible_students).toContainEqual(expect.objectContaining({
      student_id: secondStudentRowA,
      eligibility_state: "STUDENT_INELIGIBLE",
      current_grade_level: "2º ano",
    }));
    expect(guardianStatus.data?.campaigns.some(
      (entry: { campaign: { id: string } }) => entry.campaign.id === campaignB,
    )).toBe(false);
    expect(underageCampaign?.eligible_students).toContainEqual(expect.objectContaining({
      student_id: studentRowA,
      can_confirm: false,
      eligibility_state: "GRADE_RULE_REQUIRED",
    }));
    expect(adultCampaign?.eligible_students).toContainEqual(expect.objectContaining({
      student_id: adultStudentRowA,
      can_confirm: true,
      eligibility_state: "GRADE_RULE_REQUIRED",
    }));
    const futureCampaignStatus = guardianStatus.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === futureCampaign,
    );
    expect(futureCampaignStatus?.state).toBe("UPCOMING");

    const missingRuleRequest = await guardianA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignA,
        target_student_id: studentRowA,
      },
    );
    expect(missingRuleRequest.data).toBeNull();
    expect(missingRuleRequest.error?.message).toMatch(
      /REENROLLMENT_GRADE_RULE_REQUIRED/i,
    );
    const rolledBackRequest = await guardianA.client
      .from("reenrollment_requests")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignA)
      .eq("student_id", studentRowA);
    expect(rolledBackRequest.error).toBeNull();
    expect(rolledBackRequest.count).toBe(0);

    const foreignRuleSave = await directorB.client.rpc(
      "save_reenrollment_grade_rule_v24",
      {
        p_institution_id: institutionA,
        p_source_grade_level: "1º ano",
        p_destination_grade_level: "2º ano",
        p_destination_stage: null,
        p_promotion_policy: "PROMOTE",
      },
    );
    expect(foreignRuleSave.data).toBeNull();
    expect(foreignRuleSave.error?.code).toBe("42501");

    const gradeRuleSave = await secretaryA.client.rpc(
      "save_reenrollment_grade_rule_v24",
      {
        p_institution_id: institutionA,
        p_source_grade_level: "1º ano",
        p_destination_grade_level: "2º ano",
        p_destination_stage: null,
        p_promotion_policy: "PROMOTE",
      },
    );
    expect(gradeRuleSave.error).toBeNull();
    const duplicateGradeRuleSave = await directorA.client.rpc(
      "save_reenrollment_grade_rule_v24",
      {
        p_institution_id: institutionA,
        p_source_grade_level: " 1º ANO ",
        p_destination_grade_level: "2º ano",
        p_destination_stage: null,
        p_promotion_policy: "PROMOTE",
      },
    );
    expect(duplicateGradeRuleSave.error).toBeNull();
    expect(duplicateGradeRuleSave.data?.id).toBe(gradeRuleSave.data?.id);
    const gradeRuleA = gradeRuleSave.data;
    expect(gradeRuleA?.institution_id).toBe(institutionA);

    const gradeTwoRule = await secretaryA.client.rpc(
      "save_reenrollment_grade_rule_v24",
      {
        p_institution_id: institutionA,
        p_source_grade_level: "2º ano",
        p_destination_grade_level: "3º ano",
        p_destination_stage: null,
        p_promotion_policy: "PROMOTE",
      },
    );
    expect(gradeTwoRule.error).toBeNull();
    const automatedDestinationYear = (
      await insertOne(admin, "academic_years", {
        institution_id: institutionA,
        name: `2030 automatic destination ${suffix}`,
        start_date: "2030-01-01",
        end_date: "2030-12-31",
        active: true,
      })
    ).id;
    const automatedDestinationClass = (
      await insertOne(admin, "classes", {
        institution_id: institutionA,
        academic_year_id: automatedDestinationYear,
        name: `3º ano A ${suffix}`,
        grade_level: "3º ano",
        shift: "MATUTINO",
        capacity: 30,
        active: true,
      })
    ).id;
    const automaticCampaign = await publishCampaign(directorA.client, {
      institutionId: institutionA,
      sourceYearId: sourceYear,
      destinationYearId: automatedDestinationYear,
      title: `Campanha automatizada ${suffix}`,
      createdBy: directorA.id,
      eligibleGrades: ["2º ano"],
    });
    const automaticCampaignDetails = await directorA.client
      .from("reenrollment_campaigns")
      .select("contract_version, contract_hash")
      .eq("id", automaticCampaign)
      .single();
    expect(automaticCampaignDetails.error).toBeNull();
    const automaticRequest = await guardianA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: automaticCampaign,
        target_student_id: secondStudentRowA,
      },
    );
    expect(automaticRequest.error).toBeNull();
    const automaticAcceptance = await guardianA.client.rpc(
      "accept_reenrollment_contract_v1",
      {
        target_request_id: automaticRequest.data.id,
        accepted_contract_version: automaticCampaignDetails.data!.contract_version,
        accepted_contract_hash: automaticCampaignDetails.data!.contract_hash,
      },
    );
    expect(automaticAcceptance.error).toBeNull();

    const closeAcademicYear = await directorA.client.rpc(
      "close_reenrollment_academic_year_v2",
      {
        p_institution_id: institutionA,
        p_academic_year_id: sourceYear,
        p_notes: "Fechamento sintético do teste de integração.",
      },
    );
    expect(closeAcademicYear.error).toBeNull();
    const reviewAutomaticRequest = await directorA.client.rpc(
      "review_reenrollment_request_v1",
      {
        target_request_id: automaticRequest.data.id,
        next_academic_status: "APPROVED",
        next_financial_status: "NOT_REQUIRED",
        next_destination_class_id: automatedDestinationClass,
        review_notes: "Resultado preparado para validar o aceite explícito.",
      },
    );
    expect(reviewAutomaticRequest.error).toBeNull();
    const homologateAutomaticResult = await directorA.client.rpc(
      "homologate_reenrollment_result_v2",
      {
        p_request_id: automaticRequest.data.id,
        p_result_status: "APPROVED",
        p_average_percentage: 85,
        p_attendance_percentage: 96,
        p_decision_origin: "ACADEMIC_TEAM",
      },
    );
    expect(homologateAutomaticResult.error).toBeNull();

    const prematureFinalization = await guardianA.client.rpc(
      "finalize_reenrollment_v2",
      { p_request_id: automaticRequest.data.id },
    );
    expect(prematureFinalization.error).toBeNull();
    expect(prematureFinalization.data).toMatchObject({
      ready: false,
      blockers: ["REMATRICULA_NAO_CONFIRMADA"],
    });
    const forbiddenMinorFinalization = await studentA.client.rpc(
      "finalize_reenrollment_v2",
      { p_request_id: automaticRequest.data.id },
    );
    expect(forbiddenMinorFinalization.data).toBeNull();
    expect(forbiddenMinorFinalization.error?.message).toMatch(
      /REENROLLMENT_FINALIZE_NOT_ALLOWED/i,
    );

    const automaticConfirmation = await guardianA.client.rpc(
      "confirm_reenrollment_request_v1",
      { target_request_id: automaticRequest.data.id },
    );
    expect(automaticConfirmation.error).toBeNull();
    const automaticEnrollment = await admin
      .from("enrollments")
      .select("id, student_id, class_id, academic_year_id, active")
      .eq("student_id", secondStudentRowA)
      .eq("academic_year_id", automatedDestinationYear)
      .eq("active", true)
      .single();
    expect(automaticEnrollment.error).toBeNull();
    expect(automaticEnrollment.data).toMatchObject({
      student_id: secondStudentRowA,
      class_id: automatedDestinationClass,
      academic_year_id: automatedDestinationYear,
      active: true,
    });
    const sourceEnrollmentHistory = await admin
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", secondStudentRowA)
      .eq("academic_year_id", sourceYear)
      .eq("active", true);
    expect(sourceEnrollmentHistory.error).toBeNull();
    expect(sourceEnrollmentHistory.count).toBe(1);
    const finalizedAutomaticRequest = await guardianA.client
      .from("reenrollment_requests")
      .select("request_status, protocol, receipt_code, final_enrollment_id")
      .eq("id", automaticRequest.data.id)
      .single();
    expect(finalizedAutomaticRequest.data).toMatchObject({
      request_status: "ENROLLED",
      protocol: automaticRequest.data.protocol,
      final_enrollment_id: automaticEnrollment.data.id,
    });
    expect(finalizedAutomaticRequest.data?.receipt_code).toMatch(/^RMT-/);
    const replayedFinalization = await guardianA.client.rpc(
      "finalize_reenrollment_v2",
      { p_request_id: automaticRequest.data.id },
    );
    expect(replayedFinalization.error).toBeNull();
    expect(replayedFinalization.data).toMatchObject({
      ready: true,
      replayed: true,
      enrollment_id: automaticEnrollment.data.id,
      receipt_code: finalizedAutomaticRequest.data?.receipt_code,
    });

    const [configuredGuardianStatus, configuredAdultStatus] = await Promise.all([
      guardianA.client.rpc("get_my_reenrollment_status_v23", {
        p_institution_id: institutionA,
      }),
      adultStudentA.client.rpc("get_my_reenrollment_status_v23", {
        p_institution_id: institutionA,
      }),
    ]);
    expect(configuredGuardianStatus.error).toBeNull();
    expect(configuredAdultStatus.error).toBeNull();
    const configuredGuardianCampaign = configuredGuardianStatus.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === campaignA,
    );
    const configuredAdultCampaign = configuredAdultStatus.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === campaignA,
    );
    expect(configuredGuardianCampaign?.eligible_students).toContainEqual(expect.objectContaining({
      student_id: studentRowA,
      eligibility_state: "ELIGIBLE",
    }));
    expect(configuredAdultCampaign?.eligible_students).toContainEqual(expect.objectContaining({
      student_id: adultStudentRowA,
      eligibility_state: "ELIGIBLE",
    }));

    const ownRule = await secretaryA.client
      .from("reenrollment_grade_rules")
      .select("id")
      .eq("id", gradeRuleA.id);
    expect(ownRule.error).toBeNull();
    expect(ownRule.data).toHaveLength(1);

    const foreignRule = await secretaryA.client
      .from("reenrollment_grade_rules")
      .select("id")
      .eq("institution_id", institutionB);
    expect(foreignRule.error).toBeNull();
    expect(foreignRule.data).toHaveLength(0);

    const underageSelfRequest = await studentA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignA,
        target_student_id: studentRowA,
      },
    );
    expect(underageSelfRequest.data).toBeNull();
    expect(underageSelfRequest.error?.message).toMatch(
      /REENROLLMENT_STUDENT_NOT_ALLOWED/i,
    );

    const guardianRequest = await guardianA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignA,
        target_student_id: studentRowA,
      },
    );
    expect(guardianRequest.error).toBeNull();
    expect(guardianRequest.data?.institution_id).toBe(institutionA);
    expect(guardianRequest.data?.protocol).toMatch(/^RMT-/);

    const crossTenantRequest = await guardianA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignA,
        target_student_id: studentRowB,
      },
    );
    expect(crossTenantRequest.data).toBeNull();
    expect(crossTenantRequest.error?.message).toMatch(
      /REENROLLMENT_STUDENT_NOT_ALLOWED/i,
    );

    const otherStudentRequest = await studentA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignA,
        target_student_id: adultStudentRowA,
      },
    );
    expect(otherStudentRequest.data).toBeNull();
    expect(otherStudentRequest.error?.message).toMatch(
      /REENROLLMENT_STUDENT_NOT_ALLOWED/i,
    );

    const unauthorizedAcceptance = await studentA.client.rpc(
      "accept_reenrollment_contract_v1",
      {
        target_request_id: guardianRequest.data.id,
        accepted_contract_version: "v1",
        accepted_contract_hash: linkedCampaign.data!.contract_hash,
      },
    );
    expect(unauthorizedAcceptance.data).toBeNull();
    expect(unauthorizedAcceptance.error?.message).toMatch(
      /REENROLLMENT_REQUEST_NOT_ALLOWED/i,
    );

    const guardianAcceptance = await guardianA.client.rpc(
      "accept_reenrollment_contract_v1",
      {
        target_request_id: guardianRequest.data.id,
        accepted_contract_version: linkedCampaign.data!.contract_version,
        accepted_contract_hash: linkedCampaign.data!.contract_hash,
      },
    );
    expect(guardianAcceptance.error).toBeNull();
    const guardianConfirmation = await guardianA.client.rpc(
      "confirm_reenrollment_request_v1",
      { target_request_id: guardianRequest.data.id },
    );
    expect(guardianConfirmation.error).toBeNull();
    const confirmedRequest = await guardianA.client
      .from("reenrollment_requests")
      .select("protocol, confirmed_at, confirmed_by")
      .eq("id", guardianRequest.data.id)
      .single();
    expect(confirmedRequest.data?.protocol).toBe(guardianRequest.data.protocol);
    expect(confirmedRequest.data?.confirmed_at).toBeTruthy();
    expect(confirmedRequest.data?.confirmed_by).toBe(guardianA.id);

    const adultRequest = await adultStudentA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignA,
        target_student_id: adultStudentRowA,
      },
    );
    expect(adultRequest.error).toBeNull();
    const adultAcceptance = await adultStudentA.client.rpc(
      "accept_reenrollment_contract_v1",
      {
        target_request_id: adultRequest.data.id,
        accepted_contract_version: linkedCampaign.data!.contract_version,
        accepted_contract_hash: linkedCampaign.data!.contract_hash,
      },
    );
    expect(adultAcceptance.error).toBeNull();
    const adultConfirmation = await adultStudentA.client.rpc(
      "confirm_reenrollment_request_v1",
      { target_request_id: adultRequest.data.id },
    );
    expect(adultConfirmation.error).toBeNull();

    const deactivate = await directorA.client.rpc(
      "set_academic_calendar_event_active_v21",
      {
        p_event_id: linkedCampaign.data!.academic_calendar_event_id,
        p_institution_id: institutionA,
        p_active: false,
      },
    );
    expect(deactivate.error).toBeNull();
    const statusAfterClose = await guardianA.client.rpc("get_my_reenrollment_status_v23", {
      p_institution_id: institutionA,
    });
    const closedCampaignForGuardian = statusAfterClose.data?.campaigns?.find(
      (entry: { campaign: { id: string } }) => entry.campaign.id === campaignA,
    );
    expect(closedCampaignForGuardian?.state).toBe("CLOSED");
    const closedCampaign = await directorA.client
      .from("reenrollment_campaigns")
      .select("status")
      .eq("id", campaignA)
      .single();
    expect(closedCampaign.data?.status).toBe("CLOSED");

    const reopen = await directorA.client.rpc(
      "set_academic_calendar_event_active_v21",
      {
        p_event_id: linkedCampaign.data!.academic_calendar_event_id,
        p_institution_id: institutionA,
        p_active: true,
      },
    );
    expect(reopen.error).toBeNull();
    const reopenedCampaign = await directorA.client
      .from("reenrollment_campaigns")
      .select("status")
      .eq("id", campaignA)
      .single();
    expect(reopenedCampaign.data?.status).toBe("OPEN");
  }, 120_000);
});
