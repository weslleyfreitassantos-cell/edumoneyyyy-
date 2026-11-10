import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMigration, migrationPath, sourcePath, validateSource } from './guided-study-v16-2-content.mjs';

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

describe('guided study V16.2 authored EM1 content', () => {
  it('matches the official skills and keeps the institutional grade placement explicit', () => {
    expect(validateSource(source)).toEqual([]);
    expect(source.skills.map(({ code }) => code)).toEqual(['EM13MAT302', 'EM13CNT204']);
    expect(source.skills.map(({ sequenceAfter }) => sequenceAfter)).toEqual(['EM13MAT101', 'EM13CNT101']);
    expect(source.recommendedGrade).toBe(1);
    expect(source.recommendedGradeSource).toBe('TECESCOLA_PEDAGOGICAL_SEQUENCE');
  });

  it('provides complete adaptive question sets with meaningful assessment variety', () => {
    for (const skill of source.skills) {
      expect(skill.lesson.content.length).toBeGreaterThan(900);
      expect(skill.lesson.workedExample.length).toBeGreaterThan(80);
      expect(skill.questions).toHaveLength(10);
      expect(new Set(skill.questions.map(({ contextFamily }) => contextFamily)).size).toBeGreaterThanOrEqual(8);
      for (const purpose of ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW']) {
        expect(skill.questions.filter((question) => question.purpose === purpose)).toHaveLength(2);
      }
      for (const question of skill.questions) {
        expect(new Set(question.options).size).toBe(4);
        expect(question.options.filter((option) => option === question.answer)).toHaveLength(1);
        expect(question.explanation.length).toBeGreaterThanOrEqual(45);
      }
    }
  });

  it('compiles deterministically and preserves V13 records and review status', () => {
    expect(buildMigration(source)).toBe(migration);
    expect(migration).toContain("('MAT', 'EM13MAT101')");
    expect(migration).toContain("('MAT', 'EM13MAT302')");
    expect(migration).toContain("('FIS', 'EM13CNT101')");
    expect(migration).toContain("('FIS', 'EM13CNT204')");
    expect(migration).toContain("to_regprocedure('public.start_guided_learning_session_v4(uuid,uuid,uuid)') is null");
    expect(migration).toContain("and lesson.version = coalesce(nullif(target_skill.metadata->>''content_version'', '''')::integer, 4)");
    expect(migration).toContain("and set_row.version = coalesce(nullif(target_skill.metadata->>''content_version'', '''')::integer, 4)");
    expect(migration).toContain("and question_set.version = coalesce((select case when skill.metadata->>''content_version'' ~ ''^[0-9]+$''");
    expect(migration).toContain("''subject_scope_id'', p_subject_id, ''content_version''");
    expect(migration).toContain('on conflict (catalog_id, code) do nothing');
    expect(migration).toContain("'official_component_code', skill_data->>'componentCode'");
    expect(migration).not.toContain('GUIDED_STUDY_V16_2_EXPECTED_EXISTING_OFFICIAL_SKILLS');
    expect(migration).not.toMatch(/metadata\s*=\s*\([^)]*metadata[^)]*\)\s*-/i);
    expect(migration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'content_version', (content->>'contentVersion')::integer");
    expect(migration).not.toMatch(/delete\s+from\s+public\.learning_(guided_sessions|skill_evidence|student_skill_state|question_bank|skill_lessons)/i);
    expect(migration).not.toContain('EM13MAT101\':v16.2');
    expect(migration).not.toContain('EM13CNT101\':v16.2');
  });
});
