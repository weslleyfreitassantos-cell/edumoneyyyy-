import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packUrl = new URL('../../content/adaptive/tec-escola-core-v4/', import.meta.url);
const coverage = JSON.parse(readFileSync(new URL('coverage.json', packUrl), 'utf8')) as {
  subjects: Array<{ code: string; skills: number; adaptiveReady: number; lessons: number; questions: number }>;
};
const compiler = readFileSync(new URL('./compile-v4.ts', import.meta.url), 'utf8');

describe('adaptive V4 source-of-truth and scale gates', () => {
  it('keeps all subject packs under skills, lessons and questions files', () => {
    const subjectDirs = readdirSync(new URL('../../content/adaptive/tec-escola-core-v4/subjects/', import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(subjectDirs).toHaveLength(15);
    for (const subject of subjectDirs) {
      expect(() => readFileSync(new URL(`../../content/adaptive/tec-escola-core-v4/subjects/${subject.name}/skills.json`, import.meta.url))).not.toThrow();
      expect(() => readFileSync(new URL(`../../content/adaptive/tec-escola-core-v4/subjects/${subject.name}/lessons.json`, import.meta.url))).not.toThrow();
      expect(() => readFileSync(new URL(`../../content/adaptive/tec-escola-core-v4/subjects/${subject.name}/questions.json`, import.meta.url))).not.toThrow();
    }
    expect(compiler).not.toContain("join(PACK, 'questions.json')");
  });

  it('meets the V4 scale and distributes ready content across every subject', () => {
    const totalSkills = coverage.subjects.reduce((sum, subject) => sum + subject.skills, 0);
    const totalReady = coverage.subjects.reduce((sum, subject) => sum + subject.adaptiveReady, 0);
    const totalLessons = coverage.subjects.reduce((sum, subject) => sum + subject.lessons, 0);
    const totalQuestions = coverage.subjects.reduce((sum, subject) => sum + subject.questions, 0);
    expect(totalSkills).toBeGreaterThanOrEqual(400);
    expect(totalReady).toBeGreaterThanOrEqual(180);
    expect(totalLessons).toBeGreaterThanOrEqual(180);
    expect(totalQuestions).toBeGreaterThanOrEqual(1440);
    expect(coverage.subjects.every((subject) => subject.adaptiveReady > 0)).toBe(true);
  });
});
