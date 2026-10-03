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

  it('does not silently promote unresolved mappings', () => {
    expect(coverage.summary.totalOfficialNodes).toBe(catalog.nodes.length);
    expect(coverage.summary.unaccounted).toBe(catalog.nodes.length);
    expect(coverage.mappings.every((mapping) => mapping.status === 'UNACCOUNTED')).toBe(true);
    expect(coverage.mappings.every((mapping) => mapping.reviewStatus === 'REVIEW_REQUIRED')).toBe(true);
  });
});
