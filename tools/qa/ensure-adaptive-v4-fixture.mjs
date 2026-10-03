import { createClient } from '@supabase/supabase-js';

const DEFAULT_INSTITUTION = 'Escola QA A';
const TARGETS = [
  { code: 'MATH_PERCENT_OF_QUANTITY', subjectCode: 'MQA', subjectName: 'Matemática QA', area: 'MATHEMATICS' },
  { code: 'MATH_RATIO_UNIT_RATE', subjectCode: 'MQA', subjectName: 'Matemática QA', area: 'MATHEMATICS' },
  { code: 'PORTUGUESE_ARGUMENT_EVIDENCE', subjectCode: 'QA-V4-PORT', subjectName: 'Língua Portuguesa V4 QA', area: 'PORTUGUESE' },
  { code: 'HISTORY_INTERPRET_EVIDENCE', subjectCode: 'QA-V4-HIST', subjectName: 'História V4 QA', area: 'HISTORY' },
  { code: 'PHYSICS_AVERAGE_SPEED', subjectCode: 'QA-V4-PHYS', subjectName: 'Física V4 QA', area: 'PHYSICS' },
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function isDryRun() {
  return process.argv.includes('--dry-run');
}

function failIfUnsafeInstitution(institution) {
  if (!institution || !/^Escola QA(?: |$)/u.test(institution.name)) {
    throw new Error('SYNTHETIC_QA_INSTITUTION_REQUIRED');
  }
}

async function one(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}_LOOKUP_FAILED`);
  return data;
}

async function existingOrInsert({ client, table, lookup, values, onConflict, label, dryRun }) {
  const existing = await one(client.from(table).select('*').match(lookup).maybeSingle(), label);
  if (existing) return { row: existing, created: false };
  if (dryRun) return { row: { ...lookup, ...values }, created: true, planned: true };

  const query = client.from(table).insert({ ...lookup, ...values }).select('*').single();
  const { data, error } = await query;
  if (error || !data) throw new Error(`${label}_CREATE_FAILED`);
  return { row: data, created: true };
}

async function upsert(client, table, values, onConflict, label, dryRun) {
  const existing = await one(
    client.from(table).select('*').match(
      onConflict.split(',').reduce((result, key) => ({ ...result, [key.trim()]: values[key.trim()] }), {}),
    ).maybeSingle(),
    label,
  );
  if (existing) return { row: existing, created: false };
  if (dryRun) return { row: values, created: true, planned: true };

  const { data, error } = await client.from(table).upsert(values, { onConflict }).select('*').single();
  if (error || !data) throw new Error(`${label}_UPSERT_FAILED`);
  return { row: data, created: true };
}

async function resolveFixture(client, institutionName) {
  const institution = await one(
    client.from('institutions').select('id, name, active, account_id').eq('name', institutionName).maybeSingle(),
    'INSTITUTION',
  );
  failIfUnsafeInstitution(institution);
  if (!institution.active) throw new Error('QA_INSTITUTION_INACTIVE');

  const [years, classes, memberships, students] = await Promise.all([
    one(client.from('academic_years').select('id, name, start_date, end_date, active').eq('institution_id', institution.id).eq('name', '2026').eq('active', true).maybeSingle(), 'ACADEMIC_YEAR'),
    one(client.from('classes').select('id, name, academic_year_id, active').eq('institution_id', institution.id).eq('name', 'Turma QA 1A').eq('active', true).maybeSingle(), 'CLASS'),
    one(client.from('memberships').select('profile_id, role, active').eq('institution_id', institution.id).eq('active', true), 'MEMBERSHIPS'),
    one(client.from('students').select('id, profile_id, active').eq('institution_id', institution.id).eq('active', true), 'STUDENTS'),
  ]);
  if (!years || !classes || !memberships.length || !students.length) throw new Error('QA_ACADEMIC_SHELL_INCOMPLETE');
  if (classes.academic_year_id !== years.id) throw new Error('QA_CLASS_YEAR_MISMATCH');

  const teacher = memberships.find((item) => item.role === 'TEACHER');
  const student = students[0];
  if (!teacher || !student) throw new Error('QA_TEACHER_OR_STUDENT_MISSING');
  return { institution, year: years, classRecord: classes, teacherProfileId: teacher.profile_id, student };
}

async function ensureTargetSkills(client) {
  const codes = TARGETS.map((target) => target.code);
  const skills = await one(
    client.from('learning_curriculum_skills')
      .select('id, code, title, subject_area, content_readiness, mastery_targetable, active')
      .in('code', codes),
    'CANONICAL_SKILLS',
  );
  const byCode = new Map(skills.map((skill) => [skill.code, skill]));
  for (const target of TARGETS) {
    const skill = byCode.get(target.code);
    if (!skill || !skill.active || skill.content_readiness !== 'ADAPTIVE_READY' || !skill.mastery_targetable) {
      throw new Error(`CANONICAL_TARGET_NOT_READY_${target.code}`);
    }
    if (skill.subject_area !== target.area) throw new Error(`CANONICAL_SUBJECT_MISMATCH_${target.code}`);
  }
  return byCode;
}

async function prepare({ client, institutionName, dryRun }) {
  const fixture = await resolveFixture(client, institutionName);
  const canonicalByCode = await ensureTargetSkills(client);
  const counts = { subjectsCreated: 0, curriculumItemsCreated: 0, offeringsCreated: 0, subjectLinksCreated: 0, unitsCreated: 0, skillsCreated: 0, canonicalLinksCreated: 0 };
  const subjectByCode = new Map();

  for (const target of TARGETS) {
    if (subjectByCode.has(target.subjectCode)) continue;
    const subject = await existingOrInsert({
      client,
      table: 'subjects',
      lookup: { institution_id: fixture.institution.id, code: target.subjectCode },
      values: { name: target.subjectName, workload: 40, active: true },
      label: `SUBJECT_${target.subjectCode}`,
      dryRun,
    });
    if (subject.row.institution_id && subject.row.institution_id !== fixture.institution.id) throw new Error('QA_SUBJECT_SCOPE_MISMATCH');
    subjectByCode.set(target.subjectCode, subject.row);
    if (subject.created) counts.subjectsCreated += 1;
  }

  const activeTerm = await one(
    client.from('terms').select('id, name, start_date, end_date').eq('academic_year_id', fixture.year.id).eq('active', true).order('start_date', { ascending: false }).limit(1).maybeSingle(),
    'ACTIVE_TERM',
  );
  if (!activeTerm) throw new Error('QA_ACTIVE_TERM_MISSING');

  const createdSkillCodes = new Set();
  for (const target of TARGETS) {
    const subject = subjectByCode.get(target.subjectCode);
    const canonical = canonicalByCode.get(target.code);
    const subjectLink = await upsert(client, 'learning_curriculum_subject_links', {
      institution_id: fixture.institution.id,
      subject_id: subject.id,
      subject_area: target.area,
      active: true,
    }, 'institution_id,subject_id', `SUBJECT_LINK_${target.code}`, dryRun);
    if (subjectLink.created) counts.subjectLinksCreated += 1;

    const curriculum = await upsert(client, 'class_curriculum_items', {
      institution_id: fixture.institution.id,
      class_id: fixture.classRecord.id,
      subject_id: subject.id,
      weekly_lessons: 1,
      lesson_duration_minutes: 50,
      needs_review: false,
      active: true,
    }, 'class_id,subject_id', `CURRICULUM_${target.code}`, dryRun);
    if (curriculum.created) counts.curriculumItemsCreated += 1;

    const teacherSubject = await existingOrInsert({
      client,
      table: 'teacher_subjects',
      lookup: {
        institution_id: fixture.institution.id,
        teacher_profile_id: fixture.teacherProfileId,
        subject_id: subject.id,
        active: true,
      },
      values: { primary_subject: true },
      label: `TEACHER_SUBJECT_${target.code}`,
      dryRun,
    });
    void teacherSubject;

    const offering = await existingOrInsert({
      client,
      table: 'subject_offerings',
      lookup: {
        class_id: fixture.classRecord.id,
        subject_id: subject.id,
        teacher_profile_id: fixture.teacherProfileId,
        term_id: activeTerm.id,
        active: true,
      },
      values: {},
      label: `OFFERING_${target.code}`,
      dryRun,
    });
    if (offering.created) counts.offeringsCreated += 1;

    const unit = await existingOrInsert({
      client,
      table: 'learning_units',
      lookup: { institution_id: fixture.institution.id, subject_id: subject.id, title: `V4 QA · ${target.code}` },
      values: { description: `Vínculo sintético QA para ${canonical.title}.`, sort_order: 0, active: true },
      label: `UNIT_${target.code}`,
      dryRun,
    });
    if (unit.created) counts.unitsCreated += 1;

    const skill = await existingOrInsert({
      client,
      table: 'learning_skills',
      lookup: { institution_id: fixture.institution.id, unit_id: unit.row.id, title: canonical.title },
      values: { description: `Habilidade institucional vinculada ao alvo canônico ${target.code}.`, sort_order: 0, active: true },
      label: `SKILL_${target.code}`,
      dryRun,
    });
    if (skill.created) counts.skillsCreated += 1;
    if (!createdSkillCodes.has(target.code)) {
      const canonicalLink = await upsert(client, 'learning_skill_canonical_links', {
        institution_id: fixture.institution.id,
        learning_skill_id: skill.row.id,
        canonical_skill_id: canonical.id,
        active: true,
      }, 'institution_id,learning_skill_id', `CANONICAL_LINK_${target.code}`, dryRun);
      if (canonicalLink.created) counts.canonicalLinksCreated += 1;
      createdSkillCodes.add(target.code);
    }
  }

  const [unitRows, skillRows, linkRows, subjectLinkRows] = await Promise.all([
    one(client.from('learning_units').select('id').eq('institution_id', fixture.institution.id), 'UNITS_VERIFY'),
    one(client.from('learning_skills').select('id').eq('institution_id', fixture.institution.id), 'SKILLS_VERIFY'),
    one(client.from('learning_skill_canonical_links').select('id, learning_skill_id, canonical_skill_id').eq('institution_id', fixture.institution.id), 'LINKS_VERIFY'),
    one(client.from('learning_curriculum_subject_links').select('id, subject_id').eq('institution_id', fixture.institution.id), 'SUBJECT_LINKS_VERIFY'),
  ]);

  return {
    result: 'PASS',
    dryRun,
    institution: fixture.institution.name,
    targets: TARGETS.map(({ code }) => code),
    counts,
    verification: {
      unitCount: unitRows.length,
      skillCount: skillRows.length,
      canonicalLinkCount: linkRows.length,
      subjectLinkCount: subjectLinkRows.length,
      duplicateCanonicalLinks: linkRows.length - new Set(linkRows.map((row) => row.learning_skill_id)).size,
    },
    contentCreated: 0,
    masteryCreated: 0,
    attemptsCreated: 0,
  };
}

const client = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const result = await prepare({
    client,
    institutionName: process.env.TECESCOLA_QA_INSTITUTION ?? DEFAULT_INSTITUTION,
    dryRun: isDryRun(),
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', code: error instanceof Error ? error.message : 'UNKNOWN' }));
  process.exitCode = 1;
}
