import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sourcePath = resolve(root, 'content/adaptive/tec-escola-core-v13/guided-study-em-content-v1.json');
const migrationPath = resolve(root, 'supabase/migrations/20261109000100_guided_study_bncc_content_recovery_v13.sql');
const compilerPath = resolve(root, 'tools/adaptive/guided-study-v13-content.mjs');

describe('Guided Study V13 authored content package', () => {
  it('reproducibly compiles the authored content and canonical migration hash', () => {
    expect(execFileSync(process.execPath, [compilerPath, '--check'], { cwd: root, encoding: 'utf8' }))
      .toMatch(/4 skills, 24 questions; SHA-256 [a-f0-9]{64}/);
  });

  it('covers each BNCC descriptor with a complete, keyed adaptive journey', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
      contentVersion: number;
      recommendedGradeSource: string;
      conversionAudit: { humanCertification: string; sourceRecordsMutated: boolean; questions: Array<{ sourceQuestionId: string | null }> };
      skills: Array<{ code: string; area: string; officialPage: number; questions: Array<{ purpose: string; options: string[]; answer: string; explanation: string }> }>;
    };
    expect(source.contentVersion).toBe(6);
    expect(source.recommendedGradeSource).toBe('TECESCOLA_PEDAGOGICAL_SEQUENCE');
    expect(source.conversionAudit.humanCertification).toBe('NOT_CLAIMED');
    expect(source.conversionAudit.sourceRecordsMutated).toBe(false);
    expect(source.conversionAudit.questions).toHaveLength(24);
    expect(source.conversionAudit.questions.filter(({ sourceQuestionId }) => sourceQuestionId !== null)).toHaveLength(20);
    expect(source.conversionAudit.questions.filter(({ sourceQuestionId }) => sourceQuestionId === null)).toHaveLength(4);
    expect(source.skills.map(({ code, area, officialPage }) => [code, area, officialPage])).toEqual([
      ['EM13MAT101', 'MATEMATICA', 525],
      ['EM13LGG303', 'LINGUAGENS', 485],
      ['EM13CNT101', 'CIENCIAS_DA_NATUREZA', 540],
      ['EM13CHS103', 'CIENCIAS_HUMANAS', 560],
    ]);
    for (const skill of source.skills) {
      expect(skill.questions.map(({ purpose }) => purpose).sort()).toEqual([
        'LOCK_IN', 'PRACTICE', 'PRACTICE', 'PROBE', 'REVIEW', 'TRANSFER',
      ]);
      for (const question of skill.questions) {
        expect(question.options).toContain(question.answer);
        expect(question.explanation.trim().length).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('keeps legacy content immutable and the curriculum bridge private', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('private.learning_curriculum_subject_links_v13');
    expect(migration).toContain('GUIDED_STUDY_V11_SOURCE_SHAPE_CHANGED');
    expect(migration).toContain('GUIDED_STUDY_V8_START_SOURCE_SHAPE_CHANGED');
    expect(migration).toContain('GUIDED_STUDY_V8_SUBMIT_SOURCE_SHAPE_CHANGED');
    expect(migration).toContain("target_skill.metadata->>''content_version''");
    expect(migration).toContain("session_row.metadata->>''content_version''");
    expect(migration).toContain("'source_question_id'");
    expect(migration).toContain("'conversion_action'");
    expect(migration).toContain("'V13_NEW_SUPPLEMENT'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'content_origin', 'V13_REAUTHORED_FROM_V4_V8'");
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.learning_(?:skill_lessons|question_sets|question_set_items|question_bank)\b/i);
  });
});
