import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileKnowledgeFactoryV4, hashNormalizedText } from './knowledge-factory-v4.mjs';

const root = new URL('../../', import.meta.url);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(new URL(relativePath, root), 'utf8'));

describe('BNCC total knowledge factory V4', () => {
  it('hashes source text consistently across Windows and Linux line endings', () => {
    expect(hashNormalizedText('source\ntext\n')).toBe(hashNormalizedText('source\r\ntext\r\n'));
  });

  it('accounts for the frozen official catalog without inventing mappings or source approvals', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');

    expect(report.officialCoverage).toMatchObject({ totalNodes: 1723, accountedNodes: 1723, unaccountedNodes: 0, sourceTextHumanVerified: 0, exactVerifiedMappings: 2 });
    expect(report.officialCoverage.byStage).toEqual({ EDUCACAO_INFANTIL: 104, ENSINO_FUNDAMENTAL: 1407, ENSINO_MEDIO: 212 });
    expect(report.teachableRequirements).toMatchObject({ skillNodes: 1619, earlyChildhoodDevelopmentObjectives: 104, mappedWithLessonAndQuestions: 2, mappedDeepContentReady: 0 });
    expect(report.humanReview).toMatchObject({ reviewersRecorded: 0, approvedItems: 0, fabricatedApprovalEvidence: false });
  });

  it('distinguishes a five-phase structural path from deep assessment coverage', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');

    expect(report.existingContent).toMatchObject({ v3Targets: 24, auditedSequences: 26, deepContentReady: 0, v3QuestionTotal: 160, questionsBelowAnyMinimum: 23, reviewPending: 26 });
    expect(report.existingContent.depthStatusCounts).toEqual({ STRUCTURAL_READY: 26 });
    expect(report.queue.byWave.WAVE_1).toBe(26);
  });

  it('prepares navigable unit persistence without student availability or fabricated BNCC links', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
    const sql = fs.readFileSync(new URL('../../content/bncc/authoring/curriculum-units-v4-staging.sql', import.meta.url), 'utf8');

    expect(report.curriculumUnits).toMatchObject({ sourceUnitCount: 53, v3NewUnits: 12, v3ExistingUnitExtensions: 13, totalCanonicalUnits: 65, skillsReferenced: 78, missingSkillReferences: [], officialCodesClaimed: 0, persistedRowsBeforeV4: 0, rowsPreparedForStaging: 65, activeRows: 0 });
    expect(sql).toContain("'NOT_CLAIMED', 'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false");
    expect(sql).toContain('on conflict (catalog_id, code) do update');
    expect(sql).not.toContain("'PUBLISHED'");
    expect(sql).toContain('Run knowledge-factory-v3-staging.sql first');
    expect(sql).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.learning_(?:guided_sessions|guided_steps|guided_step_attempts|student_skill_state|skill_evidence|enrollments)/i);
  });

  it('builds deterministic, resumable checkpoints and validates committed outputs', () => {
    const first = compileKnowledgeFactoryV4(undefined, true);
    const second = compileKnowledgeFactoryV4(undefined, true);
    const checkpoint = readJson('content/bncc/authoring/knowledge-factory-checkpoint-v4.json');

    expect(first.inventoryHash).toBe(second.inventoryHash);
    expect(checkpoint.inputHash).toHaveLength(64);
    expect(checkpoint.outputHash).toBe(first.inventoryHash);
    expect(checkpoint.completedWork).toContain('OFFICIAL_NODE_MATRIX_BUILT');
    expect(checkpoint.pendingItems).toBe(first.queue.totalItems);
    expect(checkpoint.currentWave).toBe(1);
  });

  it('keeps the historical V1/V2/V3 inputs and production outside the staging writer', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
    const sql = fs.readFileSync(new URL('../../content/bncc/authoring/curriculum-units-v4-staging.sql', import.meta.url), 'utf8');

    expect(report.safety).toMatchObject({ publicationStatus: 'STAGING', studentAvailableNewContent: 0, productionWrites: false, studentHistoryModified: false, existingInstitutionalUnitsModified: false, otherVpsServicesTouched: false, humanPedagogicalApprovalClaimed: false });
    expect(sql).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.learning_(?:units|skills|guided_sessions|guided_steps|student_skill_state)/i);
  });
});
