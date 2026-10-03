import { describe, expect, it } from 'vitest';

import { groupGeometryLines, normalizeGeometryMarker, type PdfGeometryPage } from './geometry';

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
});
