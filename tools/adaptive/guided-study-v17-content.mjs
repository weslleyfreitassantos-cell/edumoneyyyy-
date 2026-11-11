import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const sourcePath = resolve(root, 'content/adaptive/tec-escola-core-v17/guided-study-em1-subject-strands-v1.json');
export const migrationPath = resolve(root, 'supabase/migrations/20261111000300_guided_study_v17_em1_subject_strands.sql');
const v16MigrationPath = resolve(root, 'supabase/migrations/20261111000200_guided_study_v16_2_math_physics_content.sql');
const purposes = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const expectedSkills = new Map([
  ['EM13CNT104', { componentCode: 'CNT', area: 'CIENCIAS_DA_NATUREZA', page: 541, subjectCode: 'QUI',
    description: 'Avaliar os benefícios e os riscos à saúde e ao ambiente, considerando a composição, a toxicidade e a reatividade de diferentes materiais e produtos, como também o nível de exposição a eles, posicionando-se criticamente e propondo soluções individuais e/ou coletivas para seus usos e descartes responsáveis.' }],
  ['EM13CNT105', { componentCode: 'CNT', area: 'CIENCIAS_DA_NATUREZA', page: 541, subjectCode: 'BIO',
    description: 'Analisar os ciclos biogeoquímicos e interpretar os efeitos de fenômenos naturais e da interferência humana sobre esses ciclos, para promover ações individuais e/ou coletivas que minimizem consequências nocivas à vida.' }],
  ['EM13LGG403', { componentCode: 'LGG', area: 'LINGUAGENS', page: 486, subjectCode: 'ING',
    description: 'Fazer uso do inglês como língua do mundo global, levando em conta a multiplicidade e variedade de usos, usuários e funções dessa língua no mundo contemporâneo.' }],
  ['EM13LP05', { componentCode: 'LP', area: 'LINGUAGENS', page: 497, subjectCode: 'LP',
    description: 'Analisar, em textos argumentativos, os posicionamentos assumidos, os movimentos argumentativos e os argumentos utilizados para sustentá-los, para avaliar sua força e eficácia, e posicionar-se diante da questão discutida e/ou dos argumentos utilizados, recorrendo aos mecanismos linguísticos necessários.' }],
  ['EM13CHS101', { componentCode: 'CHS', area: 'CIENCIAS_HUMANAS', page: 559, subjectCode: 'HIS',
    description: 'Identificar, analisar e comparar diferentes fontes e narrativas expressas em diversas linguagens, com vistas à compreensão de ideias filosóficas e de processos e eventos históricos, geográficos, políticos, econômicos, sociais, ambientais e culturais.' }],
  ['EM13CHS106', { componentCode: 'CHS', area: 'CIENCIAS_HUMANAS', page: 560, subjectCode: 'GEO',
    description: 'Utilizar as linguagens cartográfica, gráfica e iconográfica, diferentes gêneros textuais e tecnologias digitais de informação e comunicação de forma crítica, significativa, reflexiva e ética nas diversas práticas sociais, incluindo as escolares, para se comunicar, acessar e difundir informações, produzir conhecimentos, resolver problemas e exercer protagonismo e autoria na vida pessoal e coletiva.' }],
  ['EM13CHS501', { componentCode: 'CHS', area: 'CIENCIAS_HUMANAS', page: 564, subjectCode: 'FIL',
    description: 'Compreender e analisar os fundamentos da ética em diferentes culturas, identificando processos que contribuem para a formação de sujeitos éticos que valorizem a liberdade, a autonomia e o poder de decisão (vontade).' }],
  ['EM13CHS403', { componentCode: 'CHS', area: 'CIENCIAS_HUMANAS', page: 563, subjectCode: 'SOC',
    description: 'Caracterizar e analisar processos próprios da contemporaneidade, com ênfase nas transformações tecnológicas e das relações sociais e de trabalho, para propor ações que visem à superação de situações de opressão e violação dos Direitos Humanos.' }],
  ['EM13LGG603', { componentCode: 'LGG', area: 'LINGUAGENS', page: 488, subjectCode: 'ART',
    description: 'Expressar-se e atuar em processos criativos que integrem diferentes linguagens artísticas e referências estéticas e culturais, recorrendo a conhecimentos de naturezas diversas (artísticos, históricos, sociais e políticos) e experiências individuais e coletivas.' }],
  ['EM13LGG501', { componentCode: 'LGG', area: 'LINGUAGENS', page: 487, subjectCode: 'EDF',
    description: 'Selecionar e utilizar movimentos corporais de forma consciente e intencional para interagir socialmente em práticas da cultura corporal, de modo a estabelecer relações construtivas, éticas e de respeito às diferenças.' }],
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function validateSource(source) {
  const errors = [];
  if (source.packVersion !== 'TECESCOLA_BNCC_GUIDED_STUDY_EM1_V17' || source.contentVersion !== 8) {
    errors.push('unexpected V17 pack or content version');
  }
  if (source.recommendedGrade !== 1 || source.recommendedGradeSource !== 'TECESCOLA_PEDAGOGICAL_SEQUENCE') {
    errors.push('grade placement must be explicitly institutional for EM1');
  }
  if (!source.officialSourceUrl?.startsWith('https://basenacionalcomum.mec.gov.br/')) errors.push('official BNCC source is missing');
  if (source.skills.length !== expectedSkills.size || new Set(source.skills.map(({ code }) => code)).size !== expectedSkills.size) {
    errors.push('expected ten explicit subject-specific V17 strands');
  }

  const ids = new Set();
  const stems = new Set();
  for (const skill of source.skills) {
    const expected = expectedSkills.get(skill.code);
    if (!expected || skill.componentCode !== expected.componentCode || skill.area !== expected.area ||
        skill.officialPage !== expected.page || skill.officialDescription !== expected.description || skill.sequenceAfter !== null) {
      errors.push(`${skill.code}: official descriptor, component, page, or initial-sequence allocation mismatch`);
    }
    if (!skill.lesson?.title?.trim() || skill.lesson?.content?.trim().length < 900 ||
        skill.lesson?.summary?.trim().length < 40 || skill.lesson?.workedExample?.trim().length < 80 ||
        skill.lesson?.tips?.length < 3 || skill.lesson?.estimatedMinutes < 8) {
      errors.push(`${skill.code}: lesson, example, or guidance is incomplete`);
    }

    const purposeCounts = Object.fromEntries(purposes.map((purpose) => [purpose, 0]));
    const contexts = new Set();
    const processes = new Set();
    const difficultyCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const question of skill.questions ?? []) {
      if (!question.id || ids.has(question.id)) errors.push(`${skill.code}: question id is missing or duplicated`);
      ids.add(question.id);
      if (!(question.purpose in purposeCounts)) errors.push(`${skill.code}/${question.id}: invalid question purpose`);
      else purposeCounts[question.purpose] += 1;
      if (!(question.difficulty in difficultyCounts)) errors.push(`${skill.code}/${question.id}: invalid difficulty`);
      else difficultyCounts[question.difficulty] += 1;
      if (!question.cognitiveProcess || !question.contextFamily) errors.push(`${skill.code}/${question.id}: context or cognitive demand is missing`);
      contexts.add(question.contextFamily);
      processes.add(question.cognitiveProcess);
      const stem = question.statement?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      if (!stem || stem.length < 24 || stems.has(stem)) errors.push(`${skill.code}/${question.id}: missing or duplicate question stem`);
      stems.add(stem);
      if (!Array.isArray(question.options) || question.options.length !== 4 || new Set(question.options).size !== 4 ||
          question.options.filter((option) => option === question.answer).length !== 1 || question.explanation?.trim().length < 45) {
        errors.push(`${skill.code}/${question.id}: require four distinct options, one answer, and a substantive explanation`);
      }
      if (/\b(?:demo(?:nstrativ[oa]s?)?|placeholder|lorem ipsum|teste interno)\b/i.test(`${question.statement} ${question.explanation}`)) {
        errors.push(`${skill.code}/${question.id}: demonstration or placeholder content`);
      }
    }
    if (skill.questions?.length !== 10) errors.push(`${skill.code}: expected ten authored questions`);
    if (purposes.some((purpose) => purposeCounts[purpose] !== 2)) errors.push(`${skill.code}: expected two questions for each adaptive purpose`);
    if (contexts.size < 8 || processes.size < 5 || Object.values(difficultyCounts).some((count) => count === 0)) {
      errors.push(`${skill.code}: contextual, cognitive, or difficulty diversity is insufficient`);
    }
  }

  const audit = source.authoringAudit;
  if (audit?.sourcePack !== 'TECESCOLA_BNCC_GUIDED_STUDY_V13' || audit?.reviewType !== 'TECHNICAL_CONTENT_EXTENSION' ||
      audit?.humanCertification !== 'NOT_CLAIMED' || audit?.sourceRecordsMutated !== false || audit?.reviewCriteria?.length < 4) {
    errors.push('authoring audit must preserve prior records and not claim human certification');
  }
  return errors;
}

function explicitSubjectBindings() {
  return `      ('ART', 'EM13LGG603'),
      ('BIO', 'EM13CNT105'),
      ('EDF', 'EM13LGG501'),
      ('EDF-HOM', 'EM13LGG501'),
      ('FIS', 'EM13CNT101'),
      ('FIS', 'EM13CNT204'),
      ('FIL', 'EM13CHS501'),
      ('GEO', 'EM13CHS106'),
      ('GEO-HOM', 'EM13CHS106'),
      ('HIS', 'EM13CHS101'),
      ('HIS-HOM', 'EM13CHS101'),
      ('ING', 'EM13LGG403'),
      ('ING-HOM', 'EM13LGG403'),
      ('LP', 'EM13LP05'),
      ('LP-HOM', 'EM13LP05'),
      ('MAT', 'EM13MAT101'),
      ('MAT', 'EM13MAT302'),
      ('PORT', 'EM13LP05'),
      ('QUI', 'EM13CNT104'),
      ('SOC', 'EM13CHS403')`;
}

function subjectAreaCompatibilityView() {
  return `create or replace view private.learning_curriculum_subject_links_v13
with (security_barrier = true)
as
  select link.institution_id, link.subject_id, link.subject_area, link.active
    from public.learning_curriculum_subject_links link
  union
  select subject.institution_id, subject.id, mapping.subject_area, subject.active
    from public.subjects subject
    join (values
      ('MAT', 'MATEMATICA'), ('MAT-HOM', 'MATEMATICA'),
      ('LP', 'LINGUAGENS'), ('LP-HOM', 'LINGUAGENS'), ('PORT', 'LINGUAGENS'),
      ('ING', 'LINGUAGENS'), ('ING-HOM', 'LINGUAGENS'),
      ('ART', 'LINGUAGENS'), ('EDF', 'LINGUAGENS'), ('EDF-HOM', 'LINGUAGENS'),
      ('BIO', 'CIENCIAS_DA_NATUREZA'), ('QUI', 'CIENCIAS_DA_NATUREZA'), ('FIS', 'CIENCIAS_DA_NATUREZA'),
      ('HIS', 'CIENCIAS_HUMANAS'), ('HIS-HOM', 'CIENCIAS_HUMANAS'),
      ('GEO', 'CIENCIAS_HUMANAS'), ('GEO-HOM', 'CIENCIAS_HUMANAS'),
      ('FIL', 'CIENCIAS_HUMANAS'), ('SOC', 'CIENCIAS_HUMANAS')
    ) as mapping(subject_code, subject_area)
      on upper(btrim(coalesce(subject.code, ''))) = mapping.subject_code
   where subject.active;`;
}

function portugueseBnccValidatorCompatibility() {
  return `do $guided_study_v17_portuguese_bncc_validator$
declare
  high_school_definition text;
  mapped_definition text;
  high_school_oid oid := 'private.validate_bncc_high_school_skill_v12(uuid,text,jsonb)'::regprocedure;
  mapped_oid oid := 'private.validate_mapped_bncc_skill_v12(uuid,text,jsonb)'::regprocedure;
  high_school_owner oid;
  mapped_owner oid;
  current_owner oid;
  remains_security_definer boolean;
  high_school_old text := $$p_skill_code ~ '^EM13[A-Z]{3}[0-9]{3}$'$$;
  high_school_new text := $$p_skill_code ~ '^(EM13[A-Z]{3}[0-9]{3}|EM13LP[0-9]{2})$'$$;
  mapped_old text := $$skill_code !~ '^(EI[0-9]{2}[A-Z]{2}[0-9]{2}|EF[0-9]{2}[A-Z]{2}[0-9]{2}|EM13[A-Z]{3}[0-9]{3})$'$$;
  mapped_new text := $$skill_code !~ '^(EI[0-9]{2}[A-Z]{2}[0-9]{2}|EF[0-9]{2}[A-Z]{2}[0-9]{2}|EM13[A-Z]{3}[0-9]{3}|EM13LP[0-9]{2})$'$$;
begin
  select pg_get_functiondef(proc.oid), proc.proowner into high_school_definition, high_school_owner
    from pg_catalog.pg_proc proc where proc.oid = high_school_oid;
  select pg_get_functiondef(proc.oid), proc.proowner into mapped_definition, mapped_owner
    from pg_catalog.pg_proc proc where proc.oid = mapped_oid;

  if high_school_definition is null or mapped_definition is null then
    raise exception 'GUIDED_STUDY_V17_BNCC_VALIDATOR_MISSING';
  end if;

  if position(high_school_old in high_school_definition) > 0 then
    if (length(high_school_definition) - length(replace(high_school_definition, high_school_old, ''))) / length(high_school_old) <> 1 then
      raise exception 'GUIDED_STUDY_V17_HIGH_SCHOOL_VALIDATOR_SHAPE_CHANGED';
    end if;
    high_school_definition := replace(high_school_definition, high_school_old, high_school_new);
    execute high_school_definition;
  elsif position(high_school_new in high_school_definition) = 0 then
    raise exception 'GUIDED_STUDY_V17_HIGH_SCHOOL_VALIDATOR_SHAPE_CHANGED';
  end if;

  if position(mapped_old in mapped_definition) > 0 then
    if (length(mapped_definition) - length(replace(mapped_definition, mapped_old, ''))) / length(mapped_old) <> 1 then
      raise exception 'GUIDED_STUDY_V17_MAPPED_VALIDATOR_SHAPE_CHANGED';
    end if;
    mapped_definition := replace(mapped_definition, mapped_old, mapped_new);
    execute mapped_definition;
  elsif position(mapped_new in mapped_definition) = 0 then
    raise exception 'GUIDED_STUDY_V17_MAPPED_VALIDATOR_SHAPE_CHANGED';
  end if;

  select proc.proowner, proc.prosecdef into current_owner, remains_security_definer
    from pg_catalog.pg_proc proc where proc.oid = high_school_oid;
  if current_owner is distinct from high_school_owner or remains_security_definer is distinct from true then
    raise exception 'GUIDED_STUDY_V17_HIGH_SCHOOL_VALIDATOR_OWNER_OR_SECURITY_CHANGED';
  end if;
  select proc.proowner, proc.prosecdef into current_owner, remains_security_definer
    from pg_catalog.pg_proc proc where proc.oid = mapped_oid;
  if current_owner is distinct from mapped_owner or remains_security_definer is distinct from true then
    raise exception 'GUIDED_STUDY_V17_MAPPED_VALIDATOR_OWNER_OR_SECURITY_CHANGED';
  end if;
end;
$guided_study_v17_portuguese_bncc_validator$;`;
}

export function buildMigration(source) {
  const errors = validateSource(source);
  if (errors.length) throw new Error(errors.join('\n'));

  const canonicalHash = createHash('sha256').update(JSON.stringify(canonicalize(source)), 'utf8').digest('hex');
  const skillCodes = source.skills.map(({ code }) => code);
  const manifest = {
    packVersion: source.packVersion,
    sourceOfTruth: 'content/adaptive/tec-escola-core-v17/guided-study-em1-subject-strands-v1.json',
    provenance: 'Newly authored, discipline-specific version 8 strands for Chemistry, Biology, English, Portuguese, History, Geography, Philosophy, Sociology, Arts and Physical Education. Explicit school subject bindings prevent broad BNCC-area equivalence; existing versions and student records are preserved. Technical validation is not human pedagogical certification.',
    officialSourceUrl: source.officialSourceUrl,
    skillCodes,
    skillCount: source.skills.length,
    lessonCount: source.skills.length,
    questionCount: source.skills.reduce((total, skill) => total + skill.questions.length, 0),
    contentVersion: source.contentVersion,
    recommendedGrade: source.recommendedGrade,
    recommendedGradeSource: source.recommendedGradeSource,
    authoringAudit: source.authoringAudit,
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    valid: true,
    canonicalHash,
    genericTemplateQuestions: 0,
    genericTemplateLessons: 0,
    genericTemplateFamilies: 0,
    duplicateSemanticSkills: [],
    unknownPrerequisites: [],
    prerequisiteCycles: [],
    nearDuplicateStems: [],
    errors: [],
  };

  let migration = readFileSync(v16MigrationPath, 'utf8').replace(/\r\n/g, '\n')
    .replaceAll('tools/adaptive/guided-study-v16-2-content.mjs', 'tools/adaptive/guided-study-v17-content.mjs')
    .replaceAll('content/adaptive/tec-escola-core-v16-2/guided-study-em1-math-physics-v1.json', manifest.sourceOfTruth)
    .replaceAll('V16_2', 'V17')
    .replaceAll('V16.2', 'V17')
    .replaceAll('v16.2', 'v17');

  const transactionStart = 'begin;\n';
  if (!migration.includes(transactionStart)) throw new Error('V16 transaction template changed; refusing to generate V17 SQL');
  migration = migration.replace(transactionStart, `${transactionStart}set local role supabase_admin;\n`);

  const hashMarker = /^-- V17_CANONICAL_HASH=[a-f0-9]{64}$/m;
  if (!hashMarker.test(migration)) throw new Error('V16 SQL template hash marker not found exactly once');
  migration = migration.replace(hashMarker, `-- V17_CANONICAL_HASH=${canonicalHash}`);

  const bindingsPattern = /join \(values\n      \('MAT', 'EM13MAT101'\),\n      \('MAT', 'EM13MAT302'\),\n      \('FIS', 'EM13CNT101'\),\n      \('FIS', 'EM13CNT204'\)\n    \) as mapping\(subject_code, official_skill_code\)/;
  if (!bindingsPattern.test(migration)) throw new Error('V16 subject-binding template changed; refusing to generate V17 SQL');
  migration = migration.replace(bindingsPattern, `join (values\n${explicitSubjectBindings()}\n    ) as mapping(subject_code, official_skill_code)`);

  const seedPattern = /^  content jsonb := .*::jsonb;$/m;
  if (!seedPattern.test(migration)) throw new Error('V16 seed-source template changed; refusing to generate V17 SQL');
  migration = migration.replace(seedPattern, `  content jsonb := ${sqlLiteral(JSON.stringify(source))}::jsonb;`);

  const packInsertPattern = /insert into public\.learning_adaptive_content_packs\([\s\S]*?updated_at = now\(\);/;
  const packInsert = `insert into public.learning_adaptive_content_packs(
  pack_version, canonical_hash, manifest, pedagogical_review_status, active, publication_status
) values (
  ${sqlLiteral(source.packVersion)}, ${sqlLiteral(canonicalHash)}, ${sqlLiteral(JSON.stringify(manifest))}::jsonb,
  'PEDAGOGICAL_REVIEW_PENDING', true, 'STAGING'
)
on conflict (pack_version) do update set
  canonical_hash = excluded.canonical_hash,
  manifest = excluded.manifest,
  pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING',
  active = true,
  publication_status = 'STAGING',
  updated_at = now();`;
  if (!packInsertPattern.test(migration)) throw new Error('V16 pack-registration template changed; refusing to generate V17 SQL');
  migration = migration.replace(packInsertPattern, () => `${subjectAreaCompatibilityView()}\n\n${portugueseBnccValidatorCompatibility()}\n\n${packInsert}`);
  return migration;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const migration = buildMigration(source);
  if (process.argv.includes('--check')) {
    if (readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n') !== migration) throw new Error('V17 migration is stale; run the generator to refresh it.');
    process.stdout.write(`${source.skills.length} subject strands, ${source.skills.reduce((n, skill) => n + skill.questions.length, 0)} questions; SHA-256 ${migration.match(/V17_CANONICAL_HASH=([a-f0-9]{64})/)?.[1]}\n`);
  } else {
    writeFileSync(migrationPath, migration, 'utf8');
    process.stdout.write(`Generated ${migrationPath}\n`);
  }
}
