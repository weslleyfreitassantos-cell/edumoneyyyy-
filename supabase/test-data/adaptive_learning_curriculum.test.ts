import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fixture = readFileSync(
  new URL('./adaptive-learning-curriculum.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning curriculum fixture', () => {
  it('contains the small deterministic mathematics proof chain', () => {
    expect(fixture).toContain('TECESCOLA_MATEMATICA_FOUNDATIONS');
    expect(fixture).toContain("'FRACTIONS_FOUNDATIONS'");
    expect(fixture).toContain("'RATIO'");
    expect(fixture).toContain("'PROPORTION'");
    expect(fixture).toContain("'PERCENTAGE'");
    expect(fixture).toContain("'EQUATIONS'");
    expect(fixture).toContain("'LINEAR_FUNCTION'");
    expect(fixture).toContain("('LINEAR_FUNCTION', 'EQUATIONS')");
  });
});
