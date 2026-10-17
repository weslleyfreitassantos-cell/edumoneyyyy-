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
      'EF02MA01', 'EF02MA02', 'EF02MA03', 'EF02MA04', 'EF02MA05', 'EF02MA06',
      'EF02MA07', 'EF02MA08', 'EF02MA09', 'EF02MA10', 'EF02MA11', 'EF02MA12',
      'EF02MA13', 'EF02MA14', 'EF02MA15', 'EF02MA16', 'EF02MA17', 'EF02MA18',
      'EF02MA19', 'EF02MA20', 'EF02MA21', 'EF02MA22', 'EF02MA23',
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
