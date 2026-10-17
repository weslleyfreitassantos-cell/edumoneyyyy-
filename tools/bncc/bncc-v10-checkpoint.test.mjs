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
      'EF05LP01', 'EF05LP02', 'EF05LP03', 'EF05LP04', 'EF05LP05', 'EF05LP06',
      'EF05LP07', 'EF05LP08', 'EF05LP09', 'EF05LP10', 'EF05LP11', 'EF05LP12',
      'EF05LP13', 'EF05LP14', 'EF05LP15', 'EF05LP16', 'EF05LP17', 'EF05LP18',
      'EF05LP19', 'EF05LP20', 'EF05LP21', 'EF05LP22', 'EF05LP23', 'EF05LP24',
      'EF05LP25', 'EF05LP26', 'EF05LP27', 'EF05LP28',
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
