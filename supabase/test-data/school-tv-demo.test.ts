import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fixture = readFileSync(new URL('./school-tv-demo.sql', import.meta.url), 'utf8');

describe('Escola TV demo fixture', () => {
  it('models a complete integral school with a balanced teacher pool', () => {
    expect(fixture).toContain("('LP', 5)");
    expect(fixture).toContain("('MAT', 5)");
    expect(fixture).toContain("('CIE', 3)");
    expect(fixture).toContain("('LEI', 3)");
    expect(fixture).toContain("('PROJ', 3)");
    expect(fixture).toContain("('QA - Ensino Fundamental I', 'EST', 2)");
    expect(fixture).toContain("'Integral'");
    expect(fixture).toContain("time '07:00'");
    expect(fixture).toContain("time '15:40'");
  });

  it('creates one active offering per class, subject and term', () => {
    expect(fixture).toContain('school_tv_demo_offering_assignments');
    expect(fixture).toContain('row_number() over (');
    expect(fixture).toContain('active = (ranked.offering_number = 1)');
    expect(fixture).toContain('partition by existing_offering.subject_id, existing_offering.class_id, existing_offering.term_id');
  });
});
