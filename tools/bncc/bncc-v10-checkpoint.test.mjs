import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const checkpoint = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), 'content/bncc/authoring/bncc-v10-checkpoint.json'),
  'utf8',
));

describe('BNCC V10 checkpoint', () => {
  it('keeps the current operation auditable and production-free', () => {
    expect(checkpoint.lastOperation.target).toEqual([
      'EF02LP12', 'EF02LP13', 'EF02LP14', 'EF02LP15', 'EF02LP16', 'EF02LP17',
      'EF02LP18', 'EF02LP19',
    ]);
    expect(checkpoint.lastOperation.result).toBe('OFFICIAL_SOURCE_VERIFIED_EXACT');
    expect(checkpoint.lastOperation.mappingStatus).toBe('REVIEW_REQUIRED_PER_CODE');
    expect(checkpoint.lastOperation.relationDecision).toBe('NOT_ASSERTED');
    expect(checkpoint.gates.productionWrites).toBe('NONE');
    expect(checkpoint.gates.productionDeploy).toBe('NO');
    expect(checkpoint.gates.remoteMigrations).toBe('NO');
    expect(checkpoint.gates.officialMappingClaim).toBe('NONE');
  });
});
