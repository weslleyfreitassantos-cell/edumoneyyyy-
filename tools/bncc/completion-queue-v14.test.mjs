import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildCompletionQueue, queueState } from './build-completion-queue-v14.mjs';

describe('BNCC V14 completion queue', () => {
  it('classifies source and mapping blockers without treating them as publication readiness', () => {
    expect(queueState({ queueStatus: 'SOURCE_TEXT_REVIEW_REQUIRED', exactSourceVerified: false })).toBe('BLOCKED_SOURCE');
    expect(queueState({ queueStatus: 'MAPPING_REVIEW_REQUIRED', exactSourceVerified: true, mappingStatus: 'CANONICAL_GAP' })).toBe('BLOCKED_CANONICAL_REVIEW');
    expect(queueState({ queueStatus: 'MAPPING_REVIEW_REQUIRED', exactSourceVerified: true, mappingStatus: 'HUMAN_REVIEW_BLOCKED', nextAction: 'HUMAN_MAPPING_REVIEW_REQUIRED' })).toBe('BLOCKED_HUMAN_PEDAGOGICAL_REVIEW');
  });

  it('builds a deterministic global queue with staging-only gates', () => {
    const artifact = buildCompletionQueue();
    expect(artifact.summary.totalTasks).toBe(1721);
    expect(artifact.summary.publicationAuthorized).toBe(0);
    expect(artifact.tasks.every((task) => task.gates.active === false)).toBe(true);
    expect(artifact.tasks.every((task) => task.gates.studentPublicationStatus === 'STAGING_INACTIVE')).toBe(true);
    expect(artifact.tasks.every((task) => task.gates.officialMappingStatus === 'NOT_CLAIMED')).toBe(true);
    expect(artifact.tasks.map((task) => task.officialCode)).toEqual([...artifact.tasks].sort((left, right) => right.priorityScore - left.priorityScore || left.officialCode.localeCompare(right.officialCode)).map((task) => task.officialCode));
  });

  it('uses the completeness rubric without silently promoting legacy count-only candidates', () => {
    const artifact = buildCompletionQueue();
    const byCode = new Map(artifact.tasks.map((task) => [task.officialCode, task]));
    for (const code of ['EF01LP01', 'EF01LP02', 'EF01CI03', 'EF01CI06', 'EF01CO01', 'EF01CO02', 'EF01CO03', 'EF01CO04', 'EF01CO05', 'EF01CO06', 'EF01CO07', 'EF01GE01', 'EF01HI01', 'EF02CI01', 'EM13CHS103']) {
      expect(byCode.get(code)?.state).toBe('CONTENT_TECHNICALLY_COMPLETE');
      expect(byCode.get(code)?.technicalCompleteness.qualityRubric.status).toBe('AUTOMATED_SCREEN_PASS');
      expect(byCode.get(code)?.technicalCompleteness.humanPedagogicalApproved).toBe(false);
      expect(byCode.get(code)?.gates.active).toBe(false);
    }
    for (const code of ['EI01CG01', 'EI02CG01', 'EI03CG01', 'EI01CG02', 'EI01CG03', 'EI01CG04']) {
      const task = byCode.get(code);
      expect(task?.state).toBe('CONTENT_TECHNICALLY_COMPLETE');
      expect(task?.requirements.mode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
      expect(task?.requirements.questions).toBe(0);
      expect(task?.technicalCompleteness.qualityRubric.mode).toBe('EDUCATOR_MEDIATED_OBSERVATION');
      expect(task?.technicalCompleteness.qualityRubric.status).toBe('AUTOMATED_SCREEN_PASS');
      expect(task?.evidence.stagedPackages[0].questionCount).toBe(0);
      expect(task?.gates.active).toBe(false);
    }
    expect(artifact.summary.legacyCountBasedTechnicalComplete).toBe(artifact.summary.contentTechnicallyComplete);
    expect(artifact.summary.automatedScreenIncomplete).toBe(0);
    expect(artifact.tasks.every((task) => task.state !== 'CONTENT_TECHNICALLY_COMPLETE' || task.technicalCompleteness.qualityRubric.status === 'AUTOMATED_SCREEN_PASS')).toBe(true);
    expect(byCode.get('EF01CO07')?.executionClassification).toBe('COMPLETE_OR_REPAIR_STAGED_PACKAGE');
  });

  it('does not modify production artifacts or require a remote connection', () => {
    const source = fs.readFileSync(path.resolve('content/bncc/authoring/completion-queue-v14.json'), 'utf8');
    expect(source).toContain('"productionWrites": "NONE"');
    expect(source).not.toContain('PUBLICATION_AUTHORIZED');
  });
});
