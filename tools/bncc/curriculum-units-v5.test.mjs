import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packages = JSON.parse(readFileSync('content/bncc/packages/tec-escola-core-v4.json', 'utf8'));
const units = JSON.parse(readFileSync('content/bncc/curriculum/units-v5.json', 'utf8'));

describe('BNCC V5 curriculum units', () => {
  it('covers every existing TecEscola skill exactly once', () => {
    const expected = packages.packages.flatMap((pack) => pack.skills.map((skill) => skill.code)).sort();
    const actual = units.units.flatMap((unit) => unit.canonicalSkills).sort();
    expect(actual).toEqual(expected);
  });

  it('keeps current units product-ready without claiming BNCC equivalence', () => {
    expect(units.summary.totalUnits).toBeGreaterThan(0);
    expect(units.summary.officialCodesClaimed).toBe(0);
    expect(units.units.every((unit) => unit.availability === 'DEFAULT_AUTOMATIC_ELIGIBLE')).toBe(true);
    expect(units.units.every((unit) => unit.bnccAlignment === 'NOT_CLAIMED')).toBe(true);
  });
});
