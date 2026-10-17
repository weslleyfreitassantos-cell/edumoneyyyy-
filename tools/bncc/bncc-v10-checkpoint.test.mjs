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
      'EF07CO01', 'EF07CO02', 'EF07CO03', 'EF07CO04', 'EF07CO05', 'EF07CO06',
      'EF07CO07', 'EF07CO08', 'EF07CO09', 'EF07CO10', 'EF07CO11',
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
