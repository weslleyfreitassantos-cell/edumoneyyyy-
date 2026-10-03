import { readFileSync } from 'node:fs';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfGeometryItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface PdfGeometryPage {
  page: number;
  width: number;
  height: number;
  items: PdfGeometryItem[];
}

export interface PdfGeometryLine {
  page: number;
  y: number;
  items: PdfGeometryItem[];
}

export async function extractPdfGeometryPages(path: string): Promise<PdfGeometryPage[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(readFileSync(path)),
    disableWorker: true,
  });
  const document = await loadingTask.promise;
  try {
    const pages: PdfGeometryPage[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfGeometryItem[] = [];

      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const transform = 'transform' in item ? item.transform : [1, 0, 0, 1, 0, 0];
        const fontSize = Math.max(0, Math.hypot(Number(transform[2]), Number(transform[3])));
        items.push({
          text: item.str.trim(),
          x: Number(transform[4]),
          y: Number(transform[5]),
          width: Number(item.width ?? 0),
          height: Number(item.height ?? fontSize),
          fontSize,
        });
      }

      items.sort((left, right) => right.y - left.y || left.x - right.x);
      pages.push({ page: pageNumber, width: viewport.width, height: viewport.height, items });
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

export function groupGeometryLines(page: PdfGeometryPage, tolerance = 2): PdfGeometryLine[] {
  const lines: PdfGeometryLine[] = [];
  for (const item of page.items) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (line) line.items.push(item);
    else lines.push({ page: page.page, y: item.y, items: [item] });
  }
  return lines
    .map((line) => ({ ...line, items: [...line.items].sort((left, right) => left.x - right.x) }))
    .sort((left, right) => right.y - left.y);
}

export function normalizeGeometryMarker(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}
