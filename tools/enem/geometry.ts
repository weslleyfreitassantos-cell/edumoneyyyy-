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

export interface PdfCropBounds {
  left: number;
  bottom: number;
  width: number;
  height: number;
}

export interface StatementCropPart {
  page: number;
  bounds: PdfCropBounds;
  startsWithQuestionMarker: boolean;
  excludesOptions: boolean;
}

export interface StatementCropPlan {
  questionNumber: number;
  status: 'READY' | 'REVIEW_REQUIRED';
  parts: StatementCropPart[];
  excludedOptionLabels: string[];
  reason: string | null;
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

function markerQuestionNumber(line: PdfGeometryLine): number | null {
  const value = normalizeGeometryMarker(line.items.map((item) => item.text).join(' '));
  const match = value.match(/QUEST(?:AO)(\d{1,3})/);
  return match ? Number(match[1]) : null;
}

function optionLabel(line: PdfGeometryLine): string | null {
  for (const item of line.items) {
    const match = item.text.trim().match(/^([A-E])(?:[.)\-:]?)(?:\s|$)/i);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function lineBounds(lines: PdfGeometryLine[], page: PdfGeometryPage, xBounds?: { left: number; right: number }): PdfCropBounds {
  const items = lines
    .flatMap((line) => line.items)
    .filter((item) => !xBounds || item.x + item.width >= xBounds.left && item.x <= xBounds.right);
  const left = xBounds?.left ?? Math.min(...items.map((item) => item.x));
  const right = xBounds?.right ?? Math.max(...items.map((item) => item.x + item.width));
  const top = Math.max(...items.map((item) => item.y + Math.max(item.height, item.fontSize * 0.85)));
  const bottom = Math.min(...items.map((item) => item.y - Math.max(2, item.fontSize * 0.25)));
  const horizontalPadding = Math.min(16, page.width * 0.025);
  const verticalPadding = Math.min(14, page.height * 0.018);
  const paddedLeft = Math.max(0, left - horizontalPadding);
  const paddedRight = Math.min(page.width, right + horizontalPadding);
  const paddedBottom = Math.max(0, bottom - verticalPadding);
  const paddedTop = Math.min(page.height, top + verticalPadding);
  return {
    left: paddedLeft,
    bottom: paddedBottom,
    width: Math.max(1, paddedRight - paddedLeft),
    height: Math.max(1, paddedTop - paddedBottom),
  };
}

function columnBounds(page: PdfGeometryPage, markerLine: PdfGeometryLine): { left: number; right: number } {
  const markerX = markerLine.items[0]?.x ?? page.width / 2;
  const centers = page.items
    .map((item) => item.x + item.width / 2)
    .filter((x) => Number.isFinite(x))
    .sort((left, right) => left - right);
  let largestGap = 0;
  let boundary: number | null = null;
  for (let index = 1; index < centers.length; index += 1) {
    const gap = centers[index] - centers[index - 1];
    if (gap > largestGap) {
      largestGap = gap;
      boundary = (centers[index] + centers[index - 1]) / 2;
    }
  }
  if (boundary === null || largestGap < page.width * 0.12) return { left: 0, right: page.width };
  return markerX < boundary ? { left: 0, right: boundary } : { left: boundary, right: page.width };
}

function optionStart(lines: PdfGeometryLine[]): { index: number; labels: string[] } | null {
  const candidates = lines
    .map((line, index) => ({ index, label: optionLabel(line) }))
    .filter((item): item is { index: number; label: string } => item.label !== null);
  const start = candidates.find((candidate) => candidate.label === 'A');
  if (!start) return null;
  const labels: string[] = [];
  let expected = 'A';
  for (const candidate of candidates.filter((item) => item.index >= start.index)) {
    if (candidate.label !== expected) {
      if (candidate.index !== start.index) break;
      continue;
    }
    labels.push(candidate.label);
    expected = String.fromCharCode(expected.charCodeAt(0) + 1);
    if (labels.length === 5) return { index: start.index, labels };
  }
  return null;
}

/**
 * Plans rectangular PDF crops from the official statement marker to the first
 * validated alternative. The crop is column-bounded so the adjacent column
 * cannot contaminate a statement; alternatives are rendered as HTML controls.
 */
export function planStatementCrop(pages: PdfGeometryPage[], questionNumber: number): StatementCropPlan {
  const pageByNumber = new Map(pages.map((page) => [page.page, page]));
  const lines = pages.flatMap((page) => groupGeometryLines(page));
  const markers = lines
    .map((line, index) => ({ line, index, questionNumber: markerQuestionNumber(line) }))
    .filter((item): item is { line: PdfGeometryLine; index: number; questionNumber: number } => item.questionNumber !== null);
  const marker = markers.find((item) => item.questionNumber === questionNumber);
  if (!marker) return { questionNumber, status: 'REVIEW_REQUIRED', parts: [], excludedOptionLabels: [], reason: 'QUESTION_MARKER_NOT_FOUND' };
  const nextMarker = markers.find((item) => item.index > marker.index);
  const questionLines = lines.slice(marker.index, nextMarker?.index ?? lines.length);
  const option = optionStart(questionLines.slice(1));
  const bodyLines = option ? [questionLines[0], ...questionLines.slice(1, option.index + 1)] : questionLines;
  const byPage = new Map<number, PdfGeometryLine[]>();
  for (const line of bodyLines) {
    const bucket = byPage.get(line.page) ?? [];
    bucket.push(line);
    byPage.set(line.page, bucket);
  }
  const parts: StatementCropPart[] = [];
  for (const [pageNumber, pageLines] of byPage) {
    const page = pageByNumber.get(pageNumber);
    if (!page || !pageLines.length) continue;
    const bounds = lineBounds(pageLines, page, columnBounds(page, pageLines[0]));
    parts.push({
      page: pageNumber,
      bounds,
      startsWithQuestionMarker: pageNumber === marker.line.page,
      excludesOptions: Boolean(option),
    });
  }
  const ready = Boolean(option && option.labels.join('') === 'ABCDE' && parts.length > 0);
  return {
    questionNumber,
    status: ready ? 'READY' : 'REVIEW_REQUIRED',
    parts,
    excludedOptionLabels: option?.labels ?? [],
    reason: ready ? null : option ? 'OPTION_SEQUENCE_NOT_CONFIRMED' : 'OPTION_A_NOT_FOUND',
  };
}
