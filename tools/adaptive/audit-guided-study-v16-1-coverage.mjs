import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REQUIRED_LESSON_FIELDS = [
  'intro',
  'explanation',
  'workedExample',
  'guidedPractice',
  'application',
  'review',
  'learningCheck',
];
const REQUIRED_PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const SUBJECTS = [
  ['ART', 'art', 'ART_INTERPRETATION'],
  ['BIO', 'biology', 'BIOLOGY_GENETICS'],
  ['QUI', 'chemistry', 'CHEMISTRY_ATOMS'],
  ['ING', 'english', 'ENGLISH_READING'],
  ['GEO', 'geography', 'GEOGRAPHY_TERRITORY'],
  ['HIS', 'history', 'HISTORY_INTERPRETATION'],
  ['MAT', 'mathematics', 'PERCENTAGE'],
  ['FIL', 'philosophy', 'PHILOSOPHY_ARGUMENT'],
  ['EDF', 'physical_education', 'PE_SPORT_PRINCIPLES'],
  ['FIS', 'physics', 'PHYSICS_AVERAGE_SPEED'],
  ['LP', 'portuguese', 'READING_ARGUMENT'],
  ['SOC', 'sociology', 'SOCIOLOGY_INSTITUTIONS'],
];

function readJson(path, root = ROOT) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function hasCompleteLesson(lesson) {
  return REQUIRED_LESSON_FIELDS.every((field) => {
    const value = lesson?.[field];
    return typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) && value.length > 0;
  });
}

export function buildGuidedStudyV16_1Coverage(root = ROOT) {
  const manifest = readJson('content/adaptive/tec-escola-core-v4/manifest.json', root);
  const v3Registry = readJson('content/adaptive/tec-escola-core-v3/registry.json', root);
  const v13 = readJson('content/adaptive/tec-escola-core-v13/guided-study-em-content-v1.json', root);
  const v16Migration = readFileSync(resolve(root, 'supabase/migrations/20261110010546_guided_study_v16_subject_scoped_planner.sql'), 'utf8');
  const v16Bindings = new Map(
    [...v16Migration.matchAll(/\('([A-Z]+)',\s*'(EM13[A-Z0-9]+)'\)/g)].map((match) => [match[1], match[2]]),
  );
  const v13Skills = new Set(v13.skills.map((skill) => skill.code));

  const subjects = SUBJECTS.map(([subjectCode, folder, canonicalTarget]) => {
    const directory = `content/adaptive/tec-escola-core-v4/subjects/${folder}`;
    const skillFile = JSON.parse(readFileSync(resolve(root, `${directory}/skills.json`), 'utf8'));
    const lessonFile = JSON.parse(readFileSync(resolve(root, `${directory}/lessons.json`), 'utf8'));
    const questionFile = JSON.parse(readFileSync(resolve(root, `${directory}/questions.json`), 'utf8'));
    const legacyTarget = v3Registry.subjects.find((subject) => subject.code === skillFile.code);
    const highSchoolSkills = skillFile.leaves.filter((skill) =>
      skill.recommendedStage === 'ENSINO_MEDIO'
      && skill.recommendedGradeFrom <= 1
      && skill.recommendedGradeTo >= 1);

    const candidates = highSchoolSkills.map((skill) => {
      const lesson = lessonFile.find((item) => item.skill === skill.code);
      const questions = questionFile.filter((item) => item.primarySkill === skill.code);
      const purposes = new Set(questions.map((item) => item.purpose));
      return {
        skillCode: skill.code,
        readiness: skill.readiness,
        authoringStatus: skill.content_authoring_status,
        lessonPresent: Boolean(lesson),
        lessonComplete: hasCompleteLesson(lesson),
        questionCount: questions.length,
        purposeCoverage: REQUIRED_PURPOSES.filter((purpose) => purposes.has(purpose)),
        purposeGaps: REQUIRED_PURPOSES.filter((purpose) => !purposes.has(purpose)),
      };
    });

    const boundCode = v16Bindings.get(subjectCode) ?? null;
    return {
      subjectCode,
      folder,
      canonicalTarget,
      legacyTarget: legacyTarget ? {
        skillCode: legacyTarget.targetSkill,
        capability: legacyTarget.capability,
        provenance: v3Registry.provenance,
      } : null,
      v4ContentInventory: {
        skills: skillFile.leaves.length,
        lessons: lessonFile.length,
        questions: questionFile.length,
        foundationalGradeSixToNineSkills: skillFile.leaves.filter((skill) =>
          skill.recommendedStage === 'FUNDAMENTAL_II').length,
      },
      v4HighSchoolGradeOneCandidates: candidates,
      exactV16OfficialBinding: boundCode && v13Skills.has(boundCode) ? boundCode : null,
      coreRuntimeEligibleCandidateCount: manifest.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_COMPLETE'
        ? candidates.filter((candidate) => candidate.readiness === 'ADAPTIVE_READY'
          && candidate.lessonComplete
          && candidate.purposeGaps.length === 0
          && candidate.questionCount > 0).length
        : 0,
    };
  });

  return {
    campaign: 'TECESCOLA_V16_1_CONTENT_RECOVERY',
    sourcePack: 'tec-escola-core-v4',
    bnccAlignment: 'NOT_CLAIMED_BY_CORE_PACK',
    humanPedagogicalReview: manifest.pedagogicalReviewStatus,
    exactV16Bindings: Object.fromEntries(v16Bindings),
    summary: {
      traditionalHighSchoolSubjects: subjects.length,
      exactV16BoundSubjects: subjects.filter((subject) => subject.exactV16OfficialBinding).length,
      v13OfficialSkillCount: v13.skills.length,
      subjectsWithGradeOneHighSchoolCoreCandidates: subjects.filter((subject) => subject.v4HighSchoolGradeOneCandidates.length > 0).length,
      coreRuntimeEligibleCandidates: subjects.reduce((count, subject) => count + subject.coreRuntimeEligibleCandidateCount, 0),
      completeLessonRequiredFields: REQUIRED_LESSON_FIELDS,
      adaptiveQuestionPurposes: REQUIRED_PURPOSES,
    },
    subjects,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = buildGuidedStudyV16_1Coverage();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const rows = report.subjects.map((subject) => {
      const candidates = subject.v4HighSchoolGradeOneCandidates;
      const inventory = subject.v4ContentInventory;
      const candidateSummary = candidates.length
        ? candidates.map((candidate) => `${candidate.skillCode} (${candidate.lessonComplete ? 'aula completa' : 'aula incompleta'}, ${candidate.questionCount} questões)`).join('; ')
        : 'sem candidato EM1 no pacote';
      return `${subject.subjectCode.padEnd(4)} ${String(inventory.lessons).padStart(2)} aulas | ${String(inventory.questions).padStart(3)} questões | ${candidateSummary}`;
    });
    process.stdout.write([
      `Revisão pedagógica: ${report.humanPedagogicalReview}`,
      `Disciplinas: ${report.summary.traditionalHighSchoolSubjects}; vínculos V16 exatos: ${report.summary.exactV16BoundSubjects}; candidatos EM1: ${report.summary.subjectsWithGradeOneHighSchoolCoreCandidates}; elegíveis no pacote CORE: ${report.summary.coreRuntimeEligibleCandidates}`,
      ...rows,
      'Use --json para o inventário completo.',
    ].join('\n') + '\n');
  }
}
