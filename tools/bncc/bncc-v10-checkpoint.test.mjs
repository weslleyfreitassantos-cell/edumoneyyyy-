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
      'EF01MA01', 'EF01MA02', 'EF01MA03', 'EF01MA04', 'EF01MA05', 'EF01MA06',
      'EF01MA07', 'EF01MA08', 'EF01MA09', 'EF01MA10', 'EF01MA11', 'EF01MA12',
      'EF01MA13', 'EF01MA14', 'EF01MA15', 'EF01MA16', 'EF01MA17', 'EF01MA18',
      'EF01MA19', 'EF01MA20', 'EF01MA21', 'EF01MA22',
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
