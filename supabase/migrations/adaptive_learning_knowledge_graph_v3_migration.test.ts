import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930002000_adaptive_learning_knowledge_graph_v3.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning knowledge graph v3 migration', () => {
  it('creates the canonical subject and explicit question mapping contracts', () => {
    expect(migration).toContain('learning_canonical_subjects');
    expect(migration).toContain("skill_role in ('PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER')");
    expect(migration).toContain('knowledge_mapping_status');
    expect(migration).toContain('ADAPTIVE_SET_WITH_UNMAPPED_QUESTION');
    expect(migration).toContain('learning_question_option_misconceptions');
  });

  it('keeps secondary negative evidence gated by explicit misconception mappings', () => {
    expect(migration).toContain('learning_evidence_attributions');
    expect(migration).toContain('learning_misconception_signals');
    expect(migration).toContain('learning_guided_step_attempts_record_v3_attribution');
    expect(migration).toContain('MISCONCEPTION_REPEATED');
    expect(migration).toContain('distinct_context_count');
  });

  it('preserves cross-subject targets and original guided objectives', () => {
    expect(migration).toContain('learning_skill_relationships');
    expect(migration).toContain("relation_type in ('PREREQUISITE', 'RELATED', 'TRANSFER')");
    expect(migration).toContain('original_target_canonical_subject_id');
    expect(migration).toContain('CROSS_SUBJECT_BRIDGE');
    expect(migration).toContain('original_target_preserved');
  });

  it('seeds all target verticals and uses authored V3 provenance', () => {
    expect(migration).toContain("'TECESCOLA_CORE_V3'");
    expect(migration).toContain("'adaptive_version', 'V3'");
    expect(migration).toContain('v3_question_pack');
    expect(migration).toContain('Um carro percorre 120 km em 2 h');
    expect(migration).toContain("'COMPUTING'");
    expect(migration).toContain("'RELIGIOUS_EDUCATION'");
    expect(migration).not.toContain('for question_number in 1..12 loop');
    expect(migration).not.toContain("target_row.subject_name || ' | '");
  });

  it('maps the canonical skill registry fields by their JSON names before importing content', () => {
    expect(migration).toContain(
      'as item(subject text, code text, title text, domain text, skill_order integer)',
    );
    expect(migration).toContain('skill_row.subject');
    expect(migration).toContain('skill_row.code');
    expect(migration).toContain('skill_row.title');
    expect(migration).not.toContain('skill_row.subject_code');
    expect(migration).not.toContain('skill_row.skill_code');
    expect(migration).toContain('ADAPTIVE_V3_SKILL_REGISTRY_INCOMPLETE');
    expect(migration).toContain('ADAPTIVE_V3_CONTENT_PREFLIGHT_INCOMPLETE');
    expect(migration).toContain('ADAPTIVE_V3_CONTENT_MATERIALIZATION_INCOMPLETE');
    expect(migration).toContain('ADAPTIVE_V3_QUESTION_SET_INCOMPLETE');
  });

  it('does not let an empty newer question set shadow a usable fallback', () => {
    expect(migration).toContain('create or replace function private.pick_learning_question_set_v2');
    expect(migration).toContain('where item.question_set_id = set_row.id');
    expect(migration).toContain('join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active');
  });

  it('materializes V3 question sets from explicit canonical skill links', () => {
    expect(migration).toContain('join public.learning_question_bank_skill_links primary_link');
    expect(migration).toContain('primary_link.canonical_skill_id = target_row.target_id');
    expect(migration).toContain("primary_link.skill_role = 'PRIMARY'");
  });

  it('keeps capability evidence gates explicit for non-objective subjects', () => {
    expect(migration).toContain("'CONSTRUCTED_EVIDENCE_REQUIRED'");
    expect(migration).toContain("'OBSERVATIONAL_EVIDENCE_REQUIRED'");
    expect(migration).toContain('enforce_learning_v3_capability_gate');
    expect(migration).toContain("new.state := 'PRACTICING'");
  });

  it('does not expose option misconception mappings to authenticated students', () => {
    expect(migration).toContain('revoke all on table public.learning_question_option_misconceptions from anon, authenticated');
    expect(migration).toContain('grant execute on function public.validate_learning_question_set_v3');
  });
});
