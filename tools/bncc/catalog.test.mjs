import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalog = JSON.parse(readFileSync('content/bncc/official/catalog-2018.json', 'utf8'));
const manifest = JSON.parse(readFileSync('content/bncc/official/manifest.json', 'utf8'));

describe('BNCC official catalog freeze', () => {
  it('keeps official provenance and a deterministic catalog hash', () => {
    expect(catalog.sourceOfTruth).toBe('official_mec_bncc_pdf');
    expect(catalog.catalogHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.catalogHash).toBe(catalog.catalogHash);
    expect(catalog.nodes.length).toBe(1723);
    expect(manifest.officialDocuments.find((document) => document.id === 'BNCC_COMPUTACAO_2022')).toMatchObject({
      status: 'FROZEN',
      pages: 75,
      sha256: '60aab0b192acf867bc582dc06678cd8f3bc597e8f1b65256fc7bf04190bb793d',
    });
  });

  it('accounts for every extracted code exactly once', () => {
    const codes = catalog.nodes.map((node) => node.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(catalog.coverage.duplicateOfficialCodes).toEqual([]);
    expect(catalog.nodes.every((node) => node.officialSource.url && node.officialSource.page)).toBe(true);
  });

  it('includes the frozen official computing complement', () => {
    const computing = manifest.officialDocuments.find((document) => document.id === 'BNCC_COMPUTACAO_2022');
    expect(computing.status).toBe('FROZEN');
    expect(catalog.nodes.some((node) => node.code === 'EF01CO01')).toBe(true);
    expect(catalog.nodes.filter((node) => node.componentCode === 'CO')).toHaveLength(140);
  });
});
