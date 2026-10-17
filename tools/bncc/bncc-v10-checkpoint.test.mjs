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
      'EF09MA01', 'EF09MA02', 'EF09MA03', 'EF09MA04', 'EF09MA05', 'EF09MA06', 'EF09MA07',
      'EF09MA08', 'EF09MA09', 'EF09MA10', 'EF09MA11', 'EF09MA12', 'EF09MA13', 'EF09MA14',
      'EF09MA15', 'EF09MA16', 'EF09MA17', 'EF09MA18', 'EF09MA19', 'EF09MA20', 'EF09MA21',
      'EF09MA22', 'EF09MA23',
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
