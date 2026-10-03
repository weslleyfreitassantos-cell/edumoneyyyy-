import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContentPackages } from './build-content-packages.mjs';

const root = process.cwd();
const packRoot = path.resolve(root, 'content/adaptive/tec-escola-core-v4');

describe('BNCC content package factory', () => {
  it('keeps derived V4 content separate from BNCC alignment', () => {
    const output = buildContentPackages(packRoot);
    expect(output.bnccAlignment).toBe('NOT_CLAIMED');
    expect(output.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(output.summary.totalPackages).toBe(15);
    expect(output.summary.defaultAutomaticEligible).toBeGreaterThan(0);
  });

  it('never publishes a scaffold skill as technically validated', () => {
    const output = buildContentPackages(packRoot);
    for (const item of output.packages) {
      for (const skill of item.skills) {
        if (skill.contentStatus === 'TECH_VALIDATED') {
          expect(skill.readiness).toBe('ADAPTIVE_READY');
          expect(skill.lessonCount).toBeGreaterThanOrEqual(1);
          expect(skill.questionCount).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('matches the checked-in package source shape', () => {
    const outputPath = path.resolve(root, 'content/bncc/packages/tec-escola-core-v4.json');
    if (!fs.existsSync(outputPath)) return;
    const checkedIn = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(checkedIn.contentHash).toBe(buildContentPackages(packRoot).contentHash);
  });
});
