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
    expect(result.issues).toEqual(['UNPAIRED_ARTIFACT:2025:REGULAR:D1:CD1']);
  });

  it('pairs historical regular and PPL filenames without mixing applications', () => {
    const result = parseOfficialYearArtifacts(
      2016,
      `
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2016/2016_PV_impresso_D1_CD1.pdf">Prova</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/gabaritos/2016/GAB_ENEM_2016_DIA_1_01_AZUL.pdf">Gabarito</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2016/2016_PV_reaplicacao_PPL_D1_CD9.pdf">Prova PPL</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/ppl/2016/gabarito_caderno_branco_9_2016.pdf">Gabarito PPL</a>
      `,
      'https://www.gov.br/inep/enem/provas-e-gabaritos/2016',
    );

    expect(result.issues).toEqual([]);
    expect(result.artifacts).toContainEqual(expect.objectContaining({
      year: 2016,
      application: 'REGULAR',
      day: 'D1',
      booklet: 'CD1',
    }));
    expect(result.artifacts).toContainEqual(expect.objectContaining({
      year: 2016,
      application: 'PPL',
      day: 'D1',
      booklet: 'CD9',
    }));
  });

  it('matches caderno-only answer keys to the exam day instead of inferring from the code', () => {
    const result = parseOfficialYearArtifacts(
      2017,
      `
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2017/2017_PV_impresso_D2_CD11.pdf">Prova</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/gabaritos/2017/cad_11_gabarito_laranja_12112017.pdf">Gabarito</a>
      `,
      'https://www.gov.br/inep/enem/provas-e-gabaritos/2017',
    );

    expect(result.issues).toEqual([]);
    expect(result.artifacts).toContainEqual(expect.objectContaining({
      year: 2017,
      application: 'REGULAR',
      day: 'D2',
      booklet: 'CD11',
    }));
  });

  it('pairs the pre-modern color-based regular format', () => {
    const result = parseOfficialYearArtifacts(
      2015,
      `
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2015/2015_PV_impresso_D1_CD1.pdf">Prova</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/gabaritos/2015/CADERNO_1_AZUL_SABADO.pdf">Gabarito</a>
      `,
      'https://www.gov.br/inep/enem/provas-e-gabaritos/2015',
    );

    expect(result.issues).toEqual([]);
    expect(result.artifacts[0]).toMatchObject({
      year: 2015,
      application: 'REGULAR',
      day: 'D1',
      booklet: 'CD1',
    });
  });

  it('fans out a historical day gabarito only across the standard regular booklets', () => {
    const result = parseOfficialYearArtifacts(
      2009,
      `
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2009/dia1_caderno1_azul.pdf">Prova</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2009/dia1_caderno2_amarelo.pdf">Prova</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2009/dia1_caderno3_branco.pdf">Prova</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2009/dia1_caderno4_rosa.pdf">Prova</a>
        <a href="https://download.inep.gov.br/educacao_basica/enem/gabaritos/2009/gabarito_dia1.pdf">Gabarito</a>
      `,
      'https://www.gov.br/inep/enem/provas-e-gabaritos/2009',
    );

    expect(result.issues).toEqual([]);
    expect(result.artifacts).toHaveLength(4);
    expect(new Set(result.artifacts.map((artifact) => artifact.answerKeyUrl))).toEqual(new Set([
      'https://download.inep.gov.br/educacao_basica/enem/gabaritos/2009/gabarito_dia1.pdf',
    ]));
    expect(result.artifacts.map((artifact) => artifact.booklet)).toEqual(['CD1', 'CD2', 'CD3', 'CD4']);
  });
});
