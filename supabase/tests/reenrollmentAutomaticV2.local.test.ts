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
  if (error) throw new Error(`auth ${label}: ${error.message}`);
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
    const guardianA = await createActor(
      admin,
      "GUARDIAN",
      "guardian-a",
      suffix,
    );
    const directorB = await createActor(
      admin,
      "DIRECTOR",
      "director-b",
      suffix,
    );
    const studentB = await createActor(admin, "STUDENT", "student-b", suffix);

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
      [guardianA.id, institutionA, "GUARDIAN"],
      [directorB.id, institutionB, "DIRECTOR"],
      [studentB.id, institutionB, "STUDENT"],
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

    const campaignA = (
      await insertOne(directorA.client, "reenrollment_campaigns", {
        institution_id: institutionA,
        source_academic_year_id: sourceYear,
        destination_academic_year_id: destinationYear,
        title: `Campanha A ${suffix}`,
        status: "OPEN",
        opens_at: "2026-01-01T00:00:00Z",
        closes_at: "2027-12-31T23:59:59Z",
        contract_version: "v1",
        contract_hash: `hash-${suffix}`,
        contract_body: "Contrato de teste.",
        require_academic_result: true,
        require_financial_clearance: false,
        finance_mode: "NOT_REQUIRED",
        created_by: directorA.id,
      })
    ).id;
    const campaignB = (
      await insertOne(directorB.client, "reenrollment_campaigns", {
        institution_id: institutionB,
        source_academic_year_id: sourceYearB,
        destination_academic_year_id: destinationYearB,
        title: `Campanha B ${suffix}`,
        status: "OPEN",
        opens_at: "2026-01-01T00:00:00Z",
        closes_at: "2027-12-31T23:59:59Z",
        contract_version: "v1",
        contract_hash: `hash-b-${suffix}`,
        contract_body: "Contrato de teste.",
        require_academic_result: true,
        require_financial_clearance: false,
        finance_mode: "NOT_REQUIRED",
        created_by: directorB.id,
      })
    ).id;

    const gradeRuleA = await insertOne(admin, "reenrollment_grade_rules", {
      institution_id: institutionA,
      source_grade_level: "1º ano",
      destination_grade_level: "2º ano",
      promotion_policy: "PROMOTE",
      created_by: directorA.id,
    });
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

    const crossTenantRequest = await guardianA.client.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignB,
        target_student_id: studentRowB,
      },
    );
    expect(crossTenantRequest.data).toBeNull();
    expect(crossTenantRequest.error?.message).toMatch(
      /REENROLLMENT_STUDENT_NOT_ALLOWED/i,
    );
  }, 120_000);
});
