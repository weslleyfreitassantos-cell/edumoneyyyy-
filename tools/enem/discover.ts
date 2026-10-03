import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { assertOfficialEnemReference } from '../../src/services/enemIngestion.ts';

export const ENEM_OFFICIAL_CATALOG_URL =
  'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos';

export interface EnemYearPage {
  year: number;
  url: string;
}

export interface EnemDiscoveredArtifact {
  year: number;
  exam: 'ENEM';
  application: 'REGULAR';
  day: string;
  booklet: string;
  sourceReference: string;
  examUrl: string;
  answerKeyUrl: string;
}

export interface EnemDiscoveryResult {
  schemaVersion: 1;
  catalogReference: string;
  discoveredAt: string;
  years: EnemYearPage[];
  artifacts: EnemDiscoveredArtifact[];
  issues: string[];
}

export type FetchText = (url: string) => Promise<string>;

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function absoluteOfficialUrl(value: string): string | null {
  try {
    return assertOfficialEnemReference(decodeHtml(value.trim()));
  } catch {
    return null;
  }
}

export function parseOfficialYearPages(
  html: string,
  catalogReference = ENEM_OFFICIAL_CATALOG_URL,
): EnemYearPage[] {
  const pages = new Map<number, EnemYearPage>();
  const tabPattern = /<div\b[^>]*class=["'][^"']*tab-content[^"']*["'][^>]*>/gi;

  for (const match of html.matchAll(tabPattern)) {
    const tag = match[0];
    const year = Number(attribute(tag, 'data-id'));
    const url = attribute(tag, 'data-url');
    if (!Number.isInteger(year) || year < 1998 || year > 2100 || !url) continue;

    const officialUrl = absoluteOfficialUrl(url);
    if (officialUrl) pages.set(year, { year, url: officialUrl });
  }

  if (pages.size === 0) {
    throw new Error(`ENEM_CATALOG_YEARS_NOT_FOUND:${catalogReference}`);
  }

  return [...pages.values()].sort((left, right) => right.year - left.year);
}

interface PendingArtifact {
  year: number;
  day: string;
  booklet: string;
  examUrl?: string;
  answerKeyUrl?: string;
}

export function parseOfficialYearArtifacts(
  year: number,
  html: string,
  sourceReference: string,
): { artifacts: EnemDiscoveredArtifact[]; issues: string[] } {
  const pending = new Map<string, PendingArtifact>();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const officialUrl = absoluteOfficialUrl(match[1]);
    if (!officialUrl) continue;

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(officialUrl).pathname);
    } catch {
      continue;
    }

    const fileName = pathname.split('/').pop() ?? '';
    const fileMatch = fileName.match(/^(\d{4})_(PV|GB)_impresso_(D\d+)_([A-Za-z0-9]+)\.pdf$/i);
    if (!fileMatch || Number(fileMatch[1]) !== year) continue;

    const kind = fileMatch[2].toUpperCase();
    const day = fileMatch[3].toUpperCase();
    const booklet = fileMatch[4].toUpperCase();
    const key = `${day}:${booklet}`;
    const current = pending.get(key) ?? { year, day, booklet };
    if (kind === 'PV') current.examUrl = officialUrl;
    else current.answerKeyUrl = officialUrl;
    pending.set(key, current);
  }

  const artifacts: EnemDiscoveredArtifact[] = [];
  const issues: string[] = [];
  for (const item of [...pending.values()].sort((left, right) =>
    `${left.day}:${left.booklet}`.localeCompare(`${right.day}:${right.booklet}`))) {
    const key = `${item.day}:${item.booklet}`;
    if (!item.examUrl || !item.answerKeyUrl) {
      issues.push(`UNPAIRED_ARTIFACT:${year}:${key}`);
      continue;
    }

    artifacts.push({
      year,
      exam: 'ENEM',
      application: 'REGULAR',
      day: item.day,
      booklet: item.booklet,
      sourceReference,
      examUrl: item.examUrl,
      answerKeyUrl: item.answerKeyUrl,
    });
  }

  return { artifacts, issues };
}

export async function discoverOfficialEnemCatalog(options: {
  catalogUrl?: string;
  years?: number[];
  fetchText?: FetchText;
  now?: Date;
} = {}): Promise<EnemDiscoveryResult> {
  const catalogUrl = options.catalogUrl ?? ENEM_OFFICIAL_CATALOG_URL;
  const sourceReference = assertOfficialEnemReference(catalogUrl);
  const fetchText = options.fetchText ?? (async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`ENEM_FETCH_FAILED:${response.status}:${url}`);
    return response.text();
  });
  const catalogHtml = await fetchText(sourceReference);
  const discoveredYears = parseOfficialYearPages(catalogHtml, sourceReference);
  const selectedYears = options.years?.length
    ? discoveredYears.filter((page) => options.years!.includes(page.year))
    : discoveredYears;
  const artifacts: EnemDiscoveredArtifact[] = [];
  const issues: string[] = [];

  for (const page of selectedYears) {
    const result = parseOfficialYearArtifacts(page.year, await fetchText(page.url), page.url);
    artifacts.push(...result.artifacts);
    issues.push(...result.issues);
  }

  return {
    schemaVersion: 1,
    catalogReference: sourceReference,
    discoveredAt: (options.now ?? new Date()).toISOString(),
    years: selectedYears,
    artifacts,
    issues,
  };
}

function argument(name: string, args: string[]): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const outputPath = argument('--out', args) ?? '.runtime/enem-discovery.json';
  const yearValue = argument('--year', args);
  const years = yearValue ? [Number(yearValue)] : undefined;
  if (years?.some((value) => !Number.isInteger(value))) throw new Error('ENEM_YEAR_INVALID');

  const output = await discoverOfficialEnemCatalog({ years });
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(
    `ENEM_DISCOVERY_OK years=${output.years.length} artifacts=${output.artifacts.length} issues=${output.issues.length} output=${resolvedOutput}`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
