import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const progress = JSON.parse(fs.readFileSync(path.resolve(root, 'content/bncc/progress.json'), 'utf8'));
const contentPackage = JSON.parse(fs.readFileSync(path.resolve(root, 'content/bncc/packages/tec-escola-core-v4.json'), 'utf8'));

describe('BNCC progress telemetry', () => {
  it('matches derived content package metrics', () => {
    const factory = progress.pedagogicalContent.contentFactory;
    expect(factory.techValidatedSkills).toBe(contentPackage.summary.techValidatedSkills);
    expect(factory.scaffoldSkills).toBe(contentPackage.summary.scaffoldSkills);
    expect(factory.totalLessons).toBe(contentPackage.summary.totalLessons);
    expect(factory.totalQuestions).toBe(contentPackage.summary.totalQuestions);
  });
});
