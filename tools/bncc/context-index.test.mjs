import { describe, expect, it } from 'vitest';
import { buildContextIndex } from './build-context-index.mjs';

describe('BNCC official context index', () => {
  it('keeps provenance and does not infer unavailable hierarchy', () => {
    const output = buildContextIndex({
      catalogVersion: 'TEST', catalogHash: 'a'.repeat(64), sources: [{ id: 'TEST_SOURCE', file: 'source.pdf' }],
      nodes: [
        { code: 'EF01MA01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '01', componentCode: 'MA', officialTextExcerpt: ') Comparar quantidades. (EF01MA02) Resolver problemas.', officialSource: { id: 'TEST_SOURCE', documentVersion: 'Test', url: 'https://example.test/source.pdf', page: 4 } },
        { code: 'EF01MA02', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '01', componentCode: 'MA', officialTextExcerpt: ') Resolver problemas.', officialSource: { id: 'TEST_SOURCE', documentVersion: 'Test', url: 'https://example.test/source.pdf', page: 4 } },
      ],
    }, { candidates: [{ officialCode: 'EF01MA01', descriptor: 'Comparar quantidades.' }] });
    expect(output.summary.officialNodes).toBe(2);
    expect(output.nodes[0].officialContext.descriptor).toBe('Comparar quantidades.');
    expect(output.nodes[0].officialContext.thematicUnit).toBeNull();
    expect(output.nodes[0].parentNodes).toEqual([]);
    expect(output.nodes[0].neighborNodes).toContain('EF01MA02');
    expect(output.nodes[0].sourceProvenance.page).toBe(4);
  });
});
