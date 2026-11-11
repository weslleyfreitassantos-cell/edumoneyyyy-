import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMigration, sourcePath, validateSource } from './guided-study-v17-content.mjs';

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

describe('Guided Study V17 subject strands', () => {
  it('validates ten exact BNCC strands and a complete adaptive-purpose set per strand', () => {
    expect(validateSource(source)).toEqual([]);
    expect(source.skills.map(({ code }) => code)).toEqual([
      'EM13CNT104', 'EM13CNT105', 'EM13LGG403', 'EM13LP05',
      'EM13CHS101', 'EM13CHS106', 'EM13CHS501', 'EM13CHS403', 'EM13LGG603', 'EM13LGG501',
    ]);
    for (const skill of source.skills) {
      expect(skill.questions).toHaveLength(10);
      expect(new Set(skill.questions.map(({ purpose }) => purpose))).toEqual(
        new Set(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW']),
      );
    }
  });

  it('rejects incomplete or falsely human-approved content', () => {
    const incomplete = structuredClone(source);
    incomplete.skills[0].questions.pop();
    expect(validateSource(incomplete)).toContain('EM13CNT104: expected ten authored questions');

    const falselyApproved = structuredClone(source);
    falselyApproved.authoringAudit.humanCertification = 'APPROVED';
    expect(validateSource(falselyApproved)).toContain('authoring audit must preserve prior records and not claim human certification');
  });

  it('generates deterministic additive SQL with explicit subject bindings and pending human review', () => {
    const first = buildMigration(source);
    expect(buildMigration(source)).toBe(first);
    expect(first).toContain('-- V17_CANONICAL_HASH=');
    expect(first).toContain("('QUI', 'EM13CNT104')");
    expect(first).toContain("('BIO', 'EM13CNT105')");
    expect(first).toContain("('ING', 'EM13LGG403')");
    expect(first).toContain("('LP', 'EM13LP05')");
    expect(first).toContain("('HIS', 'EM13CHS101')");
    expect(first).toContain("('GEO', 'EM13CHS106')");
    expect(first).toContain("('FIL', 'EM13CHS501')");
    expect(first).toContain("('SOC', 'EM13CHS403')");
    expect(first).toContain("('ART', 'EM13LGG603')");
    expect(first).toContain("('EDF', 'EM13LGG501')");
    expect(first).toContain("EM13LP[0-9]{2}");
    expect(first).toContain("GUIDED_STUDY_V17_MAPPED_VALIDATOR_SHAPE_CHANGED");
    expect(first).toContain("mapped_oid oid := 'private.validate_mapped_bncc_skill_v12(uuid,text,jsonb)'::regprocedure;");
    expect(first).toContain('GUIDED_STUDY_V17_MAPPED_VALIDATOR_OWNER_OR_SECURITY_CHANGED');
    expect(first.match(/do \$guided_study_v16_2_content_seed\$/g)).toHaveLength(1);
    expect(first).toContain("high_school_old text := $$p_skill_code ~ '^EM13[A-Z]{3}[0-9]{3}$'$$;");
    expect(first).toContain("('LP-HOM', 'LINGUAGENS'), ('PORT', 'LINGUAGENS')");
    expect(first).toContain("('ING-HOM', 'LINGUAGENS')");
    expect(first).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(first).not.toContain("('EDF', 'EM13CNT105')");
    expect(first).not.toContain('UPDATE public.learning_guided_sessions');
    expect(first).not.toContain('DELETE FROM public.learning_question_bank');
  });
});
