import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const checkpoint = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), 'content/bncc/authoring/bncc-v10-checkpoint.json'),
  'utf8',
));

describe('BNCC V12 checkpoint', () => {
  it('keeps the current operation auditable and production-free', () => {
    expect(checkpoint.schemaVersion).toBe('tec-escola.bncc.campaign-checkpoint.v12');
    expect(checkpoint.lastOperation.target).toEqual(['EF03HI01']);
    expect(checkpoint.lastOperation.result).toBe('STAGED_AUTHORING_CONTEXT_CREATED');
    expect(checkpoint.lastOperation.mappingStatus).toBe('CANONICAL_GAP');
    expect(checkpoint.lastOperation.relationDecision).toBe('NOT_ASSERTED');
    expect(checkpoint.inventory.exactSourceVerifications).toBe(554);
    expect(checkpoint.inventory.newStagingPackagesInThisOperation).toBe(1);
    expect(checkpoint.inventory.stagedQuestionsInThisOperation).toBe(50);
    expect(checkpoint.gates.productionWrites).toBe('NONE');
    expect(checkpoint.gates.productionDeploy).toBe('NO');
    expect(checkpoint.gates.remoteMigrations).toBe('NO');
    expect(checkpoint.gates.officialMappingClaim).toBe('NONE');
  });
});
