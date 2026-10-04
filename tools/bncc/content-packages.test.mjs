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

  it('keeps a lesson paired with each newly reconciled graph skill', () => {
    const output = buildContentPackages(packRoot);
    const newlyReconciled = [
      'HISTORY_COMPARE_PERSPECTIVES',
      'HISTORY_DISTINGUISH_MEMORY_HISTORY',
      'HISTORY_ANALYZE_CHANGE_CONTINUITY',
      'PHYSICS_RELATIVE_SPEED',
      'PHYSICS_UNIFORM_MOTION',
      'PHYSICS_INTERPRET_ACCELERATION',
      'PORTUGUESE_DISTINGUISH_FACT_OPINION',
      'PORTUGUESE_IDENTIFY_GENRE_PURPOSE',
      'PORTUGUESE_COMPARE_SOURCES',
      'PORTUGUESE_IDENTIFY_COUNTERARGUMENT',
      'PORTUGUESE_SUMMARIZE_ARGUMENT',
    ];
    const skills = output.packages.flatMap((item) => item.skills);
    for (const code of newlyReconciled) {
      const skill = skills.find((item) => item.code === code);
      expect(skill?.lessonCount).toBe(1);
      expect(skill?.questionCount).toBeGreaterThan(0);
      expect(skill?.readiness).toBe('GRAPH_ONLY');
      expect(skill?.contentStatus).toBe('SCAFFOLD');
    }
  });

  it('publishes the safe history promotion only after complete canary coverage', () => {
    const output = buildContentPackages(packRoot);
    const skill = output.packages.flatMap((item) => item.skills)
      .find((item) => item.code === 'HISTORY_INTERPRET_PERIODIZATION');
    expect(skill).toMatchObject({
      readiness: 'ADAPTIVE_READY',
      contentStatus: 'TECH_VALIDATED',
      lessonCount: 1,
      questionCount: 8,
    });
    expect(skill.questionPurposes).toEqual(['LOCK_IN', 'PRACTICE', 'PROBE', 'REVIEW', 'TRANSFER']);
  });

  it('publishes the authored mathematics expansion without claiming BNCC alignment', () => {
    const output = buildContentPackages(packRoot);
    const skills = output.packages.flatMap((item) => item.skills);
    for (const code of [
      'MATH_PERCENT_INCREASE',
      'MATH_INTERPRET_DATA_TABLE',
      'MATH_SUCCESSIVE_PERCENT_CHANGE',
    ]) {
      const skill = skills.find((item) => item.code === code);
      expect(skill).toMatchObject({
        readiness: 'ADAPTIVE_READY',
        contentStatus: 'TECH_VALIDATED',
        lessonCount: 1,
      });
      expect(skill.questionCount).toBeGreaterThan(0);
      expect(skill.bnccAlignment).toBe('NOT_CLAIMED');
    }
  });

  it('publishes the mathematics base prerequisite only after complete canary coverage', () => {
    const output = buildContentPackages(packRoot);
    const skill = output.packages.flatMap((item) => item.skills)
      .find((item) => item.code === 'MATH_IDENTIFY_PERCENT_BASE');
    expect(skill).toMatchObject({
      readiness: 'ADAPTIVE_READY',
      contentStatus: 'TECH_VALIDATED',
      lessonCount: 1,
      questionCount: 8,
    });
    expect(skill.questionPurposes).toEqual(['LOCK_IN', 'PRACTICE', 'PROBE', 'REVIEW', 'TRANSFER']);
  });
});
