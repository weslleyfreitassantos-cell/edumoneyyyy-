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

  it('does not modify production artifacts or require a remote connection', () => {
    const source = fs.readFileSync(path.resolve('content/bncc/authoring/completion-queue-v14.json'), 'utf8');
    expect(source).toContain('"productionWrites": "NONE"');
    expect(source).not.toContain('PUBLICATION_AUTHORIZED');
  });
});
