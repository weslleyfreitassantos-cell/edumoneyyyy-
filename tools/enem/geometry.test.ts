import { describe, expect, it } from 'vitest';

import { buildQuestionRegions, groupGeometryLines, normalizeGeometryMarker, planStatementCrop, type PdfGeometryPage } from './geometry';

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

  it('keeps horizontal padding inside the detected PDF column', () => {
    const page: PdfGeometryPage = {
      page: 3,
      width: 600,
      height: 800,
      items: [
        { text: 'QUESTÃO 12', x: 60, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'Enunciado da questão', x: 60, y: 680, width: 120, height: 10, fontSize: 10 },
        { text: 'QUESTÃO 13', x: 310, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'Outra coluna', x: 310, y: 680, width: 100, height: 10, fontSize: 10 },
        ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((label, index) => [
          { text: label, x: 60, y: 640 - index * 20, width: 8, height: 10, fontSize: 10 },
          { text: `Opção ${label}`, x: 75, y: 640 - index * 20, width: 55, height: 10, fontSize: 10 },
        ]),
      ],
    };
    const plan = planStatementCrop([page], 12);
    expect(plan.status).toBe('READY');
    expect(plan.parts[0].bounds.left + plan.parts[0].bounds.width).toBeLessThan(300);
  });

  it('keeps a two-column question away from the neighboring question and options', () => {
    const page: PdfGeometryPage = {
      page: 13,
      width: 600,
      height: 800,
      items: [
        { text: 'QUESTÃO 122', x: 40, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'Enunciado da coluna esquerda com conteúdo suficiente.', x: 40, y: 680, width: 190, height: 10, fontSize: 10 },
        { text: 'QUESTÃO 123', x: 320, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'Texto de outra questão que não pode entrar.', x: 320, y: 680, width: 190, height: 10, fontSize: 10 },
        ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((label, index) => [
          { text: label, x: 40, y: 620 - index * 20, width: 8, height: 10, fontSize: 10 },
          { text: `Alternativa ${label}`, x: 55, y: 620 - index * 20, width: 90, height: 10, fontSize: 10 },
        ]),
      ],
    };
    const region = buildQuestionRegions([page]).find((item) => item.questionNumber === 122)!;
    expect(region.column).toBe('LEFT');
    expect(region.optionStart?.labels).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(Object.values(region.optionRegions).map((option) => option?.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(Object.values(region.optionRegions).every((option) => option?.status === 'VERIFIED')).toBe(true);
    const optionParts = Object.values(region.optionRegions).flatMap((option) => option?.parts ?? []);
    expect(optionParts).toHaveLength(5);
    expect(optionParts.slice(0, -1).every((part, index) => {
      const next = optionParts[index + 1];
      return part.bounds.bottom >= next.bounds.bottom + next.bounds.height;
    })).toBe(true);
    expect(region.lines.flatMap((line) => line.items).map((item) => item.text).join(' ')).not.toContain('123');
    expect(planStatementCrop([page], 122).status).toBe('READY');
  });

  it('keeps visual alternative regions independent from the statement', () => {
    const page: PdfGeometryPage = {
      page: 16,
      width: 600,
      height: 800,
      items: [
        { text: 'QUESTÃO 126', x: 40, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'Observe a representação visual e escolha a alternativa correta.', x: 40, y: 680, width: 250, height: 10, fontSize: 10 },
        ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((label, index) => [
          { text: label, x: 40, y: 620 - index * 25, width: 8, height: 10, fontSize: 10 },
          { text: '', x: 55, y: 620 - index * 25, width: 160, height: 10, fontSize: 10 },
        ]),
      ],
    };
    const region = buildQuestionRegions([page]).find((item) => item.questionNumber === 126)!;
    expect(planStatementCrop([page], 126).status).toBe('READY');
    expect(Object.values(region.optionRegions).map((option) => option?.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(Object.values(region.optionRegions).every((option) => option?.parts.length === 1)).toBe(true);
  });

  it('shares a non-overlapping boundary between the statement and option A', () => {
    const page: PdfGeometryPage = {
      page: 17,
      width: 600,
      height: 800,
      items: [
        { text: 'QUESTÃO 127', x: 40, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'Enunciado próximo das alternativas com conteúdo suficiente.', x: 40, y: 640, width: 260, height: 10, fontSize: 10 },
        ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((label, index) => [
          { text: label, x: 40, y: 625 - index * 20, width: 8, height: 10, fontSize: 10 },
          { text: `Alternativa ${label}`, x: 55, y: 625 - index * 20, width: 90, height: 10, fontSize: 10 },
        ]),
      ],
    };
    const region = buildQuestionRegions([page]).find((item) => item.questionNumber === 127)!;
    const plan = planStatementCrop([page], 127);
    const statement = plan.parts[0].bounds;
    const optionA = region.optionRegions.A!.parts[0].bounds;
    expect(plan.status).toBe('READY');
    expect(statement.bottom + statement.height).toBeGreaterThanOrEqual(optionA.bottom + optionA.height);
    expect(statement.bottom).toBeGreaterThanOrEqual(optionA.bottom + optionA.height);
  });

  it('does not borrow an A-E block from another column or treat body numbers as options', () => {
    const page: PdfGeometryPage = {
      page: 14,
      width: 600,
      height: 800,
      items: [
        { text: 'QUESTÃO 124', x: 40, y: 700, width: 80, height: 10, fontSize: 10 },
        { text: 'O enunciado lista etapas 1 2 3 4 5 e termina sem alternativas.', x: 40, y: 680, width: 210, height: 10, fontSize: 10 },
        { text: 'QUESTÃO 999', x: 330, y: 700, width: 80, height: 10, fontSize: 10 },
        ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((label, index) => [
          { text: label, x: 330, y: 620 - index * 20, width: 8, height: 10, fontSize: 10 },
          { text: `Alternativa externa ${label}`, x: 345, y: 620 - index * 20, width: 110, height: 10, fontSize: 10 },
        ]),
      ],
    };
    const region = buildQuestionRegions([page]).find((item) => item.questionNumber === 124)!;
    expect(region.optionStart).toBeNull();
    expect(planStatementCrop([page], 124).status).toBe('REVIEW_REQUIRED');
  });

  it('rejects a header-only or truncated statement crop', () => {
    const page: PdfGeometryPage = {
      page: 15,
      width: 600,
      height: 800,
      items: [
        { text: 'QUESTÃO 125', x: 40, y: 700, width: 80, height: 10, fontSize: 10 },
        ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((label, index) => [
          { text: label, x: 40, y: 620 - index * 20, width: 8, height: 10, fontSize: 10 },
          { text: `Opção ${label}`, x: 55, y: 620 - index * 20, width: 70, height: 10, fontSize: 10 },
        ]),
      ],
    };
    const plan = planStatementCrop([page], 125);
    expect(plan.status).toBe('REVIEW_REQUIRED');
    expect(plan.reason).toBe('STATEMENT_TOO_SHORT');
  });
});
