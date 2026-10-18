import assert from 'node:assert/strict';
import fs from 'node:fs';
import { it } from 'vitest';

import { evaluateCurriculumPackageRubric } from './curriculum-package-rubric.mjs';

const packagePath = 'content/adaptive/tec-escola-core-v5/humanities-evidence-arguments-hs-v8.json';
const sourcePath = 'content/bncc/authoring/source-verification-v2.json';
const reportPath = 'content/bncc/authoring/high-school-evidence-recovery-v1.json';
const pack = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8')).records.find((item) => item.officialCode === 'EM13CHS103');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

it('EM13CHS103 passes the technical screen while remaining inactive and awaiting human review', () => {
  const rubric = evaluateCurriculumPackageRubric(pack, {
    requirements: { mode: 'OBJECTIVE_LEARNING_PATH', questions: 40, concepts: 3, prerequisites: 1, remediations: 2, accessibilitySupports: 2 },
    officialSourceRecord: source,
  });

  assert.equal(rubric.status, 'AUTOMATED_SCREEN_PASS');
  assert.equal(rubric.contentTechnicalPreparationStatus, 'CONTENT_TECHNICALLY_PREPARED');
  assert.equal(rubric.humanPedagogicalApprovalStatus, 'HUMAN_PEDAGOGICAL_REVIEW_PENDING');
  assert.equal(pack.active, false);
  assert.equal(pack.publicationStatus, 'STAGING_INACTIVE');
  assert.equal(pack.officialMappingStatus, 'NOT_CLAIMED');
  assert.equal(source.mappingStatus, 'CANONICAL_GAP');
  assert.equal(report.publicationAuthorized, false);
});

it('EM13CHS103 retains all 40 question IDs and correct answers with balanced answer positions', () => {
  assert.equal(pack.questions.length, 40);
  assert.equal(new Set(pack.questions.map((question) => question.id)).size, 40);
  assert.equal(new Set(pack.questions.map((question) => question.statement)).size, 40);
  assert.deepEqual(report.after.answerPositionCounts, [10, 10, 10, 10]);
  assert.deepEqual(report.after.purposeCounts, { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
  assert.equal(report.questionIdsAndCorrectAnswersPreserved, true);
});
