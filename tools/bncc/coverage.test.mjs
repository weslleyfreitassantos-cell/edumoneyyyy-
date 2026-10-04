import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalog = JSON.parse(readFileSync('content/bncc/official/catalog-2018.json', 'utf8'));
const coverage = JSON.parse(readFileSync('content/bncc/mappings/coverage-2018.json', 'utf8'));

describe('BNCC mapping coverage accounting', () => {
  it('has exactly one coverage row for every official code', () => {
    const official = new Set(catalog.nodes.map((node) => node.code));
    const mapped = coverage.mappings.map((node) => node.officialCode);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(new Set(mapped)).toEqual(official);
  });

  it('accounts for every official node without silently promoting unresolved mappings', () => {
    expect(coverage.summary.totalOfficialNodes).toBe(catalog.nodes.length);
    expect(coverage.summary.mapped).toBe(2);
    expect(coverage.summary.hierarchyOnly).toBe(104);
    expect(coverage.summary.sourceReviewRequired).toBe(1617);
    expect(coverage.summary.unaccounted).toBe(0);
    expect(coverage.mappings.every((mapping) => [
      'MAPPED',
      'HIERARCHY_ONLY',
      'SOURCE_REVIEW_REQUIRED',
      'EXPLICITLY_NON_ADAPTIVE',
    ].includes(mapping.status))).toBe(true);
    expect(coverage.mappings.filter((mapping) => mapping.status === 'SOURCE_REVIEW_REQUIRED')
      .every((mapping) => mapping.reviewStatus === 'PEDAGOGICAL_REVIEW_PENDING')).toBe(true);
    expect(coverage.mappings.filter((mapping) => mapping.status === 'HIERARCHY_ONLY')
      .every((mapping) => mapping.reviewStatus === 'NOT_APPLICABLE')).toBe(true);
  });

  it('keeps only the explicitly safe technical promotions mapped', () => {
    const promoted = coverage.mappings.filter((mapping) => mapping.status === 'MAPPED');
    expect(promoted.map((mapping) => mapping.officialCode)).toEqual(['EF06HI01', 'EF09CI01']);
    expect(promoted.every((mapping) => mapping.reviewStatus === 'TECH_VALIDATED')).toBe(true);
    expect(promoted.every((mapping) => mapping.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING')).toBe(true);
    expect(promoted.some((mapping) => mapping.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEWED')).toBe(false);
  });
});
