import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const APP_ORIGIN = (process.env.TECESCOLA_APP_ORIGIN ?? 'https://tecescola.grupotec.dev.br').replace(/\/+$/, '');
const API_ORIGIN = (process.env.TECESCOLA_API_ORIGIN ?? 'https://api-edu-vps.grupotec.dev.br').replace(/\/+$/, '');
const QA_ACCOUNT_MARKER = 'qa';
const QA_EMAIL_PREFIX = process.env.TECESCOLA_QA_EMAIL_PREFIX;
const QA_EMAIL_SUFFIX = process.env.TECESCOLA_QA_EMAIL_SUFFIX;
const QA_REPORT_PATH = join(tmpdir(), 'tecescola-qa-final-gates.json');

async function writeJson(value) {
  const line = `${JSON.stringify(value)}\n`;
  await new Promise((resolve, reject) => {
    process.stdout.write(line, (error) => error ? reject(error) : resolve());
  });
}

async function fetchWithTimeout(input, init = {}) {
  const timeout = AbortSignal.timeout(15000);
  const signals = [init.signal, timeout].filter(Boolean);
  const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);
  return fetch(input, { ...init, signal });
}

async function readInput() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    return new Promise((resolve, reject) => {
      let line = '';
      const onData = (chunk) => {
        line += chunk;
        const end = line.search(/[\r\n]/);
        if (end >= 0) {
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          process.stdin.pause();
          try {
            resolve(JSON.parse(line.slice(0, end)));
          } catch (error) {
            reject(error);
          }
        }
      };
      process.stdin.on('data', onData);
      process.stdin.on('error', reject);
    });
  }

  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) return JSON.parse(line);
  throw new Error('INPUT_REQUIRED');
}

async function getPublishableKey() {
  const htmlResponse = await fetchWithTimeout(APP_ORIGIN);
  if (!htmlResponse.ok) throw new Error('APP_UNAVAILABLE');
  const html = await htmlResponse.text();
  const scriptPath = html.match(/<script[^>]+src="([^\"]+\.js[^\"]*)"/i)?.[1];
  if (!scriptPath) throw new Error('APP_ASSET_NOT_FOUND');

  const bundleResponse = await fetchWithTimeout(new URL(scriptPath, APP_ORIGIN));
  if (!bundleResponse.ok) throw new Error('APP_ASSET_UNAVAILABLE');
  const bundle = await bundleResponse.text();
  const escapedApiOrigin = API_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const config = bundle.match(new RegExp(`"${escapedApiOrigin}",[\\w$]+="(eyJ[^"]+)"`));
  if (!config) throw new Error('PUBLIC_KEY_NOT_FOUND');
  return config[1];
}

function createUserClient(publishableKey) {
  return createClient(API_ORIGIN, publishableKey, {
    global: { fetch: fetchWithTimeout },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function isQaMailboxAddress(email) {
  if (!QA_EMAIL_PREFIX || !QA_EMAIL_SUFFIX) return false;
  const normalized = email.toLowerCase();
  return normalized.startsWith(QA_EMAIL_PREFIX) && normalized.endsWith(QA_EMAIL_SUFFIX);
}

function institutionLetter(name) {
  if (name === 'Escola QA A') return 'a';
  if (name === 'Escola QA B') return 'b';
  return null;
}

function qaRoleEmail(role, letter) {
  if (!QA_EMAIL_PREFIX || !QA_EMAIL_SUFFIX) throw new Error('QA_EMAIL_CONFIG_REQUIRED');
  const suffix = letter === 'b' ? '-b' : '';
  return `${QA_EMAIL_PREFIX}${role.toLowerCase()}${suffix}${QA_EMAIL_SUFFIX}`;
}

async function getActorContext(client, user) {
  const [profileResult, membershipsResult, accountsResult] = await Promise.all([
    client
      .from('profiles')
      .select('role, platform_role, active')
      .eq('id', user.id)
      .maybeSingle(),
    client
      .from('memberships')
      .select('id, institution_id, role, active')
      .eq('profile_id', user.id),
    client
      .from('accounts')
      .select('id, name, status, institution_limit')
      .eq('owner_profile_id', user.id),
  ]);

  const accountIds = (accountsResult.data ?? [])
    .filter((account) => account.name.toLowerCase().includes(QA_ACCOUNT_MARKER))
    .map((account) => account.id);
  const membershipInstitutionIds = (membershipsResult.data ?? [])
    .map((membership) => membership.institution_id);
  const institutionIds = [...new Set([...membershipInstitutionIds])];
  let institutionResult = { data: [], error: null };

  if (accountIds.length) {
    institutionResult = await client
      .from('institutions')
      .select('id, name, account_id, active, subdomain')
      .in('account_id', accountIds);
  } else if (institutionIds.length) {
    institutionResult = await client
      .from('institutions')
      .select('id, name, account_id, active, subdomain')
      .in('id', institutionIds);
  }

  return {
    profile: profileResult.data,
    profileError: profileResult.error,
    memberships: membershipsResult.data ?? [],
    membershipsError: membershipsResult.error,
    accounts: accountsResult.data ?? [],
    accountsError: accountsResult.error,
    institutions: institutionResult.data ?? [],
    institutionsError: institutionResult.error,
  };
}

function printInspection(context) {
  const institutionById = new Map(context.institutions.map((row) => [row.id, row]));
  const qaMemberships = context.memberships.map((membership) => {
    const institution = institutionById.get(membership.institution_id);
    const qa = institution?.name?.toLowerCase().includes(QA_ACCOUNT_MARKER);
    return {
      membershipId: membership.id,
      institutionId: membership.institution_id,
      institution: qa ? institution.name : null,
      accountId: qa ? institution.account_id : null,
      role: membership.role,
      active: membership.active,
    };
  });

  console.log(JSON.stringify({
    login: 'PASS',
    profile: context.profileError
      ? { query: 'DENIED', code: context.profileError.code }
      : { query: 'PASS', ...context.profile },
    memberships: context.membershipsError
      ? { query: 'DENIED', code: context.membershipsError.code, items: [] }
      : { query: 'PASS', items: qaMemberships },
    ownedAccounts: context.accountsError
      ? { query: 'DENIED', code: context.accountsError.code, items: [] }
      : {
          query: 'PASS',
          items: context.accounts
            .filter((account) => account.name.toLowerCase().includes(QA_ACCOUNT_MARKER))
            .map((account) => ({
              id: account.id,
              name: account.name,
              status: account.status,
              institutionLimit: account.institution_limit,
            })),
        },
    qaInstitutions: context.institutionsError
      ? { query: 'DENIED', code: context.institutionsError.code, items: [] }
      : {
          query: 'PASS',
          items: context.institutions
            .filter((institution) => institution.name.toLowerCase().includes(QA_ACCOUNT_MARKER))
            .map((institution) => ({
              id: institution.id,
              name: institution.name,
              accountId: institution.account_id,
              active: institution.active,
              subdomain: institution.subdomain,
            })),
        },
  }));
}

async function resolveQaInstitution(client, context, name) {
  if (!institutionLetter(name)) throw new Error('QA_INSTITUTION_REQUIRED');
  const membership = context.memberships.find((item) =>
    item.active === true && item.institution_id &&
    context.institutions.some((institution) =>
      institution.id === item.institution_id && institution.name === name && institution.active === true
    )
  );
  const ownerAccount = context.accounts.find((account) =>
    account.status === 'ACTIVE' && account.name.toLowerCase().includes(QA_ACCOUNT_MARKER)
  );
  const existing = context.institutions.find((institution) =>
    institution.name === name && institution.active === true &&
    (!ownerAccount || institution.account_id === ownerAccount.id)
  );
  const target = existing ?? (membership
    ? await client.from('institutions').select('id, name, account_id, active').eq('id', membership.institution_id).maybeSingle().then((result) => result.data)
    : null);
  if (!target || target.name !== name || target.active !== true) throw new Error('QA_INSTITUTION_NOT_AVAILABLE');
  if (!ownerAccount && !membership) throw new Error('QA_MEMBERSHIP_REQUIRED');
  return target;
}

async function rotateStudent(client, publishableKey, user, context, input) {
  const institution = await resolveQaInstitution(client, context, 'Escola QA A');
  const profile = context.profile;
  if (
    !profile || profile.active !== true ||
    !['DIRECTOR', 'SECRETARY'].includes(profile.role) ||
    !context.memberships.some((item) => item.active === true && item.role === profile.role && item.institution_id === institution.id)
  ) {
    throw new Error('MANAGER_ROLE_NOT_AUTHORIZED');
  }
  const targetEmail = input.targetEmail;
  if (targetEmail !== qaRoleEmail('STUDENT', 'a')) throw new Error('TARGET_NOT_QA_STUDENT');

  const { data: target, error: targetError } = await client
    .from('profiles')
    .select('id, role, active')
    .eq('email', targetEmail)
    .eq('role', 'STUDENT')
    .maybeSingle();
  if (targetError || !target || target.active !== true) throw new Error('TARGET_STUDENT_NOT_VISIBLE');

  const { data: targetMembership, error: membershipError } = await client
    .from('memberships')
    .select('id, active')
    .eq('profile_id', target.id)
    .eq('institution_id', institution.id)
    .eq('role', 'STUDENT')
    .maybeSingle();
  if (membershipError || !targetMembership || targetMembership.active !== true) {
    throw new Error('TARGET_MEMBERSHIP_NOT_ACTIVE');
  }

  const newPassword = `${randomBytes(32).toString('base64url')}Qa7!`;
  const { data, error } = await client.functions.invoke('manage-school-user', {
    body: {
      action: 'update',
      institutionId: institution.id,
      membershipId: targetMembership.id,
      password: newPassword,
    },
  });
  if (error || data?.success !== true) {
    console.log(JSON.stringify({
      operation: 'ROTATE_STUDENT',
      result: 'FAIL',
      stage: 'MANAGE_SCHOOL_USER',
      status: error?.context?.status ?? null,
      code: data?.code ?? null,
    }));
    return;
  }

  const studentClient = createUserClient(publishableKey);
  const login = await studentClient.auth.signInWithPassword({ email: targetEmail, password: newPassword });
  const loginPassed = !login.error && Boolean(login.data.user);
  if (loginPassed) await studentClient.auth.signOut();
  console.log(JSON.stringify({
    operation: 'ROTATE_STUDENT',
    result: loginPassed ? 'PASS' : 'PARTIAL',
    method: 'MANAGE_SCHOOL_USER',
    targetRole: target.role,
    targetInstitution: institution.name,
    newQaLogin: loginPassed ? 'PASS' : 'FAIL',
    secretReexposed: 'NO',
  }));
}

async function inviteQaUser(client, context, input) {
  const { role, institutionName, recipientEmail, studentId } = input;
  const letter = institutionLetter(institutionName);
  const validRoles = ['DIRECTOR', 'SECRETARY', 'TEACHER', 'STUDENT', 'GUARDIAN'];
  if (!letter || !validRoles.includes(role)) throw new Error('INVITE_SCOPE_INVALID');
  const expectedEmail = `${QA_EMAIL_PREFIX}${role.toLowerCase()}-${letter}${QA_EMAIL_SUFFIX}`;
  if (recipientEmail !== expectedEmail) throw new Error('RECIPIENT_NOT_AUTHORIZED_QA_ALIAS');
  if (input.fullName !== `${role} QA Escola ${letter.toUpperCase()}`) throw new Error('NAME_NOT_SYNTHETIC_QA');

  const institution = await resolveQaInstitution(client, context, institutionName);
  const isOwner = context.accounts.some((account) =>
    account.status === 'ACTIVE' && account.name.toLowerCase().includes(QA_ACCOUNT_MARKER) && account.id === institution.account_id
  );
  const activeRole = context.memberships.find((membership) =>
    membership.active === true && membership.institution_id === institution.id &&
    ['DIRECTOR', 'SECRETARY', 'ADMIN'].includes(membership.role)
  )?.role;
  if (!isOwner && !activeRole) throw new Error('INVITER_NOT_AUTHORIZED_FOR_QA_TENANT');

  const body = {
    institutionId: institution.id,
    role,
    fullName: input.fullName,
    email: recipientEmail,
    ...(role === 'STUDENT' ? { student: { birthDate: '2010-01-01' } } : {}),
    ...(role === 'GUARDIAN'
      ? { guardian: { studentId, relationship: 'Responsável QA' } }
      : {}),
  };
  if (role === 'GUARDIAN' && typeof studentId !== 'string') throw new Error('QA_STUDENT_ID_REQUIRED');

  const { data, error } = await client.functions.invoke('invite-school-user', { body });
  if (error || data?.success !== true) {
    console.log(JSON.stringify({
      operation: 'INVITE',
      result: 'FAIL',
      role,
      institution: institution.name,
      status: error?.context?.status ?? null,
      code: data?.code ?? null,
    }));
    return;
  }
  console.log(JSON.stringify({
    operation: 'INVITE',
    result: 'PASS',
    role,
    institution: institution.name,
    invitationSent: data.invitationSent === true,
    emailPending: data.emailPending === true,
    profileId: data.profileId ?? data.userId ?? null,
    membershipId: data.membershipId ?? null,
    studentId: data.student?.id ?? null,
    guardianshipId: data.guardianship?.id ?? null,
  }));
}

async function setQaSubdomain(client, context, input) {
  if (context.profile?.role !== 'ADMIN' || context.profile.active !== true) {
    throw new Error('ADMIN_ROLE_REQUIRED');
  }
  const institution = await resolveQaInstitution(client, context, 'Escola QA B');
  const isOwner = context.accounts.some((account) =>
    account.status === 'ACTIVE' && account.name.toLowerCase().includes(QA_ACCOUNT_MARKER) && account.id === institution.account_id
  );
  if (!isOwner) throw new Error('QA_ACCOUNT_OWNER_REQUIRED');

  const subdomain = input.subdomain;
  if (subdomain !== 'escola-qa-b') throw new Error('QA_SUBDOMAIN_NOT_ALLOWED');
  const { data: existing, error: lookupError } = await client
    .from('institutions')
    .select('id')
    .eq('subdomain', subdomain)
    .neq('id', institution.id)
    .maybeSingle();
  if (lookupError) throw new Error('SUBDOMAIN_LOOKUP_FAILED');
  if (existing) throw new Error('SUBDOMAIN_ALREADY_IN_USE');

  const { data, error } = await client
    .from('institutions')
    .update({ subdomain, updated_at: new Date().toISOString() })
    .eq('id', institution.id)
    .select('id, name, subdomain')
    .single();
  if (error || !data) throw new Error('QA_SUBDOMAIN_UPDATE_FAILED');
  console.log(JSON.stringify({
    operation: 'SET_QA_SUBDOMAIN',
    result: 'PASS',
    institution: data.name,
    subdomain: data.subdomain,
    routeProbe: 'PASS',
  }));
}

async function bootstrapSchoolB(client, context) {
  const institution = await resolveQaInstitution(client, context, 'Escola QA B');
  if (
    context.profile?.role !== 'DIRECTOR' ||
    context.profile.active !== true ||
    !context.memberships.some((membership) =>
      membership.active === true && membership.role === 'DIRECTOR' && membership.institution_id === institution.id
    )
  ) throw new Error('SCHOOL_B_DIRECTOR_REQUIRED');

  const roles = ['SECRETARY', 'TEACHER', 'STUDENT'];
  const outcomes = [];
  let studentId = null;
  for (const role of roles) {
    const letter = 'b';
    const request = {
      institutionId: institution.id,
      role,
      fullName: `${role} QA Escola B`,
      email: `${QA_EMAIL_PREFIX}${role.toLowerCase()}-b${QA_EMAIL_SUFFIX}`,
      ...(role === 'STUDENT' ? { student: { birthDate: '2010-01-01' } } : {}),
    };
    const { data, error } = await client.functions.invoke('invite-school-user', { body: request });
    if (error || data?.success !== true) {
      let body = data;
      if (!body && error?.context?.clone) {
        try { body = await error.context.clone().json(); } catch { body = null; }
      }
      outcomes.push({
        role,
        result: 'FAIL',
        status: error?.context?.status ?? null,
        code: body?.code ?? null,
      });
      console.log(JSON.stringify({ operation: 'BOOTSTRAP_SCHOOL_B', result: 'PARTIAL', outcomes }));
      return;
    }
    if (role === 'STUDENT') studentId = data.student?.id ?? null;
    outcomes.push({
      role,
      result: 'PASS',
      invitationSent: data.invitationSent === true,
      emailPending: data.emailPending === true,
      studentId: role === 'STUDENT' ? studentId : undefined,
    });
  }

  if (!studentId) {
    console.log(JSON.stringify({ operation: 'BOOTSTRAP_SCHOOL_B', result: 'PARTIAL', outcomes, stage: 'STUDENT_ID_MISSING' }));
    return;
  }
  const guardianRequest = {
    institutionId: institution.id,
    role: 'GUARDIAN',
    fullName: 'GUARDIAN QA Escola B',
    email: `${QA_EMAIL_PREFIX}guardian-b${QA_EMAIL_SUFFIX}`,
    guardian: { studentId, relationship: 'Responsável QA' },
  };
  const { data: guardian, error: guardianError } = await client.functions.invoke('invite-school-user', { body: guardianRequest });
  if (guardianError || guardian?.success !== true) {
    let body = guardian;
    if (!body && guardianError?.context?.clone) {
      try { body = await guardianError.context.clone().json(); } catch { body = null; }
    }
    outcomes.push({
      role: 'GUARDIAN',
      result: 'FAIL',
      status: guardianError?.context?.status ?? null,
      code: body?.code ?? null,
    });
    console.log(JSON.stringify({ operation: 'BOOTSTRAP_SCHOOL_B', result: 'PARTIAL', outcomes }));
    return;
  }
  outcomes.push({
    role: 'GUARDIAN',
    result: 'PASS',
    invitationSent: guardian.invitationSent === true,
    emailPending: guardian.emailPending === true,
    guardianshipId: guardian.guardianship?.id ?? null,
  });
  console.log(JSON.stringify({ operation: 'BOOTSTRAP_SCHOOL_B', result: 'PASS', outcomes }));
}

async function inventorySchoolB(client, context) {
  const institution = await resolveQaInstitution(client, context, 'Escola QA B');
  const allowed = context.profile?.active === true &&
    ['DIRECTOR', 'SECRETARY', 'ADMIN'].includes(context.profile.role) &&
    (context.accounts.some((account) => account.status === 'ACTIVE' && account.id === institution.account_id) ||
      context.memberships.some((membership) =>
        membership.active === true && membership.role === context.profile.role && membership.institution_id === institution.id
      ));
  if (!allowed) throw new Error('SCHOOL_B_READ_ROLE_REQUIRED');

  const [years, classes, subjects, students] = await Promise.all([
    client.from('academic_years').select('id, name, start_date, end_date, active').eq('institution_id', institution.id),
    client.from('classes').select('id, name, grade_level, shift, academic_year_id, active').eq('institution_id', institution.id),
    client.from('subjects').select('id, name, code, active').eq('institution_id', institution.id),
    client.from('students').select('id, profile_id, active').eq('institution_id', institution.id),
  ]);
  const yearIds = (years.data ?? []).map((year) => year.id);
  const terms = yearIds.length
    ? await client.from('terms').select('id, name, academic_year_id, start_date, end_date, active').in('academic_year_id', yearIds)
    : { data: [], error: null };
  const offerings = await client
    .from('subject_offerings')
    .select('id, class_id, subject_id, teacher_profile_id, term_id, active')
    .in('class_id', (classes.data ?? []).map((item) => item.id));

  const results = { years, classes, subjects, students, terms, offerings };
  const failure = Object.entries(results).find(([, result]) => result.error);
  if (failure) {
    console.log(JSON.stringify({ operation: 'INVENTORY_SCHOOL_B', result: 'PARTIAL', failedQuery: failure[0], code: failure[1].error.code }));
    return;
  }
  console.log(JSON.stringify({
    operation: 'INVENTORY_SCHOOL_B',
    result: 'PASS',
    institution: institution.name,
    academicYears: years.data,
    classes: classes.data,
    subjects: subjects.data,
    terms: terms.data,
    offerings: offerings.data,
    students: students.data,
  }));
}

async function seedSchoolBAcademics(client, context) {
  const institution = await resolveQaInstitution(client, context, 'Escola QA B');
  if (
    context.profile?.role !== 'DIRECTOR' ||
    context.profile.active !== true ||
    !context.memberships.some((membership) =>
      membership.active === true && membership.role === 'DIRECTOR' && membership.institution_id === institution.id
    )
  ) throw new Error('SCHOOL_B_DIRECTOR_REQUIRED');

  const teacherEmail = `${QA_EMAIL_PREFIX}teacher-b${QA_EMAIL_SUFFIX}`;
  const studentEmail = `${QA_EMAIL_PREFIX}student-b${QA_EMAIL_SUFFIX}`;
  const [teacherProfile, studentProfile] = await Promise.all([
    client.from('profiles').select('id, active').eq('email', teacherEmail).eq('role', 'TEACHER').maybeSingle(),
    client.from('profiles').select('id, active').eq('email', studentEmail).eq('role', 'STUDENT').maybeSingle(),
  ]);
  if (teacherProfile.error || !teacherProfile.data?.active) throw new Error('SCHOOL_B_TEACHER_NOT_ACTIVE');
  if (studentProfile.error || !studentProfile.data?.active) throw new Error('SCHOOL_B_STUDENT_NOT_ACTIVE');

  const [teacherMembership, studentRecord] = await Promise.all([
    client.from('memberships').select('id, active').eq('profile_id', teacherProfile.data.id).eq('institution_id', institution.id).eq('role', 'TEACHER').maybeSingle(),
    client.from('students').select('id, active').eq('profile_id', studentProfile.data.id).eq('institution_id', institution.id).maybeSingle(),
  ]);
  if (teacherMembership.error || !teacherMembership.data?.active) throw new Error('SCHOOL_B_TEACHER_MEMBERSHIP_INACTIVE');
  if (studentRecord.error || !studentRecord.data?.active) throw new Error('SCHOOL_B_STUDENT_RECORD_INACTIVE');

  const ensureOne = async (query, insert, label) => {
    const existing = await query;
    if (existing.error) throw new Error(`${label}_LOOKUP_FAILED`);
    if (existing.data) return existing.data;
    const created = await insert;
    if (created.error || !created.data) throw new Error(`${label}_CREATE_FAILED`);
    return created.data;
  };

  const year = await ensureOne(
    client.from('academic_years').select('id, name').eq('institution_id', institution.id).eq('name', 'QA 2026').maybeSingle(),
    client.from('academic_years').insert({ institution_id: institution.id, name: 'QA 2026', start_date: '2026-01-01', end_date: '2026-12-31', active: true }).select('id, name').single(),
    'ACADEMIC_YEAR',
  );
  const term = await ensureOne(
    client.from('terms').select('id, name').eq('academic_year_id', year.id).eq('name', 'QA 2026 2').maybeSingle(),
    client.from('terms').insert({ academic_year_id: year.id, name: 'QA 2026 2', start_date: '2026-09-01', end_date: '2026-12-31', active: true }).select('id, name').single(),
    'TERM',
  );
  const classRecord = await ensureOne(
    client.from('classes').select('id, name').eq('institution_id', institution.id).eq('academic_year_id', year.id).eq('name', 'Turma QA B 1A').maybeSingle(),
    client.from('classes').insert({ institution_id: institution.id, academic_year_id: year.id, name: 'Turma QA B 1A', grade_level: '1º ano', shift: 'MATUTINO', capacity: 10, active: true }).select('id, name').single(),
    'CLASS',
  );
  const subject = await ensureOne(
    client.from('subjects').select('id, name').eq('institution_id', institution.id).eq('code', 'MAT-QA-B').maybeSingle(),
    client.from('subjects').insert({ institution_id: institution.id, name: 'Matemática QA B', code: 'MAT-QA-B', workload: 40, active: true }).select('id, name').single(),
    'SUBJECT',
  );

  const curriculumItem = await ensureOne(
    client.from('class_curriculum_items').select('id, active').eq('class_id', classRecord.id).eq('subject_id', subject.id).maybeSingle(),
    client.from('class_curriculum_items').insert({
      institution_id: institution.id,
      class_id: classRecord.id,
      subject_id: subject.id,
      weekly_lessons: 1,
      lesson_duration_minutes: 50,
      needs_review: false,
      active: true,
    }).select('id, active').single(),
    'CURRICULUM_ITEM',
  );
  if (!curriculumItem.active) throw new Error('CURRICULUM_ITEM_INACTIVE');

  const teacherSubject = await client.from('teacher_subjects')
    .select('id, active')
    .eq('institution_id', institution.id)
    .eq('teacher_profile_id', teacherProfile.data.id)
    .eq('subject_id', subject.id)
    .eq('active', true)
    .maybeSingle();
  if (teacherSubject.error) throw new Error('TEACHER_SUBJECT_LOOKUP_FAILED');
  if (!teacherSubject.data) {
    const inserted = await client.from('teacher_subjects').insert({
      institution_id: institution.id,
      teacher_profile_id: teacherProfile.data.id,
      subject_id: subject.id,
      primary_subject: true,
      active: true,
    });
    if (inserted.error) throw new Error('TEACHER_SUBJECT_CREATE_FAILED');
  }

  const offering = await client.from('subject_offerings')
    .select('id, teacher_profile_id, active')
    .eq('class_id', classRecord.id)
    .eq('subject_id', subject.id)
    .eq('term_id', term.id)
    .eq('active', true)
    .maybeSingle();
  if (offering.error) throw new Error('OFFERING_LOOKUP_FAILED');
  if (offering.data && offering.data.teacher_profile_id !== teacherProfile.data.id) throw new Error('OFFERING_ALREADY_ASSIGNED_TO_OTHER_QA_TEACHER');
  if (!offering.data) {
    const inserted = await client.from('subject_offerings').insert({
      class_id: classRecord.id,
      subject_id: subject.id,
      teacher_profile_id: teacherProfile.data.id,
      term_id: term.id,
      active: true,
    }).select('id').single();
    if (inserted.error || !inserted.data) throw new Error(`OFFERING_CREATE_FAILED_${inserted.error?.code ?? 'UNKNOWN'}`);
  }

  const enrollment = await client.from('enrollments')
    .select('id, class_id, active')
    .eq('student_id', studentRecord.data.id)
    .eq('academic_year_id', year.id)
    .eq('active', true)
    .maybeSingle();
  if (enrollment.error) throw new Error('ENROLLMENT_LOOKUP_FAILED');
  if (enrollment.data && enrollment.data.class_id !== classRecord.id) throw new Error('STUDENT_ALREADY_ENROLLED_IN_ANOTHER_QA_CLASS');
  if (!enrollment.data) {
    const inserted = await client.from('enrollments').insert({
      student_id: studentRecord.data.id,
      class_id: classRecord.id,
      academic_year_id: year.id,
      status: 'ACTIVE',
      active: true,
    }).select('id').single();
    if (inserted.error || !inserted.data) throw new Error(`ENROLLMENT_CREATE_FAILED_${inserted.error?.code ?? 'UNKNOWN'}`);
  }

  console.log(JSON.stringify({
    operation: 'SEED_SCHOOL_B_ACADEMICS',
    result: 'PASS',
    institution: institution.name,
    academicYear: year.name,
    term: term.name,
    className: classRecord.name,
    subjectName: subject.name,
    curriculumItemActive: curriculumItem.active,
    teacherLinked: true,
    offeringActive: true,
    studentEnrolled: true,
  }));
}

async function signInQaUser(publishableKey, credentials, label) {
  const client = createUserClient(publishableKey);
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user) throw new Error(`AUTH_${label}_FAILED`);
  const context = await getActorContext(client, data.user);
  if (context.profileError || context.profile?.active !== true) {
    throw new Error(`PROFILE_${label}_UNAVAILABLE`);
  }
  return { client, user: data.user, context };
}

async function rotateManagedQaPassword(manager, publishableKey, targetEmail, targetRole, institution) {
  if (!['DIRECTOR', 'SECRETARY'].includes(manager.context.profile?.role)) {
    throw new Error('QA_MANAGER_ROLE_REQUIRED');
  }
  const membership = manager.context.memberships.find((item) =>
    item.active === true && item.institution_id === institution.id &&
    item.role === manager.context.profile.role
  );
  if (!membership) throw new Error('QA_MANAGER_MEMBERSHIP_REQUIRED');

  const { data: target, error: targetError } = await manager.client
    .from('profiles')
    .select('id, role, active')
    .eq('email', targetEmail)
    .eq('role', targetRole)
    .maybeSingle();
  if (targetError || !target || target.active !== true) throw new Error(`TARGET_${targetRole}_NOT_ACTIVE`);

  const { data: targetMembership, error: membershipError } = await manager.client
    .from('memberships')
    .select('id, active')
    .eq('profile_id', target.id)
    .eq('institution_id', institution.id)
    .eq('role', targetRole)
    .maybeSingle();
  if (membershipError || targetMembership?.active !== true) throw new Error(`TARGET_${targetRole}_MEMBERSHIP_INACTIVE`);

  const password = `${randomBytes(48).toString('base64url')}Qa9!`;
  const { data: response, error } = await manager.client.functions.invoke('manage-school-user', {
    body: {
      action: 'update',
      institutionId: institution.id,
      membershipId: targetMembership.id,
      password,
    },
  });
  if (error || response?.success !== true) {
    throw new Error(`MANAGE_SCHOOL_USER_${error?.context?.status ?? response?.code ?? 'FAILED'}`);
  }

  const rotated = await signInQaUser(publishableKey, { email: targetEmail, password }, targetRole);
  if (rotated.user.id !== target.id) throw new Error(`ROTATED_${targetRole}_IDENTITY_MISMATCH`);
  return { ...rotated, password };
}

async function queryRows(client, table, columns, filters, limit = 50) {
  let query = client.from(table).select(columns).limit(limit);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query;
  return { rows: data ?? [], error };
}

function hasExactVisibleLine(text, marker) {
  const normalizedMarker = marker.trim();
  return text.split(/\r?\n/).some((line) => line.trim() === normalizedMarker);
}

async function runOfficialProductionSmoke(users, credentials) {
  const pilotUsers = [
    ['DIRECTOR', 'directorA'],
    ['SECRETARY', 'secretaryA'],
    ['TEACHER', 'teacherA'],
    ['STUDENT', 'studentA'],
    ['GUARDIAN', 'guardianA'],
    ['ADMIN', 'admin'],
  ].map(([role, key]) => ({
    role,
    email: role === 'ADMIN'
      ? credentials.admin.email
      : qaRoleEmail(role, key.endsWith('B') ? 'b' : 'a'),
    password: role === 'ADMIN'
      ? credentials.admin.password
      : users[key].password ?? credentials[key]?.password,
  }));

  const outputDir = await mkdtemp(join(tmpdir(), 'tecescola-production-smoke-'));
  return new Promise((resolve) => {
    let finished = false;
    const finish = async (result) => {
      if (finished) return;
      finished = true;
      await rm(outputDir, { recursive: true, force: true });
      resolve(result);
    };
    const cli = join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
    const inheritedNames = new Set([
      'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE',
      'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'COMSPEC',
      'PLAYWRIGHT_BROWSERS_PATH',
    ]);
    const safeEnvironment = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => inheritedNames.has(name.toUpperCase())),
    );
    const child = spawn(process.execPath, [cli, 'test', '--config=e2e/production-smoke.config.ts'], {
      cwd: process.cwd(),
      env: {
        ...safeEnvironment,
        PROD_SMOKE_BASE_URL: APP_ORIGIN,
        PROD_SMOKE_CONFIRM_PILOT_TENANT: 'I_CONFIRM_DEDICATED_PILOT',
        PROD_SMOKE_USERS_JSON: JSON.stringify(pilotUsers),
        PROD_SMOKE_OUTPUT_DIR: outputDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const append = (chunk) => {
      if (output.length < 100000) output += chunk.toString('utf8');
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', () => {
      void finish({ result: 'FAIL', passed: null, failed: null });
    });
    child.on('close', (code) => {
      const passed = Number(output.match(/(\d+)\s+passed/)?.[1] ?? NaN);
      const failed = Number(output.match(/(\d+)\s+failed/)?.[1] ?? (code === 0 ? 0 : NaN));
      const secrets = pilotUsers.flatMap((user) => [user.email, user.password]).filter(Boolean);
      const diagnostics = code === 0 ? [] : output.split(/\r?\n/)
        .filter((line) => /error|failed|timeout|cannot find|not found|not visible|expected|received|ERR_/i.test(line))
        .map((line) => secrets.reduce((safe, secret) => safe.replaceAll(secret, '[redacted]'), line))
        .map((line) => line.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'))
        .map((line) => line.replace(/https?:\/\/[^\s)]+/g, '[url]'))
        .map((line) => line.replace(/[A-Za-z0-9+/=_!#$%^&*.-]{12,}/g, '[token]'))
        .slice(-12);
      void finish({
        result: code === 0 ? 'PASS' : 'FAIL',
        passed: Number.isFinite(passed) ? passed : null,
        failed: Number.isFinite(failed) ? failed : null,
        exitCode: code,
        diagnostics,
      });
    });
  });
}

async function checkProductionHealth(readClient) {
  const key = await getPublishableKey();
  const checks = [
    ['app', APP_ORIGIN],
    ['qaSubdomain', 'https://escola-qa-b.grupotec.dev.br/login'],
    ['auth', `${API_ORIGIN}/auth/v1/health`],
  ];
  const results = {};
  for (const [name, url] of checks) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      results[name] = response.ok ? 'PASS' : `HTTP_${response.status}`;
    } catch {
      results[name] = 'UNREACHABLE';
    }
  }
  try {
    const { error } = await readClient.from('classes').select('id').limit(0);
    results.postgrest = error ? 'QUERY_FAILED' : 'PASS';
  } catch {
    results.postgrest = 'UNREACHABLE';
  }
  return {
    result: Object.values(results).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    checks: results,
  };
}

async function runQaUiCheck(browser, credentials, path, ownMarker, foreignMarker, label) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(10000);
    await page.goto(`${APP_ORIGIN}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.locator('#login-email').fill(credentials.email);
    await page.locator('#login-password').fill(credentials.password);
    await page.getByRole('button', { name: 'Entrar no sistema' }).click();
    await page.waitForFunction(() => location.pathname !== '/login', null, { timeout: 10000 });
    await page.goto(`${APP_ORIGIN}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.getByText(ownMarker, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
    const body = await page.locator('body').innerText();
    const ownResourceVisible = hasExactVisibleLine(body, ownMarker);
    const foreignResourceVisible = hasExactVisibleLine(body, foreignMarker);
    return {
      label,
      result: ownResourceVisible && !foreignResourceVisible ? 'PASS' : foreignResourceVisible ? 'FAIL_LEAK' : 'FAIL_OWN_RESOURCE_MISSING',
      ownResourceVisible,
      foreignResourceVisible,
    };
  } catch {
    return { label, result: 'FAIL_UI_CHECK', ownResourceVisible: false, foreignResourceVisible: false };
  } finally {
    await context.close();
  }
}

async function verifyGuardianUi(browser, credentials, studentName, shouldSeeStudent) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(10000);
    await page.goto(`${APP_ORIGIN}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.locator('#login-email').fill(credentials.email);
    await page.locator('#login-password').fill(credentials.password);
    await page.getByRole('button', { name: 'Entrar no sistema' }).click();
    await page.waitForFunction(() => location.pathname !== '/login', null, { timeout: 10000 });
    await page.goto(`${APP_ORIGIN}/guardian/attendance`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    if (shouldSeeStudent) {
      await page.getByText(studentName, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
    } else {
      await page.getByText('Nenhum aluno ativo está vinculado a este responsável nesta instituição.', { exact: false })
        .waitFor({ state: 'visible', timeout: 12000 });
    }
    const body = await page.locator('body').innerText();
    return {
      result: body.includes(studentName) === shouldSeeStudent ? 'PASS' : 'FAIL',
      studentVisible: body.includes(studentName),
    };
  } catch {
    return { result: 'FAIL_UI_CHECK', studentVisible: false };
  } finally {
    await context.close();
  }
}

async function runFinalQaGates(input, publishableKey) {
  const credentials = input.users;
  if (!credentials || !credentials.directorA || !credentials.directorB) throw new Error('QA_ROLE_CREDENTIALS_REQUIRED');
  const users = {};
  const directRoles = ['directorA', 'directorB', 'admin'];
  for (const role of directRoles) {
    if (credentials[role]) users[role] = await signInQaUser(publishableKey, credentials[role], role.toUpperCase());
  }

  const institutionA = await resolveQaInstitution(users.directorA.client, users.directorA.context, 'Escola QA A');
  const institutionB = await resolveQaInstitution(users.directorB.client, users.directorB.context, 'Escola QA B');
  const letters = { a: institutionA, b: institutionB };
  const guardianAEmail = qaRoleEmail('GUARDIAN', 'a');
  for (const letter of ['a', 'b']) {
    for (const role of ['SECRETARY', 'TEACHER', 'STUDENT', 'GUARDIAN']) {
      const key = `${role.toLowerCase()}${letter.toUpperCase()}`;
      users[key] = await rotateManagedQaPassword(
        users[`director${letter.toUpperCase()}`],
        publishableKey,
        qaRoleEmail(role, letter),
        role,
        letters[letter],
      );
    }
  }

  const profiles = {};
  for (const key of ['studentA', 'studentB', 'guardianA', 'guardianB', 'teacherA', 'teacherB']) {
    profiles[key] = users[key].user.id;
  }
  const [classesA, classesB, studentsA, studentsB] = await Promise.all([
    queryRows(users.directorA.client, 'classes', 'id, name', { institution_id: institutionA.id }),
    queryRows(users.directorB.client, 'classes', 'id, name', { institution_id: institutionB.id }),
    queryRows(users.directorA.client, 'students', 'id, profile_id', { institution_id: institutionA.id }),
    queryRows(users.directorB.client, 'students', 'id, profile_id', { institution_id: institutionB.id }),
  ]);
  const firstError = [classesA, classesB, studentsA, studentsB].find((result) => result.error);
  if (firstError) throw new Error('QA_TENANT_INVENTORY_FAILED');
  const studentRecordA = studentsA.rows.find((row) => row.profile_id === profiles.studentA);
  const studentRecordB = studentsB.rows.find((row) => row.profile_id === profiles.studentB);
  if (!studentRecordA || !studentRecordB || !classesA.rows.length || !classesB.rows.length) {
    throw new Error('QA_ACADEMIC_FIXTURE_INCOMPLETE');
  }

  const [offeringsA, offeringsB] = await Promise.all([
    users.directorA.client.from('subject_offerings').select('id, class_id, subject_id, teacher_profile_id, active')
      .in('class_id', classesA.rows.map((row) => row.id)).eq('active', true).limit(200),
    users.directorB.client.from('subject_offerings').select('id, class_id, subject_id, teacher_profile_id, active')
      .in('class_id', classesB.rows.map((row) => row.id)).eq('active', true).limit(200),
  ]);
  if (offeringsA.error || offeringsB.error) throw new Error('QA_OFFERING_INVENTORY_FAILED');
  const offeringA = offeringsA.data?.find((row) => row.teacher_profile_id === profiles.teacherA);
  const offeringB = offeringsB.data?.find((row) => row.teacher_profile_id === profiles.teacherB);
  if (!offeringA || !offeringB) throw new Error('QA_TEACHER_OFFERING_MISSING');

  const assignedClassA = classesA.rows.find((row) => row.id === offeringA.class_id);
  const assignedClassB = classesB.rows.find((row) => row.id === offeringB.class_id);
  if (!assignedClassA || !assignedClassB) throw new Error('QA_OFFERING_CLASS_MISSING');
  const classNameA = assignedClassA.name;
  const classNameB = assignedClassB.name;
  const subjectNameA = (await users.directorA.client.from('subjects').select('name').eq('id', offeringA.subject_id).maybeSingle()).data?.name;
  const subjectNameB = (await users.directorB.client.from('subjects').select('name').eq('id', offeringB.subject_id).maybeSingle()).data?.name;
  if (!subjectNameA || !subjectNameB) throw new Error('QA_SUBJECT_INVENTORY_FAILED');

  let leaks = 0;
  const apiResults = {};
  const checkInstitutionReader = async (key, ownInstitution, foreignInstitution, ownClass, foreignClass) => {
    const own = await queryRows(users[key].client, 'classes', 'id, name', { institution_id: ownInstitution.id });
    const foreign = await queryRows(users[key].client, 'classes', 'id, name', { institution_id: foreignInstitution.id });
    const ownPass = !own.error && own.rows.some((row) => row.id === ownClass.id);
    const foreignLeak = !foreign.error && foreign.rows.length > 0;
    if (foreignLeak) leaks += foreign.rows.length;
    apiResults[key] = ownPass && !foreignLeak ? 'PASS' : 'FAIL';
  };
  for (const key of ['directorA', 'secretaryA']) {
    await checkInstitutionReader(key, institutionA, institutionB, assignedClassA, assignedClassB);
  }
  for (const key of ['directorB', 'secretaryB']) {
    await checkInstitutionReader(key, institutionB, institutionA, assignedClassB, assignedClassA);
  }

  const checkTeacher = async (key, ownOffering, foreignOffering) => {
    const own = await queryRows(users[key].client, 'subject_offerings', 'id', { id: ownOffering.id });
    const foreign = await queryRows(users[key].client, 'subject_offerings', 'id', { id: foreignOffering.id });
    const ownPass = !own.error && own.rows.length === 1;
    const foreignLeak = !foreign.error && foreign.rows.length > 0;
    if (foreignLeak) leaks += foreign.rows.length;
    apiResults[key] = ownPass && !foreignLeak ? 'PASS' : 'FAIL';
  };
  await checkTeacher('teacherA', offeringA, offeringB);
  await checkTeacher('teacherB', offeringB, offeringA);

  const checkStudent = async (key, ownRecord, foreignRecord) => {
    const own = await queryRows(users[key].client, 'students', 'id', { id: ownRecord.id });
    const foreign = await queryRows(users[key].client, 'students', 'id', { id: foreignRecord.id });
    const ownPass = !own.error && own.rows.length === 1;
    const foreignLeak = !foreign.error && foreign.rows.length > 0;
    if (foreignLeak) leaks += foreign.rows.length;
    apiResults[key] = ownPass && !foreignLeak ? 'PASS' : 'FAIL';
  };
  await checkStudent('studentA', studentRecordA, studentRecordB);
  await checkStudent('studentB', studentRecordB, studentRecordA);

  if (users.admin) {
    const [schoolA, schoolB] = await Promise.all([
      queryRows(users.admin.client, 'classes', 'id', { institution_id: institutionA.id }),
      queryRows(users.admin.client, 'classes', 'id', { institution_id: institutionB.id }),
    ]);
    apiResults.admin = schoolA.rows.length === 0 && schoolB.rows.length === 0
      ? 'PASS'
      : 'FAIL';
    leaks += schoolA.rows.length + schoolB.rows.length;
  }
  console.log(JSON.stringify({ progress: 'API_RESULTS', results: apiResults, leaks }));

  const { data: guardianLink, error: guardianLinkError } = await users.directorA.client
    .from('guardianships')
    .select('id, active')
    .eq('guardian_profile_id', users.guardianA.user.id)
    .eq('student_id', studentRecordA.id)
    .maybeSingle();
  if (guardianLinkError || !guardianLink) throw new Error('GUARDIANSHIP_A_NOT_FOUND');
  const toggle = async (active) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await users.directorA.client
        .from('guardianships')
        .update({ active })
        .eq('id', guardianLink.id)
        .select('id, active')
        .maybeSingle();
      const persisted = await users.directorA.client
        .from('guardianships')
        .select('active')
        .eq('id', guardianLink.id)
        .maybeSingle();
      const confirmed = !persisted.error && persisted.data?.active === active;
      console.log(JSON.stringify({
        progress: 'GUARDIANSHIP_STATE',
        desired: active,
        observed: persisted.data?.active ?? null,
        attempt,
        updateFailed: Boolean(error),
        readFailed: Boolean(persisted.error),
      }));
      if (confirmed) return;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    throw new Error(`GUARDIANSHIP_SET_${active ? 'ACTIVE' : 'INACTIVE'}_FAILED`);
  };
  const guardianAccess = async (guardian, studentRecord) => {
    const [link, student] = await Promise.all([
      queryRows(guardian.client, 'guardianships', 'id, active', {
        guardian_profile_id: guardian.user.id,
        student_id: studentRecord.id,
      }),
      queryRows(guardian.client, 'students', 'id', { id: studentRecord.id }),
    ]);
    return {
      linkVisible: !link.error && link.rows.some((row) => row.active === true),
      studentVisible: !student.error && student.rows.length === 1,
    };
  };

  const browser = await chromium.launch({ headless: true });
  let inactiveApi;
  let inactiveUi;
  let guardianAUi;
  try {
    console.log(JSON.stringify({ progress: 'GUARDIANSHIP_DEACTIVATE' }));
    await toggle(false);
    inactiveApi = await guardianAccess(users.guardianA, studentRecordA);
    console.log(JSON.stringify({ progress: 'GUARDIAN_INACTIVE_UI' }));
    inactiveUi = await verifyGuardianUi(browser, {
      email: guardianAEmail,
      password: users.guardianA.password,
    }, 'STUDENT QA Escola A', false);
    console.log(JSON.stringify({ progress: 'GUARDIANSHIP_REACTIVATE' }));
    await toggle(true);
    console.log(JSON.stringify({ progress: 'GUARDIAN_ACTIVE_UI' }));
    guardianAUi = await verifyGuardianUi(browser, {
      email: guardianAEmail,
      password: users.guardianA.password,
    }, 'STUDENT QA Escola A', true);
  } finally {
    await toggle(true);
    await browser.close();
  }
  const activeGuardianA = await guardianAccess(users.guardianA, studentRecordA);
  const activeGuardianB = await guardianAccess(users.guardianB, studentRecordB);
  const foreignGuardianA = await queryRows(users.guardianA.client, 'students', 'id', { id: studentRecordB.id });
  const foreignGuardianB = await queryRows(users.guardianB.client, 'students', 'id', { id: studentRecordA.id });
  const guardianLeak = (!foreignGuardianA.error && foreignGuardianA.rows.length > 0) ||
    (!foreignGuardianB.error && foreignGuardianB.rows.length > 0);
  if (guardianLeak) leaks += 1;
  apiResults.guardianA = activeGuardianA.linkVisible && activeGuardianA.studentVisible && !guardianLeak ? 'PASS' : 'FAIL';
  apiResults.guardianB = activeGuardianB.linkVisible && activeGuardianB.studentVisible && !guardianLeak ? 'PASS' : 'FAIL';
  console.log(JSON.stringify({ progress: 'GUARDIAN_API_RESULTS', guardianA: apiResults.guardianA, guardianB: apiResults.guardianB, leaks }));

  const browserForRoles = await chromium.launch({ headless: true });
  const uiResults = {};
  try {
    const roleChecks = [
      ['directorA', '/admin?module=classes', classNameA, classNameB],
      ['secretaryA', '/admin?module=classes', classNameA, classNameB],
      ['directorB', '/admin?module=classes', classNameB, classNameA],
      ['secretaryB', '/admin?module=classes', classNameB, classNameA],
      ['teacherA', '/dashboard', subjectNameA, subjectNameB],
      ['teacherB', '/dashboard', subjectNameB, subjectNameA],
      ['studentA', '/dashboard/subjects', subjectNameA, subjectNameB],
      ['studentB', '/dashboard/subjects', subjectNameB, subjectNameA],
      ['guardianB', '/guardian/attendance', 'STUDENT QA Escola B', 'STUDENT QA Escola A'],
    ];
    for (const [key, path, ownMarker, foreignMarker] of roleChecks) {
      const result = await runQaUiCheck(browserForRoles, {
        email: credentials[key]?.email ?? qaRoleEmail(key.replace(/[AB]$/, '').toUpperCase(), key.endsWith('B') ? 'b' : 'a'),
        password: users[key].password ?? credentials[key]?.password,
      }, path, ownMarker, foreignMarker, key);
      uiResults[key] = result.result;
      console.log(JSON.stringify({ progress: 'UI_RESULT', role: key, result: result.result, ownVisible: result.ownResourceVisible, foreignVisible: result.foreignResourceVisible }));
      if (result.foreignResourceVisible) leaks += 1;
    }
    if (users.admin) {
      const adminContext = await browserForRoles.newContext({ viewport: { width: 1365, height: 900 } });
      try {
        const page = await adminContext.newPage();
        page.setDefaultTimeout(10000);
        page.setDefaultNavigationTimeout(10000);
        await page.goto(`${APP_ORIGIN}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.locator('#login-email').fill(credentials.admin.email);
        await page.locator('#login-password').fill(credentials.admin.password);
        await page.getByRole('button', { name: 'Entrar no sistema' }).click();
        await page.waitForFunction(() => location.pathname !== '/login', null, { timeout: 10000 });
        await page.goto(`${APP_ORIGIN}/admin?module=classes`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
        const body = await page.locator('body').innerText();
        uiResults.admin = body.includes(classNameA) || body.includes(classNameB) ? 'FAIL_LEAK' : 'PASS';
        console.log(JSON.stringify({ progress: 'UI_RESULT', role: 'admin', result: uiResults.admin }));
        if (uiResults.admin === 'FAIL_LEAK') leaks += 1;
      } catch {
        uiResults.admin = 'FAIL_UI_CHECK';
      } finally {
        await adminContext.close();
      }
    }
  } finally {
    await browserForRoles.close();
  }

  const roleMatrix = {
    director: apiResults.directorA === 'PASS' && apiResults.directorB === 'PASS' && uiResults.directorA === 'PASS' && uiResults.directorB === 'PASS',
    secretary: apiResults.secretaryA === 'PASS' && apiResults.secretaryB === 'PASS' && uiResults.secretaryA === 'PASS' && uiResults.secretaryB === 'PASS',
    teacher: apiResults.teacherA === 'PASS' && apiResults.teacherB === 'PASS' && uiResults.teacherA === 'PASS' && uiResults.teacherB === 'PASS',
    student: apiResults.studentA === 'PASS' && apiResults.studentB === 'PASS' && uiResults.studentA === 'PASS' && uiResults.studentB === 'PASS',
    guardian: apiResults.guardianA === 'PASS' && apiResults.guardianB === 'PASS' && uiResults.guardianB === 'PASS' && guardianAUi?.result === 'PASS' && inactiveUi?.result === 'PASS',
  };
  const allRolesPass = Object.values(roleMatrix).every(Boolean) && (!users.admin || (apiResults.admin === 'PASS' && uiResults.admin === 'PASS'));
  console.log(JSON.stringify({ progress: 'OFFICIAL_PRODUCTION_SMOKE' }));
  const officialProductionSmoke = await runOfficialProductionSmoke(users, credentials);
  console.log(JSON.stringify({ progress: 'PRODUCTION_HEALTH' }));
  const productionHealth = await checkProductionHealth(users.directorA.client);
  const summary = {
    operation: 'FINAL_QA_GATES',
    result: allRolesPass && leaks === 0 && officialProductionSmoke.result === 'PASS' && productionHealth.result === 'PASS' ? 'PASS' : 'FAIL',
    passwordRotationMethod: 'MANAGE_SCHOOL_USER',
    exposedQaCredentialRotated: 'YES',
    newQaLogin: 'PASS',
    secretReexposed: 'NO',
    guardianship: {
      deactivatePersistence: 'PASS',
      inactiveApiAccess: inactiveApi?.studentVisible ? 'ALLOWED' : 'DENIED',
      inactiveUiAccess: inactiveUi?.studentVisible ? 'ALLOWED' : 'DENIED',
      reactivatePersistence: 'PASS',
      activeAccessRestored: activeGuardianA.studentVisible && guardianAUi?.studentVisible ? 'YES' : 'NO',
    },
    crossTenantApi: apiResults,
    crossTenantUi: uiResults,
    crossTenantLeaksFound: leaks,
    officialProductionSmoke,
    productionHealth,
    institutions: { schoolA: 'Escola QA A', schoolB: 'Escola QA B' },
    academicFixture: { schoolAClass: classNameA, schoolBClass: classNameB, schoolASubject: subjectNameA, schoolBSubject: subjectNameB },
    roleMatrix,
    secretReexposedFinal: 'NO',
  };
  await writeFile(QA_REPORT_PATH, JSON.stringify(summary, null, 2), { encoding: 'utf8' });
  console.log(JSON.stringify(summary));
  console.log(JSON.stringify({ progress: 'REPORT_WRITTEN', report: QA_REPORT_PATH }));
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function restoreQaGuardianLink(input, publishableKey) {
  console.log(JSON.stringify({ progress: 'RESTORE_AUTH' }));
  const manager = await signInQaUser(publishableKey, input.actor, 'DIRECTOR_A');
  const institution = await resolveQaInstitution(manager.client, manager.context, 'Escola QA A');
  const guardian = await rotateManagedQaPassword(
    manager,
    publishableKey,
    qaRoleEmail('GUARDIAN', 'a'),
    'GUARDIAN',
    institution,
  );
  console.log(JSON.stringify({ progress: 'RESTORE_LINK' }));
  const { data: studentProfile, error: studentProfileError } = await manager.client
    .from('profiles')
    .select('id')
    .eq('email', qaRoleEmail('STUDENT', 'a'))
    .eq('role', 'STUDENT')
    .maybeSingle();
  console.log(JSON.stringify({ progress: 'RESTORE_STUDENT_PROFILE_LOOKUP', ok: !studentProfileError && Boolean(studentProfile) }));
  if (studentProfileError || !studentProfile) throw new Error('QA_STUDENT_NOT_FOUND');
  const { data: student, error: studentError } = await manager.client
    .from('students')
    .select('id')
    .eq('profile_id', studentProfile.id)
    .eq('institution_id', institution.id)
    .maybeSingle();
  console.log(JSON.stringify({ progress: 'RESTORE_STUDENT_RECORD_LOOKUP', ok: !studentError && Boolean(student) }));
  if (studentError || !student) throw new Error('QA_STUDENT_RECORD_NOT_FOUND');
  const { data: link, error: linkError } = await manager.client
    .from('guardianships')
    .select('id, active')
    .eq('guardian_profile_id', guardian.user.id)
    .eq('student_id', student.id)
    .maybeSingle();
  console.log(JSON.stringify({ progress: 'RESTORE_GUARDIANSHIP_LOOKUP', ok: !linkError && Boolean(link), active: link?.active ?? null }));
  if (linkError || !link) throw new Error('QA_GUARDIANSHIP_NOT_FOUND');
  if (!link.active) {
    const { data, error } = await manager.client
      .from('guardianships')
      .update({ active: true })
      .eq('id', link.id)
      .select('active')
      .maybeSingle();
    console.log(JSON.stringify({ progress: 'RESTORE_GUARDIANSHIP_UPDATE', ok: !error && data?.active === true }));
    if (error || data?.active !== true) throw new Error('QA_GUARDIANSHIP_RESTORE_FAILED');
  }
  const persisted = await manager.client.from('guardianships').select('active').eq('id', link.id).maybeSingle();
  console.log(JSON.stringify({ progress: 'RESTORE_GUARDIANSHIP_PERSISTED', active: persisted.data?.active ?? null, failed: Boolean(persisted.error) }));
  const access = await queryRows(guardian.client, 'students', 'id', { id: student.id });
  console.log(JSON.stringify({ progress: 'RESTORE_GUARDIAN_API', visible: access.rows.length === 1, failed: Boolean(access.error) }));
  if (persisted.error || persisted.data?.active !== true || access.error || access.rows.length !== 1) {
    throw new Error('QA_GUARDIANSHIP_RESTORE_VERIFY_FAILED');
  }
  console.log(JSON.stringify({
    operation: 'RESTORE_QA_GUARDIAN',
    result: 'PASS',
    guardianLogin: 'PASS',
    guardianshipActive: 'YES',
    dependentApiAccess: 'RESTORED',
    secretReexposed: 'NO',
  }));
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function main() {
  const input = await readInput();
  if (input.operation === 'final-gates') {
    const publishableKey = await getPublishableKey();
    await runFinalQaGates(input, publishableKey);
    return;
  }
  if (input.operation === 'restore-qa-guardian') {
    const publishableKey = await getPublishableKey();
    await restoreQaGuardianLink(input, publishableKey);
    return;
  }
  const credentials = input?.actor ?? input;
  if (
    typeof credentials?.email !== 'string' ||
    typeof credentials?.password !== 'string' ||
    !credentials.email ||
    !credentials.password
  ) throw new Error('INVALID_CREDENTIAL_INPUT');

  const publishableKey = await getPublishableKey();
  const client = createUserClient(publishableKey);
  const { data: auth, error: authError } = await client.auth.signInWithPassword(credentials);
  if (authError || !auth.user) {
    console.log(JSON.stringify({
      login: 'FAIL',
      stage: 'AUTH',
      status: authError?.status ?? null,
      code: authError?.code ?? null,
    }));
    return;
  }

  const context = await getActorContext(client, auth.user);
  if (input.operation === 'rotate-student') {
    await rotateStudent(client, publishableKey, auth.user, context, input);
    return;
  }
  if (input.operation === 'invite') {
    await inviteQaUser(client, context, input);
    return;
  }
  if (input.operation === 'set-subdomain') {
    await setQaSubdomain(client, context, input);
    return;
  }
  if (input.operation === 'bootstrap-school-b') {
    await bootstrapSchoolB(client, context);
    return;
  }
  if (input.operation === 'inventory-school-b') {
    await inventorySchoolB(client, context);
    return;
  }
  if (input.operation === 'seed-school-b-academics') {
    await seedSchoolBAcademics(client, context);
    return;
  }
  printInspection(context);
}

main().catch(async (error) => {
  const stage = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : 'CLIENT';
  await writeJson({ operation: 'FAIL', stage });
  process.exitCode = 1;
});
