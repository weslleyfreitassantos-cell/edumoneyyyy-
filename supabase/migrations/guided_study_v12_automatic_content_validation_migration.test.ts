import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261108173911_guided_study_v12_automatic_content_validation.sql'), 'utf8');
const validationPage = readFileSync(resolve(process.cwd(), 'src/components/learning/GuidedStudyContentValidationPage.tsx'), 'utf8');
const routeSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

describe('Estudo Guiado V12 automated content validation', () => {
  it('separates technical validation from human pedagogical review', () => {
    expect(migration).toContain('technical_validation_status');
    expect(migration).toContain('AUTOMATIC_TECHNICAL_VALIDATION');
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).not.toContain("new.pedagogical_review_status := 'TECH_VALIDATED'");
    expect(validationPage).toContain('Não representam aprovação pedagógica humana');
    expect(validationPage).not.toMatch(/aprovar|homologar/i);
  });

  it('validates BNCC mapping and content integrity and rechecks changes', () => {
    expect(migration).toContain('OFFICIAL_BNCC_CODE_NOT_VERIFIABLE');
    expect(migration).toContain('QUESTION_PURPOSE_COVERAGE_INCOMPLETE');
    expect(migration).toContain('DUPLICATE_QUESTION_STEMS');
    expect(migration).toContain('TECHNICAL_VALIDATION_FAILED');
    expect(migration).toContain('function private.validate_mapped_bncc_skill_v12(uuid)');
    expect(migration).toContain('lesson.version = content_version');
    expect(migration).toContain("skill_row.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8'");
    expect(migration).toContain("target.stage = 'ENSINO_FUNDAMENTAL'");
    expect(migration).toContain('after insert or update or delete on public.learning_skill_lessons');
    expect(migration).toContain('after insert or update or delete on public.learning_question_set_items');
    expect(migration).toContain('adaptive_content_pack_v12_automatic_validation');
    expect(migration).toContain("source_type text not null check (source_type in ('BNCC_SKILL'");
    expect(migration).toContain('function private.enforce_bncc_high_school_v4_publication_gate()');
    expect(migration).not.toContain("new.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'");
  });

  it('removes review RPC access while preserving authenticated V11 endpoints', () => {
    expect(migration).toContain('revoke all on function public.review_central_studies_v2_candidate_v1');
    expect(migration).toContain('grant execute on function public.get_guided_study_overview_v11(uuid), public.start_guided_study_v11(uuid) to authenticated');
    expect(migration).toContain('validado tecnicamente para iniciar a próxima etapa');
    expect(routeSource).toContain('path="/teacher/pedagogical-center/content-validation"');
    expect(routeSource).not.toContain('central-studies-review');
  });
});
