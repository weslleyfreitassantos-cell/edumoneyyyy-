import { describe, expect, it } from 'vitest';

import { groupGeometryLines, normalizeGeometryMarker, planStatementCrop, type PdfGeometryPage } from './geometry';

describe('ENEM geometry helpers', () => {
  it('groups fragments on the same baseline without losing horizontal order', () => {
    const page: PdfGeometryPage = {
      page: 4,
      width: 600,
      height: 800,
      items: [
        { text: 'B', x: 60, y: 100, width: 5, height: 10, fontSize: 10 },
        { text: 'Duas', x: 80, y: 100.5, width: 20, height: 10, fontSize: 10 },
        { text: 'A', x: 60, y: 120, width: 5, height: 10, fontSize: 10 },
        { text: 'Uma', x: 80, y: 120, width: 20, height: 10, fontSize: 10 },
      ],
    };
    const lines = groupGeometryLines(page);
    expect(lines[0].items.map((item) => item.text)).toEqual(['A', 'Uma']);
    expect(lines[1].items.map((item) => item.text)).toEqual(['B', 'Duas']);
  });

  it('normalizes question markers with split accented fragments', () => {
    expect(normalizeGeometryMarker('Q UEST ã O 03')).toBe('QUESTAO03');
  });

  it('crops only the question statement and excludes a confirmed A-E block', () => {
    const page: PdfGeometryPage = {
      page: 2,
      width: 600,
      height: 800,
      items: [
        { text: 'QUESTÃO', x: 60, y: 700, width: 55, height: 10, fontSize: 10 },
        { text: '12', x: 120, y: 700, width: 12, height: 10, fontSize: 10 },
        { text: 'Leia o texto e responda.', x: 60, y: 680, width: 180, height: 10, fontSize: 10 },
        { text: 'A', x: 60, y: 640, width: 8, height: 10, fontSize: 10 },
        { text: 'Uma opção', x: 75, y: 640, width: 80, height: 10, fontSize: 10 },
        { text: 'B', x: 60, y: 620, width: 8, height: 10, fontSize: 10 },
        { text: 'Outra opção', x: 75, y: 620, width: 90, height: 10, fontSize: 10 },
        { text: 'C', x: 60, y: 600, width: 8, height: 10, fontSize: 10 },
        { text: 'Terceira', x: 75, y: 600, width: 70, height: 10, fontSize: 10 },
        { text: 'D', x: 60, y: 580, width: 8, height: 10, fontSize: 10 },
        { text: 'Quarta', x: 75, y: 580, width: 60, height: 10, fontSize: 10 },
        { text: 'E', x: 60, y: 560, width: 8, height: 10, fontSize: 10 },
        { text: 'Quinta', x: 75, y: 560, width: 60, height: 10, fontSize: 10 },
      ],
    };
    const plan = planStatementCrop([page], 12);
    expect(plan.status).toBe('READY');
    expect(plan.excludedOptionLabels).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(plan.parts).toHaveLength(1);
    expect(plan.parts[0].bounds.bottom).toBeGreaterThan(640);
    expect(plan.parts[0].excludesOptions).toBe(true);
  });

  it('creates separate parts when a statement crosses a page boundary', () => {
    const pages: PdfGeometryPage[] = [
      { page: 1, width: 600, height: 800, items: [
        { text: 'QUESTÃO 12', x: 60, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'Continuação do enunciado', x: 60, y: 100, width: 160, height: 10, fontSize: 10 },
      ] },
      { page: 2, width: 600, height: 800, items: [
        { text: 'Ainda no enunciado', x: 60, y: 700, width: 140, height: 10, fontSize: 10 },
        { text: 'A', x: 60, y: 640, width: 8, height: 10, fontSize: 10 },
        { text: 'Uma', x: 75, y: 640, width: 40, height: 10, fontSize: 10 },
        { text: 'B', x: 60, y: 620, width: 8, height: 10, fontSize: 10 },
        { text: 'Duas', x: 75, y: 620, width: 40, height: 10, fontSize: 10 },
        { text: 'C', x: 60, y: 600, width: 8, height: 10, fontSize: 10 },
        { text: 'Três', x: 75, y: 600, width: 40, height: 10, fontSize: 10 },
        { text: 'D', x: 60, y: 580, width: 8, height: 10, fontSize: 10 },
        { text: 'Quatro', x: 75, y: 580, width: 50, height: 10, fontSize: 10 },
        { text: 'E', x: 60, y: 560, width: 8, height: 10, fontSize: 10 },
        { text: 'Cinco', x: 75, y: 560, width: 50, height: 10, fontSize: 10 },
      ] },
    ];
    const plan = planStatementCrop(pages, 12);
    expect(plan.status).toBe('READY');
    expect(plan.parts.map((part) => part.page)).toEqual([1, 2]);
  });
});
