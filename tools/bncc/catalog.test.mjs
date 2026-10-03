import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalog = JSON.parse(readFileSync('content/bncc/official/catalog-2018.json', 'utf8'));
const manifest = JSON.parse(readFileSync('content/bncc/official/manifest.json', 'utf8'));

describe('BNCC official catalog freeze', () => {
  it('keeps official provenance and a deterministic catalog hash', () => {
    expect(catalog.sourceOfTruth).toBe('official_mec_bncc_pdf');
    expect(catalog.catalogHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.catalogHash).toBe(catalog.catalogHash);
    expect(catalog.nodes.length).toBe(1583);
  });

  it('accounts for every extracted code exactly once', () => {
    const codes = catalog.nodes.map((node) => node.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(catalog.coverage.duplicateOfficialCodes).toEqual([]);
    expect(catalog.nodes.every((node) => node.officialSource.url && node.officialSource.page)).toBe(true);
  });

  it('does not promote the unavailable computing source', () => {
    const computing = manifest.officialDocuments.find((document) => document.id === 'BNCC_COMPUTACAO_2022');
    expect(computing.status).toBe('BLOCKED_SOURCE_UNAVAILABLE');
  });
});
