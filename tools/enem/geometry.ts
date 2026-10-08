import { readFileSync } from "node:fs";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

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

export type PdfColumn = 'LEFT' | 'RIGHT' | 'FULL';
export type QuestionOptionLabel = 'A' | 'B' | 'C' | 'D' | 'E';

export interface PdfColumnBounds {
  left: number;
  right: number;
}

export interface QuestionRegion {
  questionNumber: number;
  page: number;
  column: PdfColumn;
  columnBounds: PdfColumnBounds;
  markerLine: PdfGeometryLine;
  lines: PdfGeometryLine[];
  bodyLines: PdfGeometryLine[];
  optionStart: { index: number; labels: string[] } | null;
  optionRegions: Record<QuestionOptionLabel, QuestionOptionRegion | null>;
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

export interface QuestionOptionPart {
  page: number;
  bounds: PdfCropBounds;
}

export interface QuestionOptionRegion {
  label: QuestionOptionLabel;
  lines: PdfGeometryLine[];
  parts: QuestionOptionPart[];
  text: string;
  status: 'VERIFIED' | 'REVIEW_REQUIRED';
  reason: string | null;
}

export interface StatementCropPlan {
  questionNumber: number;
  status: "READY" | "REVIEW_REQUIRED";
  parts: StatementCropPart[];
  excludedOptionLabels: string[];
  reason: string | null;
}

const OPTION_LABELS: QuestionOptionLabel[] = ['A', 'B', 'C', 'D', 'E'];

function optionLabelFromItem(text: string): QuestionOptionLabel | null {
  const label = text.trim().match(/^([A-E])(?:[-.):]?)(?:\s|$)/)?.[1];
  return label && OPTION_LABELS.includes(label as QuestionOptionLabel)
    ? label as QuestionOptionLabel
    : null;
}

export async function extractPdfGeometryPages(
  path: string,
): Promise<PdfGeometryPage[]> {
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
        if (!("str" in item) || !item.str.trim()) continue;
        const transform =
          "transform" in item ? item.transform : [1, 0, 0, 1, 0, 0];
        const fontSize = Math.max(
          0,
          Math.hypot(Number(transform[2]), Number(transform[3])),
        );
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
      pages.push({
        page: pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
      });
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

export function groupGeometryLines(
  page: PdfGeometryPage,
  tolerance = 2,
): PdfGeometryLine[] {
  const lines: PdfGeometryLine[] = [];
  for (const item of page.items) {
    const line = lines.find(
      (candidate) => Math.abs(candidate.y - item.y) <= tolerance,
    );
    if (line) line.items.push(item);
    else lines.push({ page: page.page, y: item.y, items: [item] });
  }
  return lines
    .map((line) => ({
      ...line,
      items: [...line.items].sort((left, right) => left.x - right.x),
    }))
    .sort((left, right) => right.y - left.y);
}

export function normalizeGeometryMarker(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function markerQuestionNumber(line: PdfGeometryLine): number | null {
  const value = normalizeGeometryMarker(
    line.items.map((item) => item.text).join(" "),
  );
  const match = value.match(/QUEST(?:AO)(\d{1,3})/);
  return match ? Number(match[1]) : null;
}

function lineBounds(
  lines: PdfGeometryLine[],
  page: PdfGeometryPage,
  xBounds?: { left: number; right: number },
): PdfCropBounds {
  const items = lines
    .flatMap((line) => line.items)
    .filter(
      (item) =>
        !xBounds ||
        (item.x + item.width >= xBounds.left && item.x <= xBounds.right),
    );
  const left = xBounds?.left ?? Math.min(...items.map((item) => item.x));
  const right =
    xBounds?.right ?? Math.max(...items.map((item) => item.x + item.width));
  const top = Math.max(
    ...items.map(
      (item) => item.y + Math.max(item.height, item.fontSize * 0.85),
    ),
  );
  const bottom = Math.min(
    ...items.map((item) => item.y - Math.max(2, item.fontSize * 0.25)),
  );
  const horizontalPadding = Math.min(16, page.width * 0.025);
  // Keep independent option crops disjoint. A large padding makes adjacent
  // alternatives overlap even when their text lines are clearly separated.
  const verticalPadding = Math.min(2, page.height * 0.003);
  const paddedLeft = xBounds
    ? Math.max(xBounds.left, left - horizontalPadding)
    : Math.max(0, left - horizontalPadding);
  const paddedRight = xBounds
    ? Math.min(xBounds.right, right + horizontalPadding)
    : Math.min(page.width, right + horizontalPadding);
  const paddedBottom = Math.max(0, bottom - verticalPadding);
  const paddedTop = Math.min(page.height, top + verticalPadding);
  return {
    left: paddedLeft,
    bottom: paddedBottom,
    width: Math.max(1, paddedRight - paddedLeft),
    height: Math.max(1, paddedTop - paddedBottom),
  };
}

function detectColumnSplit(page: PdfGeometryPage): number | null {
  const lines = groupGeometryLines(page);
  const candidates: number[] = [];
  for (const line of lines) {
    const items = line.items
      .filter((item) => item.y > page.height * 0.08 && item.y < page.height * 0.92)
      .sort((left, right) => left.x - right.x);
    for (let index = 1; index < items.length; index += 1) {
      const left = items[index - 1];
      const right = items[index];
      const leftCenter = left.x + left.width / 2;
      const rightCenter = right.x + right.width / 2;
      if (leftCenter >= page.width * 0.5 || rightCenter <= page.width * 0.5) continue;
      const gap = right.x - (left.x + left.width);
      if (gap >= Math.max(4, page.width * 0.008)) {
        candidates.push((left.x + left.width + right.x) / 2);
      }
    }
  }
  if (candidates.length < 1) return null;
  candidates.sort((left, right) => left - right);
  return candidates[Math.floor(candidates.length / 2)];
}

export function columnBounds(
  page: PdfGeometryPage,
  markerLine: PdfGeometryLine,
): PdfColumnBounds {
  const boundary = detectColumnSplit(page);
  if (boundary === null) return { left: 0, right: page.width };
  const markerX = markerLine.items[0]?.x ?? page.width / 2;
  return markerX < boundary
    ? { left: 0, right: boundary }
    : { left: boundary, right: page.width };
}

function columnForBounds(page: PdfGeometryPage, bounds: PdfColumnBounds): PdfColumn {
  if (bounds.left === 0 && bounds.right === page.width) return 'FULL';
  return bounds.right <= page.width / 2 ? 'LEFT' : 'RIGHT';
}

function boundsForColumn(page: PdfGeometryPage, column: PdfColumn): PdfColumnBounds {
  const boundary = detectColumnSplit(page);
  if (boundary === null || column === 'FULL') return { left: 0, right: page.width };
  return column === 'LEFT'
    ? { left: 0, right: boundary }
    : { left: boundary, right: page.width };
}

function itemsWithinBounds(line: PdfGeometryLine, bounds: PdfColumnBounds) {
  return line.items.filter(
    (item) => item.x + item.width >= bounds.left && item.x <= bounds.right,
  );
}

function isPageFurnitureLine(line: PdfGeometryLine) {
  const text = line.items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
  return /\b(?:pagina|página|page)\s+\d+\b/i.test(text)
    || /\bcaderno\s+\d+\b/i.test(text)
    || /^(?:LC|CH|CN|MT)\s*[-|]/i.test(text);
}

export function optionStart(
  lines: PdfGeometryLine[],
  xBounds?: { left: number; right: number },
): { index: number; labels: string[] } | null {
  const candidates = lines
    .flatMap((line, index) =>
      line.items
        .filter(
          (item) =>
            !xBounds ||
            (item.x + item.width >= xBounds.left && item.x <= xBounds.right),
        )
        .map((item) => ({
          index,
          label: optionLabelFromItem(item.text),
        })),
    )
    .filter(
      (item): item is { index: number; label: string } => item.label !== null,
    );
  for (let index = 0; index <= candidates.length - 5; index += 1) {
    const labels = candidates
      .slice(index, index + 5)
      .map((candidate) => candidate.label);
    if (labels.join("") === "ABCDE")
      return { index: candidates[index].index, labels };
  }
  return null;
}

interface MarkerEvent {
  line: PdfGeometryLine;
  markerLine: PdfGeometryLine;
  questionNumber: number;
  page: number;
  column: PdfColumn;
  bounds: PdfColumnBounds;
  lineIndex: number;
}

function markerEventsForPage(page: PdfGeometryPage): MarkerEvent[] {
  const lines = groupGeometryLines(page);
  const events: MarkerEvent[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const boundary = detectColumnSplit(page);
    const split = boundary !== null;
    const candidateBounds = split
      ? [
          { left: 0, right: boundary! },
          { left: boundary!, right: page.width },
        ]
      : [{ left: 0, right: page.width }];
    for (const bounds of candidateBounds) {
      const scopedItems = itemsWithinBounds(line, bounds);
      if (!scopedItems.length) continue;
      const scopedLine = { ...line, items: scopedItems };
      const questionNumber = markerQuestionNumber(scopedLine);
      if (questionNumber === null) continue;
      events.push({
        line,
        markerLine: scopedLine,
        questionNumber,
        page: page.page,
        column: columnForBounds(page, bounds),
        bounds,
        lineIndex,
      });
    }
  }
  return events;
}

export function buildQuestionRegions(pages: PdfGeometryPage[]): QuestionRegion[] {
  const orderedPages = [...pages].sort((left, right) => left.page - right.page);
  const pageLines = new Map(orderedPages.map((page) => [page.page, groupGeometryLines(page)]));
  const events = orderedPages.flatMap((page) => markerEventsForPage(page));
  return events.map((event, eventIndex) => {
    const pagePosition = orderedPages.findIndex((page) => page.page === event.page);
    const nextInColumn = events.slice(eventIndex + 1).find(
      (candidate) => candidate.column === event.column && candidate.page >= event.page,
    );
    // A column can disappear on a continuation page (for example when the
    // booklet switches from two columns to a full-width language block). In
    // that case the next forward question still terminates this region.
    const nextForwardQuestion = events.slice(eventIndex + 1).find(
      (candidate) => candidate.page > event.page && candidate.questionNumber > event.questionNumber,
    );
    const next = [nextInColumn, nextForwardQuestion]
      .filter((candidate): candidate is MarkerEvent => Boolean(candidate))
      .sort((left, right) => left.page - right.page || left.lineIndex - right.lineIndex)[0];
    const lines: PdfGeometryLine[] = [];
    for (let index = pagePosition; index < orderedPages.length; index += 1) {
      const page = orderedPages[index];
      const pageLinesForRegion = pageLines.get(page.page) ?? [];
      const start = page.page === event.page ? event.lineIndex : 0;
      const end = next?.page === page.page
        ? next.lineIndex
        : next && page.page > next.page
          ? 0
          : pageLinesForRegion.length;
      if (end <= start) break;
      const pageBounds = page.page === event.page
        ? event.bounds
        : boundsForColumn(page, event.column);
      lines.push(
        ...pageLinesForRegion
          .slice(start, end)
          .map((line) => ({ ...line, items: itemsWithinBounds(line, pageBounds) }))
          .filter((line) => line.items.length > 0 && !isPageFurnitureLine(line)),
      );
      if (next?.page === page.page) break;
    }
    const markerLine = lines[0] ?? event.markerLine;
    const bodyLines = lines.slice(1);
    const scopedOption = optionStart(bodyLines, event.bounds);
    const region: QuestionRegion = {
      questionNumber: event.questionNumber,
      page: event.page,
      column: event.column,
      columnBounds: event.bounds,
      markerLine,
      lines,
      bodyLines,
      optionStart: scopedOption,
      optionRegions: {
        A: null,
        B: null,
        C: null,
        D: null,
        E: null,
      },
    };
    if (!scopedOption) return region;

    const candidates = optionCandidates(bodyLines, event.bounds);
    const startCandidate = candidates.findIndex(
      (candidate) => candidate.index === scopedOption.index && candidate.label === 'A',
    );
    const sequence = startCandidate >= 0
      ? candidates.slice(startCandidate, startCandidate + OPTION_LABELS.length)
      : [];
    if (sequence.length !== OPTION_LABELS.length || sequence.map((item) => item.label).join('') !== 'ABCDE') {
      return region;
    }

    for (let sequenceIndex = 0; sequenceIndex < sequence.length; sequenceIndex += 1) {
      const candidate = sequence[sequenceIndex];
      const next = sequence[sequenceIndex + 1];
      const start = candidate.index;
      const end = next?.index ?? bodyLines.length;
      const optionLines = bodyLines.slice(start, end);
      const parts: QuestionOptionPart[] = [];
      const byPage = new Map<number, PdfGeometryLine[]>();
      for (const line of optionLines) {
        const bucket = byPage.get(line.page) ?? [];
        bucket.push(line);
        byPage.set(line.page, bucket);
      }
      for (const [pageNumber, pageLinesForOption] of byPage) {
        const page = orderedPages.find((item) => item.page === pageNumber);
        if (!page || !pageLinesForOption.length) continue;
        parts.push({
          page: pageNumber,
          bounds: lineBounds(pageLinesForOption, page, boundsForColumn(page, event.column)),
        });
      }
      const labelsOnStartLine = candidates.filter((item) => item.index === start);
      const status = optionLines.length > 0 && parts.length > 0 && labelsOnStartLine.length === 1
        ? 'VERIFIED'
        : 'REVIEW_REQUIRED';
      region.optionRegions[candidate.label] = {
        label: candidate.label,
        lines: optionLines,
        parts,
        text: optionLines.flatMap((line) => line.items).map((item) => item.text).join(' ').trim(),
        status,
        reason: status === 'VERIFIED' ? null : 'OPTION_BOUNDARY_NOT_UNIQUE',
      };
    }
    separateOptionCropBounds(region);
    separateOptionABounds(region);
    return region;
  });
}

function validateStatementRegion(region: QuestionRegion) {
  const statementLines = region.optionStart
    ? region.bodyLines.slice(0, region.optionStart.index)
    : region.bodyLines;
  const text = statementLines.flatMap((line) => line.items).map((item) => item.text).join(' ').trim();
  if (!region.optionStart || region.optionStart.labels.join('') !== 'ABCDE') return 'OPTION_SEQUENCE_NOT_CONFIRMED';
  const optionRegions = Object.values(region.optionRegions);
  if (optionRegions.some((option) => !option || option.status !== 'VERIFIED' || option.parts.length === 0)) {
    return 'OPTION_REGIONS_NOT_CONFIRMED';
  }
  if (text.length < 20) return 'STATEMENT_TOO_SHORT';
  if (/QUEST(?:AO|ÃO)\s*\d{1,3}/i.test(text)) return 'CROSS_COLUMN_OR_NEXT_QUESTION';
  if (/^(?:caderno|gabarito|quest(?:ao|ão))\b/i.test(text)) return 'HEADER_ONLY_CROP';
  return null;
}

function boundsOverlap(left: PdfCropBounds, right: PdfCropBounds, tolerance = 0.5) {
  return left.left < right.left + right.width - tolerance
    && left.left + left.width > right.left + tolerance
    && left.bottom < right.bottom + right.height - tolerance
    && left.bottom + left.height > right.bottom + tolerance;
}

function lineTop(line: PdfGeometryLine) {
  return Math.max(...line.items.map((item) => item.y + Math.max(item.height, item.fontSize * 0.85)));
}

function lineBottom(line: PdfGeometryLine) {
  return Math.min(...line.items.map((item) => item.y - Math.max(2, item.fontSize * 0.25)));
}

function pageLineTop(lines: PdfGeometryLine[], page: number) {
  return Math.max(...lines.filter((line) => line.page === page).map(lineTop));
}

function pageLineBottom(lines: PdfGeometryLine[], page: number) {
  return Math.min(...lines.filter((line) => line.page === page).map(lineBottom));
}

function partForPage(parts: QuestionOptionPart[], page: number) {
  return parts.find((part) => part.page === page);
}

function statementOptionBoundary(region: QuestionRegion, page: number) {
  const statementLines = region.optionStart
    ? region.bodyLines.slice(0, region.optionStart.index).filter((line) => line.page === page)
    : [];
  const optionLines = (region.optionRegions.A?.lines ?? []).filter((line) => line.page === page);
  if (!statementLines.length || !optionLines.length) return null;
  return (pageLineBottom(statementLines, page) + pageLineTop(optionLines, page)) / 2;
}

function separateOptionABounds(region: QuestionRegion) {
  for (const optionPart of region.optionRegions.A?.parts ?? []) {
    const boundary = statementOptionBoundary(region, optionPart.page);
    if (boundary === null) continue;
    const currentTop = optionPart.bounds.bottom + optionPart.bounds.height;
    optionPart.bounds.height = Math.max(1, Math.min(currentTop, boundary) - optionPart.bounds.bottom);
  }
}

function separateOptionCropBounds(region: QuestionRegion) {
  for (let index = 0; index < OPTION_LABELS.length - 1; index += 1) {
    const upper = region.optionRegions[OPTION_LABELS[index]];
    const lower = region.optionRegions[OPTION_LABELS[index + 1]];
    if (!upper || !lower) continue;
    for (const page of new Set([...upper.parts.map((part) => part.page), ...lower.parts.map((part) => part.page)])) {
      const upperPart = partForPage(upper.parts, page);
      const lowerPart = partForPage(lower.parts, page);
      const upperLines = upper.lines.filter((line) => line.page === page);
      const lowerLines = lower.lines.filter((line) => line.page === page);
      if (!upperPart || !lowerPart || !upperLines.length || !lowerLines.length) continue;
      const boundary = (pageLineBottom(upperLines, page) + pageLineTop(lowerLines, page)) / 2;
      const upperTop = upperPart.bounds.bottom + upperPart.bounds.height;
      const lowerBottom = lowerPart.bounds.bottom;
      upperPart.bounds.bottom = Math.max(upperPart.bounds.bottom, boundary);
      upperPart.bounds.height = Math.max(1, upperTop - upperPart.bounds.bottom);
      lowerPart.bounds.height = Math.max(1, Math.min(lowerPart.bounds.bottom + lowerPart.bounds.height, boundary) - lowerBottom);
    }
  }
}

function separateStatementCropBounds(
  region: QuestionRegion,
  parts: StatementCropPart[],
) {
  const statementLines = region.optionStart
    ? region.bodyLines.slice(0, region.optionStart.index)
    : [];
  const optionALines = region.optionRegions.A?.lines ?? [];
  if (!statementLines.length || !optionALines.length) return;

  for (const statementPart of parts) {
    const page = statementPart.page;
    const optionAPart = partForPage(region.optionRegions.A?.parts ?? [], page);
    if (!statementLines.some((line) => line.page === page) || !optionALines.some((line) => line.page === page) || !optionAPart) continue;

    const boundary = statementOptionBoundary(region, page);
    if (boundary === null) continue;
    const currentStatementBottom = statementPart.bounds.bottom;
    const currentStatementTop = currentStatementBottom + statementPart.bounds.height;
    const currentOptionBottom = optionAPart.bounds.bottom;
    const currentOptionTop = currentOptionBottom + optionAPart.bounds.height;
    if (currentStatementBottom >= currentOptionTop || currentOptionBottom >= currentStatementTop) continue;

    const nextStatementBottom = Math.max(currentStatementBottom, boundary);
    const nextOptionTop = Math.min(currentOptionTop, boundary);
    statementPart.bounds.bottom = nextStatementBottom;
    statementPart.bounds.height = Math.max(1, currentStatementTop - nextStatementBottom);
    optionAPart.bounds.height = Math.max(1, nextOptionTop - currentOptionBottom);
  }
}

interface OptionCandidate {
  index: number;
  label: QuestionOptionLabel;
}

function optionCandidates(
  lines: PdfGeometryLine[],
  xBounds?: PdfColumnBounds,
): OptionCandidate[] {
  return lines.flatMap((line, index) =>
    line.items
      .filter((item) =>
        !xBounds ||
        (item.x + item.width >= xBounds.left && item.x <= xBounds.right),
      )
      .map((item) => optionLabelFromItem(item.text))
      .filter((label): label is QuestionOptionLabel => label !== null)
      .map((label) => ({ index, label })),
  );
}

/**
 * Plans rectangular PDF crops from the official statement marker to the first
 * validated alternative. The crop is column-bounded so the adjacent column
 * cannot contaminate a statement; alternatives are rendered as HTML controls.
 */
export function planStatementCrop(
  pages: PdfGeometryPage[],
  questionNumber: number,
  selector: { page?: number; column?: PdfColumn } = {},
): StatementCropPlan {
  const pageByNumber = new Map(pages.map((page) => [page.page, page]));
  const region = buildQuestionRegions(pages).find((item) =>
    item.questionNumber === questionNumber
      && (selector.page === undefined || item.page === selector.page)
      && (selector.column === undefined || item.column === selector.column),
  );
  if (!region)
    return {
      questionNumber,
      status: "REVIEW_REQUIRED",
      parts: [],
      excludedOptionLabels: [],
      reason: "QUESTION_MARKER_NOT_FOUND",
    };
  const option = region.optionStart;
  const bodyLines = option
    ? [region.markerLine, ...region.bodyLines.slice(0, option.index)]
    : [region.markerLine, ...region.bodyLines];
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
    const pageBounds = pageNumber === region.page
      ? region.columnBounds
      : boundsForColumn(page, region.column);
    let bounds = lineBounds(pageLines, page, pageBounds);
    if (pageNumber === region.page) {
      const markerItems = region.markerLine.items.filter(
        (item) =>
          item.x + item.width >= region.columnBounds.left &&
            item.x <= region.columnBounds.right,
      );
      const markerTop = Math.max(
        ...markerItems.map(
          (item) => item.y + Math.max(item.height, item.fontSize * 0.85),
        ),
      );
      const top = Math.min(bounds.bottom + bounds.height, markerTop + 4);
      bounds = { ...bounds, height: Math.max(1, top - bounds.bottom) };
    }
    parts.push({
      page: pageNumber,
      bounds,
      startsWithQuestionMarker: pageNumber === region.page,
      excludesOptions: Boolean(option),
    });
  }
  separateStatementCropBounds(region, parts);
  let validationReason = validateStatementRegion(region);
  if (!validationReason) {
    const optionParts = Object.values(region.optionRegions).flatMap((option) => option?.parts ?? []);
    const statementOverlapsOption = parts.some((statementPart) =>
      optionParts.some((optionPart) =>
        statementPart.page === optionPart.page && boundsOverlap(statementPart.bounds, optionPart.bounds),
      ),
    );
    const optionOverlapsOption = optionParts.some((left, index) =>
      optionParts.slice(index + 1).some((right) =>
        left.page === right.page && boundsOverlap(left.bounds, right.bounds),
      ),
    );
    if (statementOverlapsOption) validationReason = 'STATEMENT_OPTION_OVERLAP';
    else if (optionOverlapsOption) validationReason = 'OPTION_OVERLAP';
  }
  const ready = Boolean(!validationReason && parts.length > 0);
  return {
    questionNumber,
    status: ready ? "READY" : "REVIEW_REQUIRED",
    parts,
    excludedOptionLabels: option?.labels ?? [],
    reason: ready ? null : validationReason ?? "STATEMENT_CROP_NOT_VALIDATED",
  };
}
