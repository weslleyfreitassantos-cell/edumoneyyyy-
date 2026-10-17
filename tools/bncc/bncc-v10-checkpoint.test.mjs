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
      'EF01LP01', 'EF01LP02', 'EF01LP03', 'EF01LP04', 'EF01LP05', 'EF01LP06',
      'EF01LP07', 'EF01LP08', 'EF01LP09', 'EF01LP10', 'EF01LP11', 'EF01LP12',
      'EF01LP13', 'EF01LP14', 'EF01LP15', 'EF01LP16', 'EF01LP17', 'EF01LP18',
      'EF01LP19', 'EF01LP20', 'EF01LP21', 'EF01LP22', 'EF01LP23', 'EF01LP24',
      'EF01LP25', 'EF01LP26',
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
