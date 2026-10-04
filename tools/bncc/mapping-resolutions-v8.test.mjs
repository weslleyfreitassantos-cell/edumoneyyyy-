import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coverage = JSON.parse(readFileSync('content/bncc/mappings/coverage-2018.json', 'utf8'));
const resolutions = JSON.parse(readFileSync('content/bncc/mappings/resolutions-v8.json', 'utf8'));

describe('BNCC V8 mapping resolution gate', () => {
  it('closes every temporary mapping-pending row with an explicit terminal disposition', () => {
    const pending = coverage.mappings.filter((mapping) => mapping.status === 'MAPPING_PENDING');
    expect(pending).toHaveLength(0);
    expect(resolutions.summary.mappingPendingBefore).toBe(121);
    expect(resolutions.summary.resolved).toBe(121);
    expect(resolutions.summary.humanReviewBlocked).toBe(121);
  });

  it('does not assert a relation without pedagogical review', () => {
    expect(resolutions.summary.relationDecisionsAsserted).toBe(0);
    expect(resolutions.decisions.every((decision) => decision.resolutionStatus === 'HUMAN_REVIEW_BLOCKED')).toBe(true);
    expect(resolutions.decisions.every((decision) => decision.relationCandidates.every((relation) => relation.relationType === null))).toBe(true);
  });
});
