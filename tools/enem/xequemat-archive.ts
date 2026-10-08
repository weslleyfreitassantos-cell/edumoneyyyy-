import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { parse as parseHtml, serialize as serializeHtml } from 'parse5';

export const XEQUEMAT_PROVIDER = 'xequemat' as const;
export const XEQUEMAT_CONTENT_REVISION = 'xequemat-archive-v1' as const;

export type XequematApplication = 'REGULAR' | 'PPL';
export type XequematArea = 'LINGUAGENS' | 'CIENCIAS_HUMANAS' | 'CIENCIAS_NATUREZA' | 'MATEMATICA' | 'UNKNOWN';
export type XequematBlockKind = 'PARAGRAPH' | 'IMAGE' | 'TABLE' | 'FORMULA' | 'LIST' | 'QUOTE';

export interface XequematMediaReference {
  source: string;
  alt: string;
  archivePath: string | null;
  canonicalPath: string | null;
  missing: boolean;
}

export interface XequematContentBlock {
  kind: XequematBlockKind;
  text?: string;
  html?: string;
  ordered?: boolean;
  items?: string[];
  media?: XequematMediaReference[];
}

export interface XequematAlternative {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  blocks: XequematContentBlock[];
  media: XequematMediaReference[];
}

export type XequematRejectionReason =
  | 'INCOMPLETE_STATEMENT'
  | 'MISSING_ALTERNATIVE'
  | 'INVALID_ALTERNATIVE_ORDER'
  | 'MISSING_ANSWER'
  | 'INVALID_ANSWER'
  | 'MISSING_ESSENTIAL_MEDIA'
  | 'QUESTION_CONTENT_NOT_FOUND'
  | 'INVALID_SOURCE_IDENTITY'
  | 'AMBIGUOUS_DUPLICATE'
  | 'RIGHTS_UNRESOLVED';

export interface XequematArchiveQuestion {
  provider: typeof XEQUEMAT_PROVIDER;
  contentRevision: typeof XEQUEMAT_CONTENT_REVISION;
  providerQuestionKey: string;
  sourceFile: string;
  sourceUrl: string;
  title: string;
  year: number;
  questionNumber: number;
  application: XequematApplication;
  area: XequematArea;
  subject: string | null;
  language: 'ENGLISH' | 'SPANISH' | null;
  day: number | null;
  blocks: XequematContentBlock[];
  contextText: string;
  promptText: string;
  alternatives: XequematAlternative[];
  correctAlternative: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  explanationText: string | null;
  media: XequematMediaReference[];
  normalizedContentHash: string;
  sourceHash: string;
  completeStatement: boolean;
  completeAlternatives: boolean;
  answerPresent: boolean;
  requiredMediaPresent: boolean;
  rightsStatus: 'UNRESOLVED' | 'REVIEW_REQUIRED' | 'VERIFIED';
  ready: boolean;
  rejectionReasons: XequematRejectionReason[];
}

export interface XequematArchiveReport {
  schemaVersion: 1;
  provider: typeof XEQUEMAT_PROVIDER;
  contentRevision: typeof XEQUEMAT_CONTENT_REVISION;
  source: { input: string; extractedRoot: string | null };
  rightsStatus: 'UNRESOLVED' | 'REVIEW_REQUIRED' | 'VERIFIED';
  scannedFiles: number;
  parsedQuestions: number;
  uniqueQuestions: number;
  duplicateQuestions: number;
  readyQuestions: number;
  rejectedQuestions: number;
  missingMediaReferences: number;
  missingMediaQuestions: number;
  byApplication: Record<string, number>;
  byYear: Record<string, number>;
  rejectionReasons: Record<string, number>;
  records: XequematArchiveQuestion[];
}

type MediaResolver = (source: string) => XequematMediaReference;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const CONTENT_CLASS = '.elementor-widget-theme-post-content';
const ANSWER_RE = /(?:alternativa\s+(?:correta\s+(?:[ée]\s*)?|é\s*)?|gabarito\s*[:\-]?\s*)([A-E])\b/iu;
const SOLUTION_RE = /^(?:solu[cç][aã]o|resolu[cç][aã]o|gabarito|coment[aá]rio)\b/iu;
const RELATED_RE = /^(?:pratique|quest[oõ]es? semelhantes|veja tamb[eé]m|conte[uú]do relacionado)\b/iu;
const OPTION_RE = /^\s*([A-E])\s*[\)\.:\-]\s*/iu;
const ANAPHORIC_RE = /\b(?:essa|esse|isso|dessa|desse|nisso|nesse|a partir disso|com base nisso|de acordo com isso)\b/iu;

function normalizeText(value: string) {
  return value.normalize('NFKC').replace(/\u00a0/gu, ' ').replace(/[ \t]+/gu, ' ').replace(/\s*\n\s*/gu, '\n').trim();
}

function normalizeHash(value: string) {
  return normalizeText(value).toLocaleLowerCase('pt-BR').replace(/\s+/gu, ' ');
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function attr(element: any, name: string) {
  return element?.getAttribute?.(name) ?? '';
}

function imageSources(element: any): string[] {
  const values = [attr(element, 'data-src'), attr(element, 'data-lazy-src'), attr(element, 'src')];
  const sourceSet = attr(element, 'data-srcset') || attr(element, 'srcset');
  if (sourceSet) values.push(sourceSet.split(',')[0]?.trim().split(/\s+/u)[0] ?? '');
  return [...new Set(values.filter((value) => value && !/^data:/iu.test(value) && !/-\d{2,4}x\d{2,4}(?=\.[a-z0-9]+(?:\?|$))/iu.test(value)))];
}

function textWithoutImages(element: any) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll?.('img, picture, svg').forEach((node: any) => node.remove());
  return normalizeText(clone.textContent ?? '');
}

function sourceUrl(source: string, baseUrl: string) {
  try {
    return new URL(source, baseUrl).toString();
  } catch {
    return source;
  }
}

function blockFromElement(element: any, resolveMedia: MediaResolver, baseUrl: string): XequematContentBlock[] {
  const tag = String(element.tagName ?? '').toLowerCase();
  const media = [...element.querySelectorAll?.('img, picture source') ?? []]
    .flatMap((node: any) => imageSources(node))
    .map((source) => resolveMedia(sourceUrl(source, baseUrl)));
  const text = textWithoutImages(element);
  if (tag === 'figure' || tag === 'img' || (media.length > 0 && !text)) {
    return [{ kind: 'IMAGE', media }];
  }
  if (tag === 'table' || element.querySelector?.('table')) {
    return [{ kind: 'TABLE', html: element.outerHTML, text, media }];
  }
  if (tag === 'blockquote') {
    return [{ kind: 'QUOTE', text, media }];
  }
  if (tag === 'ul' || tag === 'ol') {
    return [{ kind: 'LIST', ordered: tag === 'ol', items: [...element.querySelectorAll('li')].map((item: any) => textWithoutImages(item)).filter(Boolean), media }];
  }
  if (text || media.length > 0) {
    return [{ kind: 'PARAGRAPH', text, media }];
  }
  return [];
}

function inferMetadata(root: any, sourceFile: string, title: string, pageClass = '') {
  const relativePath = sourceFile.replaceAll('\\', '/');
  const slug = relativePath.match(/questao-(\d{1,3})-enem(?:-ppl)?-(\d{4})/iu);
  const titleMatch = title.match(/quest[aã]o\s+(\d{1,3}).*?enem(?:\s+ppl)?\s+(\d{4})/iu);
  const questionNumber = Number(slug?.[1] ?? titleMatch?.[1] ?? 0);
  const year = Number(slug?.[2] ?? titleMatch?.[2] ?? 0);
  const application: XequematApplication = /enem-ppl/iu.test(relativePath) ? 'PPL' : 'REGULAR';
  const className = `${String(root?.closest?.('[data-elementor-type]')?.className ?? '')} ${pageClass}`.toLocaleLowerCase('pt-BR');
  const area: XequematArea = className.includes('matematica')
    ? 'MATEMATICA'
    : className.includes('ciencias-natureza')
      ? 'CIENCIAS_NATUREZA'
      : className.includes('ciencias-humanas')
        ? 'CIENCIAS_HUMANAS'
        : className.includes('linguagens')
          ? 'LINGUAGENS'
          : 'UNKNOWN';
  const language: 'ENGLISH' | 'SPANISH' | null = className.includes('ingles') || className.includes('inglês')
    ? 'ENGLISH'
    : className.includes('espanhol')
      ? 'SPANISH'
      : null;
  const subjectMatch = className.match(/assunto-([a-z0-9-]+)/iu);
  return {
    questionNumber,
    year,
    application,
    area,
    language,
    subject: subjectMatch?.[1] ?? null,
  };
}

function findQuestionContent(node: any): any | null {
  const className = node.attrs?.find((item: any) => item.name === 'class')?.value ?? '';
  if (className.split(/\s+/u).includes('elementor-widget-theme-post-content')) return node;
  for (const child of node.childNodes ?? []) {
    const found = findQuestionContent(child);
    if (found) return found;
  }
  return null;
}

function extractQuestionFragment(html: string) {
  const document = parseHtml(html);
  const content = findQuestionContent(document);
  return content ? `<div class="elementor-widget-theme-post-content">${serializeHtml(content)}</div>` : null;
}

function pageTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? '';
  return normalizeText(title.replace(/<[^>]+>/gu, '').replace(/&nbsp;/giu, ' ')).replace(/\s*[-–—]\s*(?:gabarito|resolu[cç][aã]o).*$/iu, '');
}

function mediaFromBlocks(blocks: XequematContentBlock[]) {
  const unique = new Map<string, XequematMediaReference>();
  for (const media of blocks.flatMap((block) => block.media ?? [])) {
    const key = media.archivePath ?? mediaSourceIdentity(media);
    if (!unique.has(key)) unique.set(key, media);
  }
  return [...unique.values()];
}

function mediaSourceIdentity(media: XequematMediaReference) {
  let value = media.source;
  try { value = new URL(value).pathname; } catch { /* local or malformed source */ }
  return normalizedArchivePath(value)
    .replace(/^blog\/wp-content\/webp-express\/webp-images\//u, 'blog/wp-content/')
    .replace(/\.webp$/iu, '');
}

function uniqueReasons(reasons: XequematRejectionReason[]) {
  return [...new Set(reasons)];
}

export function parseXequematQuestionHtml(
  html: string,
  options: { sourceFile: string; sourceUrl?: string; resolveMedia?: MediaResolver; rightsStatus?: XequematArchiveQuestion['rightsStatus'] },
): XequematArchiveQuestion {
  const fragment = extractQuestionFragment(html);
  const document = JSDOM.fragment(fragment ?? '');
  const content = document.querySelector(CONTENT_CLASS);
  const title = pageTitle(html) || normalizeText(document.querySelector('h1')?.textContent ?? '');
  const pageClass = html.match(/<div[^>]+class=["']([^"']*area-do-conhecimento[^"']*)["'][^>]*data-elementor-type/iu)?.[1]
    ?? html.match(/<div[^>]+data-elementor-type=["'][^"']+["'][^>]+class=["']([^"']*area-do-conhecimento[^"']*)["']/iu)?.[1]
    ?? '';
  const metadata = inferMetadata(content, options.sourceFile, title, pageClass);
  const inferredSourceUrl = options.sourceUrl ?? (() => {
    const normalizedPath = options.sourceFile.replaceAll('\\', '/');
    const marker = normalizedPath.indexOf('blog/questao-');
    return marker >= 0
      ? `https://xequematenem.com.br/${normalizedPath.slice(marker).replace(/index\.html$/iu, '')}`
      : `https://xequematenem.com.br/blog/${basename(options.sourceFile, extname(options.sourceFile))}/`;
  })();
  const baseUrl = inferredSourceUrl;
  const resolveMedia = options.resolveMedia ?? ((source: string): XequematMediaReference => ({ source, alt: '', archivePath: null, canonicalPath: null, missing: false }));
  const rejectionReasons: XequematRejectionReason[] = [];
  if (!content) rejectionReasons.push('QUESTION_CONTENT_NOT_FOUND');
  if (metadata.year < 2009 || metadata.year > 2025 || metadata.questionNumber < 1) {
    rejectionReasons.push('INVALID_SOURCE_IDENTITY');
  }

  const children = content ? [...content.children] : [];
  const blocks: XequematContentBlock[] = [];
  const alternatives: XequematAlternative[] = [];
  let alternativeStarted = false;
  let explanationText: string | null = null;
  let solutionStarted = false;
  const solutionParts: string[] = [];
  for (const child of children) {
    const directText = textWithoutImages(child);
    if (SOLUTION_RE.test(directText)) {
      solutionStarted = true;
      solutionParts.push(directText);
      continue;
    }
    if (solutionStarted) {
      if (RELATED_RE.test(directText)) break;
      solutionParts.push(directText);
      continue;
    }
    const optionMatch = directText.match(OPTION_RE);
    if (optionMatch) {
      alternativeStarted = true;
      const letter = optionMatch[1].toUpperCase() as XequematAlternative['letter'];
      const text = normalizeText(directText.replace(OPTION_RE, ''));
      const optionBlocks = blockFromElement(child, resolveMedia, baseUrl);
      const media = mediaFromBlocks(optionBlocks);
      alternatives.push({ letter, text, blocks: optionBlocks, media });
      continue;
    }
    if (!alternativeStarted) blocks.push(...blockFromElement(child, resolveMedia, baseUrl));
  }
  explanationText = solutionParts.length ? normalizeText(solutionParts.join('\n\n')) : null;

  const paragraphBlocks = blocks.filter((block) => block.kind === 'PARAGRAPH' && block.text);
  const promptBlock = paragraphBlocks.at(-1);
  const contextBlocks = promptBlock ? blocks.slice(0, blocks.lastIndexOf(promptBlock)) : blocks;
  const contextText = contextBlocks.map((block) => block.text ?? '').filter(Boolean).join('\n\n').trim();
  const promptText = promptBlock?.text ?? '';
  const allMedia = mediaFromBlocks([...blocks, ...alternatives.flatMap((item) => item.blocks)]);
  const correctMatch = explanationText?.match(ANSWER_RE) ?? directAnswer(content);
  const correctAlternative = correctMatch?.[1]?.toUpperCase() as XequematArchiveQuestion['correctAlternative'] ?? null;
  const completeAlternatives = alternatives.length === 5
    && alternatives.every((item, index) => item.letter === String.fromCharCode(65 + index) && (Boolean(item.text) || item.media.length > 0));
  const completeStatement = Boolean(promptText)
    && promptText.length >= 12
    && (!ANAPHORIC_RE.test(promptText) || contextText.length >= 40 || promptText.length >= 160);
  const requiredMediaPresent = allMedia.every((media) => !media.missing);
  if (!completeStatement) rejectionReasons.push('INCOMPLETE_STATEMENT');
  if (alternatives.length !== 5) rejectionReasons.push('MISSING_ALTERNATIVE');
  if (!completeAlternatives && alternatives.length === 5) rejectionReasons.push('INVALID_ALTERNATIVE_ORDER');
  if (!correctAlternative) rejectionReasons.push('MISSING_ANSWER');
  if (correctAlternative && !/^[A-E]$/u.test(correctAlternative)) rejectionReasons.push('INVALID_ANSWER');
  if (!requiredMediaPresent) rejectionReasons.push('MISSING_ESSENTIAL_MEDIA');
  const rightsStatus = options.rightsStatus ?? 'UNRESOLVED';
  if (rightsStatus !== 'VERIFIED') rejectionReasons.push('RIGHTS_UNRESOLVED');
  const normalizedContentHash = hash(normalizeHash(`${metadata.application}:${metadata.year}:${metadata.questionNumber}:${contextText}\n${promptText}\n${alternatives.map((item) => `${item.letter}:${item.text}`).join('\n')}`));
  const record: XequematArchiveQuestion = {
    provider: XEQUEMAT_PROVIDER,
    contentRevision: XEQUEMAT_CONTENT_REVISION,
    providerQuestionKey: `${metadata.application}:${metadata.year}:${metadata.questionNumber}:${metadata.language ?? 'COMMON'}:${normalizedContentHash.slice(0, 12)}`,
    sourceFile: options.sourceFile,
    sourceUrl: inferredSourceUrl,
    title,
    year: metadata.year,
    questionNumber: metadata.questionNumber,
    application: metadata.application,
    area: metadata.area,
    subject: metadata.subject,
    language: metadata.language,
    day: null,
    blocks,
    contextText,
    promptText,
    alternatives,
    correctAlternative,
    explanationText,
    media: allMedia,
    normalizedContentHash,
    sourceHash: hash(html),
    completeStatement,
    completeAlternatives,
    answerPresent: Boolean(correctAlternative),
    requiredMediaPresent,
    rightsStatus,
    ready: rejectionReasons.length === 0,
    rejectionReasons: uniqueReasons(rejectionReasons),
  };
  return record;
}

function directAnswer(content: any) {
  if (!content) return null;
  const text = normalizeText(content.textContent ?? '');
  return text.match(ANSWER_RE);
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const info = statSync(fullPath);
    if (info.isDirectory()) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function normalizedArchivePath(value: string) {
  return value.replaceAll('\\', '/').replace(/^\/+/, '').toLocaleLowerCase('en-US');
}

export function createArchiveMediaResolver(root: string) {
  const files = walkFiles(root).filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLocaleLowerCase('en-US')));
  const byPath = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const file of files) {
    const rel = normalizedArchivePath(relative(root, file));
    byPath.set(rel, file);
    const name = basename(rel);
    byName.set(name, [...(byName.get(name) ?? []), file]);
  }
  return (source: string): XequematMediaReference => {
    let pathName = source;
    try { pathName = new URL(source).pathname; } catch { /* local archive path */ }
    const normalized = normalizedArchivePath(pathName);
    const withoutBlog = normalized.replace(/^blog\//u, '');
    const withDomain = normalized.startsWith('xequematenem.com.br/')
      ? normalized
      : `xequematenem.com.br/${normalized}`;
    const sourceCandidates = [
      normalized,
      withDomain,
      `xequematenem.com.br/blog/${withoutBlog}`,
      `blog/${withoutBlog}`,
    ];
    const candidates = [...sourceCandidates];
    if (withoutBlog.startsWith('wp-content/uploads/')) {
      const webpPath = withoutBlog.replace(
        /^wp-content\/uploads\//u,
        'wp-content/webp-express/webp-images/uploads/',
      );
      candidates.push(
        `xequematenem.com.br/blog/${webpPath}`,
        `blog/${webpPath}`,
        webpPath,
      );
      if (!webpPath.endsWith('.webp')) {
        candidates.push(
          `xequematenem.com.br/blog/${webpPath}.webp`,
          `blog/${webpPath}.webp`,
          `${webpPath}.webp`,
        );
      }
    }
    let archiveFile = candidates.map((candidate) => byPath.get(candidate)).find(Boolean) ?? null;
    if (!archiveFile) {
      const fileName = basename(withoutBlog);
      const matches = byName.get(fileName) ?? [];
      archiveFile = matches.length === 1 ? matches[0] : null;
      if (!archiveFile && !fileName.endsWith('.webp')) {
        const webpMatches = byName.get(`${fileName}.webp`) ?? [];
        archiveFile = webpMatches.length === 1 ? webpMatches[0] : null;
      }
    }
    const archivePath = archiveFile ? relative(root, archiveFile).replaceAll(sep, '/') : null;
    const canonicalPath = archiveFile ? `enem/${XEQUEMAT_CONTENT_REVISION}/${hash(normalized)}-${basename(archiveFile)}` : null;
    return { source, alt: '', archivePath, canonicalPath, missing: !archiveFile };
  };
}

function extractZip(input: string) {
  const target = mkdtempSync(join(tmpdir(), 'tec-escola-xequemat-'));
  execFileSync('tar', ['-xf', input, '-C', target], { stdio: 'ignore' });
  return target;
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function buildXequematArchiveReport(input: string, rightsStatus: XequematArchiveQuestion['rightsStatus'] = 'UNRESOLVED'): XequematArchiveReport {
  const extractedRoot = existsSync(input) && statSync(input).isDirectory() ? resolve(input) : extractZip(resolve(input));
  const htmlFiles = walkFiles(extractedRoot).filter((file) => /(?:^|[\\/])questao-[^\\/]+[\\/]index\.html$/iu.test(file));
  const resolver = createArchiveMediaResolver(extractedRoot);
  const parsed = htmlFiles.map((file) => parseXequematQuestionHtml(readFileSync(file, 'utf8'), {
    sourceFile: relative(extractedRoot, file).replaceAll(sep, '/'),
    resolveMedia: resolver,
    rightsStatus,
  }));
  const unique = new Map<string, XequematArchiveQuestion>();
  let duplicateQuestions = 0;
  for (const record of parsed) {
    const key = `${record.application}:${record.year}:${record.questionNumber}:${record.language ?? 'COMMON'}:${record.normalizedContentHash}`;
    if (unique.has(key)) { duplicateQuestions += 1; continue; }
    unique.set(key, record);
  }
  const records = [...unique.values()];
  const rejectionReasons: Record<string, number> = {};
  for (const record of records) for (const reason of record.rejectionReasons) rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
  return {
    schemaVersion: 1,
    provider: XEQUEMAT_PROVIDER,
    contentRevision: XEQUEMAT_CONTENT_REVISION,
    source: { input: resolve(input), extractedRoot: existsSync(input) && statSync(input).isDirectory() ? extractedRoot : null },
    rightsStatus,
    scannedFiles: htmlFiles.length,
    parsedQuestions: parsed.length,
    uniqueQuestions: records.length,
    duplicateQuestions,
    readyQuestions: records.filter((record) => record.ready).length,
    rejectedQuestions: records.filter((record) => !record.ready).length,
    missingMediaReferences: records.flatMap((record) => record.media).filter((media) => media.missing).length,
    missingMediaQuestions: records.filter((record) => record.rejectionReasons.includes('MISSING_ESSENTIAL_MEDIA')).length,
    byApplication: Object.fromEntries([...records.reduce((map, record) => map.set(record.application, (map.get(record.application) ?? 0) + 1), new Map<string, number>())]),
    byYear: Object.fromEntries([...records.reduce((map, record) => map.set(String(record.year), (map.get(String(record.year)) ?? 0) + 1), new Map<string, number>())]),
    rejectionReasons,
    records,
  };
}

function main() {
  const args = process.argv.slice(2);
  const input = argument('--input', args) ?? 'C:/Users/samue/Downloads/xequematenem.com.br.zip';
  const output = resolve(argument('--out', args) ?? '.runtime/enem-xequemat-archive-v1/report.json');
  const rightsStatus = (argument('--rights-status', args) ?? 'UNRESOLVED') as XequematArchiveQuestion['rightsStatus'];
  if (!['UNRESOLVED', 'REVIEW_REQUIRED', 'VERIFIED'].includes(rightsStatus)) throw new Error(`Invalid --rights-status: ${rightsStatus}`);
  const report = buildXequematArchiveReport(input, rightsStatus);
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, scannedFiles: report.scannedFiles, uniqueQuestions: report.uniqueQuestions, readyQuestions: report.readyQuestions, rejectedQuestions: report.rejectedQuestions, missingMediaReferences: report.missingMediaReferences, rightsStatus: report.rightsStatus }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
