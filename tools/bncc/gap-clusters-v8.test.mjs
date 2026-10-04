import { describe, expect, it } from 'vitest';
import { buildGapClustersV8 } from './build-gap-clusters-v8.mjs';

describe('BNCC V8 semantic gap clusters', () => {
  const candidates = { catalogVersion: 'TEST', catalogHash: 'a'.repeat(64), candidates: [
    { officialCode: 'EF01MA01', mappingType: 'CANONICAL_GAP', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '01', componentCode: 'MA' },
    { officialCode: 'EF01MA02', mappingType: 'CANONICAL_GAP', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '01', componentCode: 'MA' },
    { officialCode: 'EF01MA03', mappingType: 'CANONICAL_GAP', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '01', componentCode: 'MA' },
  ] };
  const semantic = { candidates: [
    { officialCode: 'EF01MA01', descriptor: 'Identificar números naturais.' },
    { officialCode: 'EF01MA02', descriptor: 'Identificar figuras geométricas.' },
    { officialCode: 'EF01MA03', descriptor: 'Identificar números naturais.' },
  ] };
  const context = { contextHash: 'b'.repeat(64), nodes: semantic.candidates.map((item) => ({ code: item.officialCode, component: { knowledgeArea: 'MATEMATICA' }, officialContext: { descriptor: item.descriptor, cognitiveOperation: 'identificar', fieldOfExperience: null }, officialPath: ['ENSINO_FUNDAMENTAL', 'MA', '01'], sourceProvenance: { artifactId: 'TEST', page: 1 }, neighborNodes: [] })) };

  it('splits same-verb objectives by semantic object', () => {
    const output = buildGapClustersV8(candidates, semantic, context);
    expect(output.summary.officialGapCodes).toBe(3);
    expect(output.summary.gapClusters).toBe(2);
    expect(output.clusters.every((cluster) => cluster.reviewStatus === 'PEDAGOGICAL_REVIEW_PENDING')).toBe(true);
    expect(output.clusters.find((cluster) => cluster.semanticObject.includes('NUMBERS'))?.officialCodes).toEqual(['EF01MA01', 'EF01MA03']);
  });

  it('never promotes a candidate while clustering', () => {
    const output = buildGapClustersV8(candidates, semantic, context);
    expect(output.summary.promoted).toBe(0);
    expect(output.clusters.every((cluster) => cluster.promotionStatus === 'NOT_PROMOTED')).toBe(true);
  });
});
