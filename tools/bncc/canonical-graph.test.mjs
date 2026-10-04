import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildCanonicalGraph } from './build-canonical-graph.mjs';

describe('BNCC canonical graph audit', () => {
  it('keeps anchors, targetable leaves, seeds and unresolved semantic nodes distinct', () => {
    const output = buildCanonicalGraph(
      {
        subjects: [
          {
            code: 'MATH',
            name: 'Matematica',
            anchors: ['MATH_NUMBERS', 'MATH_DATA'],
            leaves: [{ code: 'MATH_DATA_TABLE', title: 'Interpretar tabela', objective: 'Interpretar tabela.', domain: 'DADOS', parent: 'MATH_DATA', readiness: 'GRAPH_ONLY', content_authoring_status: 'SCAFFOLD' }],
          },
        ],
      },
      { hierarchy: [['MATH_DATA', 'MATH_DATA_TABLE'], ['MATH_DATA', 'MATH_MISSING_LEAF']] },
      { skills: [{ code: 'LEGACY_FRACTIONS', title: 'Fracoes', stage: 'ENSINO_FUNDAMENTAL', gradeLevels: [6], subjectAreas: ['MATEMATICA'], kind: 'LEAF' }] },
    );
    expect(output.summary.anchors).toBe(2);
    expect(output.summary.leaves).toBe(1);
    expect(output.summary.seedSkills).toBe(1);
    expect(output.summary.targetableSkills).toBe(2);
    expect(output.summary.otherSemanticNodes).toBe(1);
    expect(output.summary.orphanAnchors).toEqual(['MATH_NUMBERS']);
    expect(output.nodes.find((node) => node.code === 'MATH_MISSING_LEAF').class).toBe('OTHER_SEMANTIC_NODE');
  });

  it('keeps the frozen production graph free of orphan anchors', () => {
    const output = buildCanonicalGraph(
      JSON.parse(readFileSync('content/adaptive/tec-escola-core-v4/registry.json', 'utf8')),
      JSON.parse(readFileSync('content/adaptive/tec-escola-core-v4/relationships.json', 'utf8')),
      JSON.parse(readFileSync('content/bncc/canonical/registry.json', 'utf8')),
    );
    expect(output.summary.orphanAnchors).toEqual([]);
    expect(output.summary.otherSemanticNodes).toBe(0);
    expect(output.edges).toContainEqual({ parent: 'MATHEMATICS_NUMBERS', child: 'FRACTIONS' });
  });
});
