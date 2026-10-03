import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = JSON.parse(readFileSync('content/bncc/canonical/registry.json', 'utf8'));

describe('BNCC canonical registry', () => {
  it('keeps the V1 seeds and the versioned V4 leaf skills together', () => {
    const codes = registry.skills.map((skill) => skill.code);
    expect(registry.skills).toHaveLength(58);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(['FRACTIONS', 'LINEAR_FUNCTION', 'COMPUTING_TRACE_ALGORITHM']));
  });

  it('classifies computing leaves without claiming official BNCC alignment', () => {
    const computing = registry.skills.find((skill) => skill.code === 'COMPUTING_TRACE_ALGORITHM');
    expect(computing).toMatchObject({
      stage: 'ENSINO_FUNDAMENTAL',
      subjectAreas: ['COMPUTACAO'],
      kind: 'LEAF',
    });
  });
});
