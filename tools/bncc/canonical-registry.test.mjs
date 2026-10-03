import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = JSON.parse(readFileSync('content/bncc/canonical/registry.json', 'utf8'));

describe('BNCC canonical registry', () => {
  it('keeps the V1 seeds and the versioned V4 leaf skills together', () => {
    const codes = registry.skills.map((skill) => skill.code);
    expect(registry.skills).toHaveLength(71);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(['FRACTIONS', 'LINEAR_FUNCTION', 'COMPUTING_TRACE_ALGORITHM']));
    expect(codes).toEqual(expect.arrayContaining([
      'HISTORY_COMPARE_PERSPECTIVES',
      'MATH_SUCCESSIVE_PERCENT_CHANGE',
      'PHYSICS_INTERPRET_ACCELERATION',
      'PORTUGUESE_COMPARE_SOURCES',
    ]));
  });

  it('classifies computing leaves without claiming official BNCC alignment', () => {
    const computing = registry.skills.find((skill) => skill.code === 'COMPUTING_TRACE_ALGORITHM');
    expect(computing).toMatchObject({
      stage: 'ENSINO_FUNDAMENTAL',
      subjectAreas: ['COMPUTACAO'],
      kind: 'LEAF',
    });
  });

  it('keeps the canonical registry synchronized with every V4 subject skill', () => {
    const v4 = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v4/registry.json', 'utf8'));
    const subjectCodes = v4.subjects.flatMap((subject) => subject.leaves.map((leaf) => leaf.code));
    const codes = new Set(registry.skills.map((skill) => skill.code));
    expect(subjectCodes).toHaveLength(65);
    expect(new Set(subjectCodes).size).toBe(subjectCodes.length);
    expect(subjectCodes.every((code) => codes.has(code))).toBe(true);
  });
});
