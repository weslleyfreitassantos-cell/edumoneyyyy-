import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadV4Pack, validateV4Pack } from './compile-v4';

const compiler = readFileSync(new URL('./compile-v4.ts', import.meta.url), 'utf8');
const generator = readFileSync(new URL('./generate-v4-content.ts', import.meta.url), 'utf8');

function normalize(value: string): string {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

describe('adaptive V4 source-of-truth and honest content gates', () => {
  it('keeps all 15 subject packs under explicit source-of-truth files', () => {
    const subjectDirs = readdirSync(new URL('../../content/adaptive/tec-escola-core-v4/subjects/', import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(subjectDirs).toHaveLength(15);
    for (const subject of subjectDirs) {
      expect(() => readFileSync(new URL(`../../content/adaptive/tec-escola-core-v4/subjects/${subject.name}/skills.json`, import.meta.url))).not.toThrow();
      expect(() => readFileSync(new URL(`../../content/adaptive/tec-escola-core-v4/subjects/${subject.name}/lessons.json`, import.meta.url))).not.toThrow();
      expect(() => readFileSync(new URL(`../../content/adaptive/tec-escola-core-v4/subjects/${subject.name}/questions.json`, import.meta.url))).not.toThrow();
    }
    expect(generator).not.toContain('writeFileSync');
    expect(generator).not.toContain('mkdirSync');
    expect(generator).not.toContain('stageFor');
    expect(generator).not.toContain('TOPICS');
  });

  it('accepts explicit semantic content without quota gates or template factories', () => {
    const pack = loadV4Pack();
    const result = validateV4Pack(pack);
    expect(result.valid).toBe(true);
    expect(result.subjectCount).toBe(15);
    expect(result.adaptiveReadyCount).toBe(11);
    expect(result.graphOnlyCount).toBeGreaterThan(0);
    expect(result.contentReadyCount).toBe(6);
    expect(result.lessonCount).toBe(29);
    expect(result.questionCount).toBe(218);
    expect(result.reusedV2V3Questions).toBe(180);
    expect(result.newRealV4Questions).toBe(38);
    expect(result.realSelectableQuestions).toBe(104);
    expect(result.questionsRemapped).toBe(180);
    expect(result.topicOwnershipCount).toBe(195);
    expect(result.genericTemplateQuestions).toBe(0);
    expect(result.genericTemplateLessons).toBe(0);
    expect(result.genericTemplateFamilies).toBe(0);
    expect(result.duplicateSemanticSkills).toHaveLength(0);
    expect(result.numericSuffixDuplicateConcepts).toHaveLength(0);
    expect(result.realMisconceptions).toBeGreaterThan(0);
    expect(result.genericMisconceptions).toBe(0);
    expect(result.genericMisconceptionLabels).toBe(0);
    expect(result.genericMisconceptionDescriptions).toBe(0);
    expect(compiler).not.toContain('SCALE_ADAPTIVE_READY_LEAVES_BELOW_180');
    expect(compiler).not.toContain('SCALE_LESSONS_BELOW_180');
    expect(compiler).not.toContain('SCALE_QUESTIONS_BELOW_1440');
    expect(compiler).not.toContain('previousReady');
  });

  it('requires explicit outcomes, honest readiness and minimum ready-leaf coverage', () => {
    const pack = loadV4Pack();
    const seen = new Set<string>();
    for (const leaf of pack.leaves) {
      expect(leaf.objective.trim()).not.toBe('');
      expect(leaf.description.trim()).not.toBe('');
      expect(leaf.masteryCapability.trim()).not.toBe('');
      expect(leaf.content_authoring_status).toBeTruthy();
      const semantic = normalize(`${leaf.title} ${leaf.objective}`);
      expect(seen.has(semantic)).toBe(false);
      seen.add(semantic);
      if (leaf.readiness !== 'ADAPTIVE_READY') continue;
      const questions = pack.questions.filter((question) => question.primarySkill === leaf.code);
      for (const purpose of ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW']) {
        const minimum = purpose === 'PROBE' || purpose === 'PRACTICE' || purpose === 'REVIEW' ? 2 : 1;
        expect(questions.filter((question) => question.purpose === purpose).length).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it('keeps misconception explanations tied to affected skills', () => {
    const pack = loadV4Pack();
    for (const [tag, detail] of Object.entries(pack.misconceptionDetails)) {
      expect(tag).not.toBe('');
      expect(detail.title.trim()).not.toBe('');
      expect(detail.description.trim()).not.toBe('');
      expect(detail.affectedSkills.length).toBeGreaterThan(0);
      for (const skill of detail.affectedSkills) expect(pack.leaves.some((leaf) => leaf.code === skill)).toBe(true);
    }
  });
});
