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
  application: 'REGULAR' | 'PPL';
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
  application: 'REGULAR' | 'PPL';
  day: string;
  booklet: string;
  examUrl?: string;
  answerKeyUrl?: string;
}

interface ParsedOfficialLink {
  kind: 'PV' | 'GB' | 'BOTH' | 'GB_DAY_BUNDLE';
  application: 'REGULAR' | 'PPL';
  day: string | null;
  booklet: string | null;
  url: string;
}

function bookletCode(value: string | number) {
  return `CD${Number(value)}`;
}

function dayForBooklet(booklet: string) {
  const number = Number(booklet.replace(/^CD/iu, ''));
  if (!Number.isInteger(number)) return null;
  if ((number >= 1 && number <= 4) || (number >= 9 && number <= 12)) return 'D1';
  if ((number >= 5 && number <= 8) || (number >= 13 && number <= 16)) return 'D2';
  return null;
}

function bookletForColor(day: string, color: string, application: 'REGULAR' | 'PPL' = 'REGULAR') {
  const normalizedColor = color.toUpperCase();
  if (application === 'PPL') {
    const pplMap: Record<string, string> = {
      'D1:AZUL': 'CD13',
      'D1:AMARELO': 'CD14',
      'D1:BRANCO': 'CD15',
      'D1:ROSA': 'CD16',
      'D2:AMARELO': 'CD17',
      'D2:CINZA': 'CD18',
      'D2:AZUL': 'CD19',
      'D2:ROSA': 'CD20',
    };
    return pplMap[`${day}:${normalizedColor}`] ?? null;
  }
  const map: Record<string, string> = {
    AZUL: day === 'D1' ? 'CD1' : 'CD7',
    AMARELO: day === 'D1' ? 'CD2' : 'CD5',
    BRANCO: day === 'D1' ? 'CD3' : 'CD6',
    CINZA: 'CD6',
    ROSA: day === 'D1' ? 'CD4' : 'CD8',
    LARANJA: day === 'D1' ? 'CD9' : 'CD11',
    LARANJA_LEDOR: day === 'D1' ? 'CD9' : 'CD11',
    VERDE: day === 'D1' ? 'CD4' : 'CD8',
    VERDE_LIBRAS: day === 'D1' ? 'CD10' : 'CD12',
  };
  return map[normalizedColor] ?? null;
}

function isSpecialVariant(fileName: string) {
  if (/(?:gab|gabarito)/iu.test(fileName)) return false;
  return /(?:_ledor|_ampliada|_superampliada|_libras|_nvda|_dosvox)(?:\.|_)/iu.test(fileName);
}

function parseOfficialLink(year: number, officialUrl: string): ParsedOfficialLink | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(officialUrl).pathname);
  } catch {
    return null;
  }

  const fileName = pathname.split('/').pop() ?? '';
  if (isSpecialVariant(fileName)) return null;
  const isSecondApplicationRegular = /(?:^|_)P2_.*_REG(?:_|\.pdf$)/iu.test(fileName);
  if (isSecondApplicationRegular || (/_2\.pdf$/iu.test(fileName) && !/ppl/iu.test(pathname))) return null;
  const application: ParsedOfficialLink['application'] = /(?:ppl|2a_aplica[cç][aã]o|reaplica[cç][aã]o_ppl|(?:^|\/)P2_|_P2_)/iu.test(`${pathname}/${fileName}`)
    ? 'PPL'
    : 'REGULAR';

  const modernBooklet = fileName.match(/(?:^|_)D(\d+)_CD(\d+)(?:_|\.pdf$)/iu);
  const legacyBooklet = fileName.match(/^dia(\d+)_caderno(\d+)(?:_|\.pdf$)/iu);
  const cadExam = fileName.match(/^cad_(\d+)_prova_.*\.pdf$/iu);
  const colorExam = fileName.match(/^([12])DIA_(\d{1,2})_.*\.pdf$/iu);
  const pplExam = !isSecondApplicationRegular ? fileName.match(/^P2_(\d{1,2})_.*\.pdf$/iu) : null;
  const day = modernBooklet?.[1] ?? legacyBooklet?.[1] ?? colorExam?.[1] ?? null;
  const booklet = modernBooklet?.[2]
    ? bookletCode(modernBooklet[2])
    : legacyBooklet?.[2]
      ? bookletCode(legacyBooklet[2])
      : colorExam?.[2]
        ? bookletCode(colorExam[2])
      : cadExam?.[1]
        ? bookletCode(cadExam[1])
        : pplExam?.[1]
          ? bookletCode(pplExam[1])
          : null;
  const isExam = /(?:^|_)PV(?:_|\.pdf$)/iu.test(fileName) || Boolean(legacyBooklet || colorExam || cadExam || pplExam);
  const resolvedDay = day ?? (booklet ? dayForBooklet(booklet) : null);
  if (isExam && resolvedDay && booklet) {
    return {
      kind: /_com_gab(?:\.pdf)?$/iu.test(fileName) ? 'BOTH' : 'PV',
      application,
      day: resolvedDay.startsWith('D') ? resolvedDay : `D${Number(resolvedDay)}`,
      booklet,
      url: officialUrl,
    };
  }

  const modernAnswer = fileName.match(/^(\d{4})_GB(?:_impresso|_reaplicacao_PPL)_D(\d+)_CD(\d+)\.pdf$/iu);
  const legacy2019Answer = fileName.match(/^gabarito_(\d+)_dia_caderno_(\d+)_.*_aplica[cç][aã]o_regular\.pdf$/iu);
  const legacy2017Answer = fileName.match(/^cad_(\d+)_gabarito_.*\.pdf$/iu);
  const legacy2018Answer = fileName.match(/^GAB_ENEM_2018_DIA_(\d+)_(?:P2_)?(AZUL|AMARELO|BRANCO|CINZA|ROSA|LARANJA_LEDOR|VERDE_LIBRAS)\.pdf$/iu);
  const legacy2017PplAnswer = fileName.match(/^GAB_ENEM_\d{4}_2_APL_DIA_(\d+)_.*_cad[-_](\d+)\.pdf$/iu);
  const dayBundleAnswer = fileName.match(/^gabarito_dia(\d+)\.pdf$/iu);
  const numberedGabarito = fileName.match(/^GAB_ENEM_?(\d{4})_DIA_(\d+)_(\d{1,2})_[A-Z0-9_]+\.pdf$/iu);
  const cadernoAnswer = fileName.match(/(?:^|_)CADERNO_(?:[A-Z]+_)?(\d+)(?:_|\.pdf$)/iu);
  const numberedAnswer = fileName.match(/^(\d{1,2})_[A-Z_]+_GABARITO\.pdf$/iu);
  const dayColorAnswer = fileName.match(/^DIA(\d+)_(AZUL|AMARELO|BRANCO|CINZA|ROSA|LARANJA_LEDOR|VERDE_LIBRAS)\.pdf$/iu);
  const isAnswer = Boolean(modernAnswer || legacy2019Answer || legacy2017Answer || legacy2018Answer || legacy2017PplAnswer || dayBundleAnswer || numberedGabarito || cadernoAnswer || numberedAnswer || dayColorAnswer);
  if (!isAnswer) return null;

  const parsedDay = modernAnswer?.[2]
    ?? legacy2019Answer?.[1]
    ?? numberedGabarito?.[2]
    ?? legacy2018Answer?.[1]
    ?? legacy2017PplAnswer?.[1]
    ?? dayBundleAnswer?.[1]
    ?? dayColorAnswer?.[1]
    ?? null;
  const parsedBooklet = modernAnswer?.[3]
    ?? legacy2019Answer?.[2]
    ?? legacy2017Answer?.[1]
    ?? numberedGabarito?.[3]
    ?? legacy2017PplAnswer?.[2]
    ?? cadernoAnswer?.[1]
    ?? numberedAnswer?.[1]
    ?? null;
  const resolvedBooklet = parsedBooklet
    ? bookletCode(parsedBooklet)
    : parsedDay && (legacy2018Answer?.[2] ?? dayColorAnswer?.[2])
      ? bookletForColor(`D${Number(parsedDay)}`, legacy2018Answer?.[2] ?? dayColorAnswer![2], application)
      : null;
  return {
    kind: dayBundleAnswer ? 'GB_DAY_BUNDLE' : 'GB',
    application,
    // A caderno-only key can belong to D2 even when its numeric code is also
    // used by a D1 accessibility variant; let the pending exam disambiguate it.
    day: parsedDay ? `D${Number(parsedDay)}` : null,
    booklet: resolvedBooklet,
    url: officialUrl,
  };
}

export function parseOfficialYearArtifacts(
  year: number,
  html: string,
  sourceReference: string,
): { artifacts: EnemDiscoveredArtifact[]; issues: string[] } {
  const pending = new Map<string, PendingArtifact>();
  const dayBundleAnswerKeys = new Map<string, string>();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const officialUrl = absoluteOfficialUrl(match[1]);
    if (!officialUrl) continue;
    const parsed = parseOfficialLink(year, officialUrl);
    if (!parsed) continue;

    if (parsed.kind === 'GB_DAY_BUNDLE' && parsed.day) {
      dayBundleAnswerKeys.set(`${parsed.application}:${parsed.day}`, parsed.url);
      continue;
    }

    let current: PendingArtifact | undefined;
    if (parsed.day && parsed.booklet) {
      const key = `${parsed.application}:${parsed.day}:${parsed.booklet}`;
      current = pending.get(key) ?? { year, application: parsed.application, day: parsed.day, booklet: parsed.booklet };
      pending.set(key, current);
    } else if (parsed.kind === 'GB' && parsed.booklet) {
      const candidates = [...pending.entries()].filter(([, item]) => item.application === parsed.application && item.booklet === parsed.booklet);
      if (candidates.length === 1) current = candidates[0][1];
      else continue;
    } else {
      continue;
    }

    if (parsed.kind === 'PV' || parsed.kind === 'BOTH') current.examUrl = parsed.url;
    if (parsed.kind === 'GB' || parsed.kind === 'BOTH') current.answerKeyUrl = parsed.url;
  }

  // Older INEP pages publish one regular answer-key PDF for all four booklets of a day.
  // Apply it only to the standard booklet range; PPL and accessibility variants remain separate.
  for (const item of pending.values()) {
    if (item.answerKeyUrl) continue;
    const bundleUrl = dayBundleAnswerKeys.get(`${item.application}:${item.day}`);
    const bookletNumber = Number(item.booklet.replace(/^CD/iu, ''));
    const isStandardBooklet = item.application === 'REGULAR'
      && ((item.day === 'D1' && bookletNumber >= 1 && bookletNumber <= 4)
        || (item.day === 'D2' && bookletNumber >= 5 && bookletNumber <= 8));
    if (bundleUrl && isStandardBooklet) item.answerKeyUrl = bundleUrl;
  }

  const artifacts: EnemDiscoveredArtifact[] = [];
  const issues: string[] = [];
  for (const item of [...pending.values()].sort((left, right) =>
    `${left.application}:${left.day}:${left.booklet}`.localeCompare(`${right.application}:${right.day}:${right.booklet}`))) {
    const key = `${item.application}:${item.day}:${item.booklet}`;
    if (!item.examUrl || !item.answerKeyUrl) {
      issues.push(`UNPAIRED_ARTIFACT:${year}:${key}`);
      continue;
    }

    artifacts.push({
      year,
      exam: 'ENEM',
      application: item.application,
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
