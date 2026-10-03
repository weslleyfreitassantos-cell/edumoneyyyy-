import { describe, expect, it } from 'vitest';

import { parseOfficialYearArtifacts, parseOfficialYearPages } from './discover';

const catalogHtml = `
  <div class="tab-content" data-id="2025" data-url="https://www.gov.br/inep/enem/provas-e-gabaritos/2025"></div>
  <div class="tab-content" data-id="2024" data-url="https://www.gov.br/inep/enem/provas-e-gabaritos/2024"></div>
  <div class="tab-content" data-id="1997" data-url="https://www.gov.br/inep/enem/provas-e-gabaritos/1997"></div>
`;

describe('ENEM official discovery', () => {
  it('discovers year pages from the official catalog instead of hard-coding years', () => {
    expect(parseOfficialYearPages(catalogHtml)).toEqual([
      { year: 2025, url: 'https://www.gov.br/inep/enem/provas-e-gabaritos/2025' },
      { year: 2024, url: 'https://www.gov.br/inep/enem/provas-e-gabaritos/2024' },
    ]);
  });

  it('pairs printed exam and answer-key PDFs by day and booklet', () => {
    const html = `
      <a href="https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D2_CD5.pdf">Prova</a>
      <a href="https://download.inep.gov.br/enem/provas_e_gabaritos/2025_GB_impresso_D2_CD5.pdf">Gabarito</a>
      <a href="https://example.com/2025_GB_impresso_D2_CD6.pdf">Gabarito</a>
      <a href="https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D1_CD1.pdf">Prova</a>
      <a href="https://download.inep.gov.br/enem/provas_e_gabaritos/2025_GB_impresso_D1_CD1.pdf">Gabarito</a>
    `;

    const result = parseOfficialYearArtifacts(2025, html, 'https://www.gov.br/inep/enem/provas-e-gabaritos/2025');

    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts).toContainEqual({
      year: 2025,
      exam: 'ENEM',
      application: 'REGULAR',
      day: 'D2',
      booklet: 'CD5',
      sourceReference: 'https://www.gov.br/inep/enem/provas-e-gabaritos/2025',
      examUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D2_CD5.pdf',
      answerKeyUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_GB_impresso_D2_CD5.pdf',
    });
    expect(result.issues).toEqual([]);
  });

  it('reports an official link without a pair instead of dropping provenance silently', () => {
    const result = parseOfficialYearArtifacts(
      2025,
      '<a href="https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D1_CD1.pdf">Prova</a>',
      'https://www.gov.br/inep/enem/provas-e-gabaritos/2025',
    );

    expect(result.artifacts).toHaveLength(0);
    expect(result.issues).toEqual(['UNPAIRED_ARTIFACT:2025:D1:CD1']);
  });
});
