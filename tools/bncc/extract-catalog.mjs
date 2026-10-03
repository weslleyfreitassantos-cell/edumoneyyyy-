import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = process.cwd();
const runtimeDir = path.resolve(root, process.argv[2] ?? '.runtime/bncc');
const outputPath = path.resolve(root, process.argv[3] ?? 'content/bncc/official/catalog-2018.json');

const SOURCES = [
  {
    id: 'BNCC_EI_EF_2018',
    file: 'bncc-ei-ef-2018.pdf',
    url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
    documentVersion: 'BNCC Educação Infantil e Ensino Fundamental, versão final 2018',
  },
  {
    id: 'BNCC_EM_2018',
    file: 'bncc-em-2018.pdf',
    url: 'https://basenacionalcomum.mec.gov.br/images/historico/BNCC_EnsinoMedio_embaixa_site_110518.pdf',
    documentVersion: 'BNCC Ensino Médio, versão homologada 2018',
  },
];

const CODE_PATTERN = /\b(?:EI\d{2}[A-Z]{2}\d{2}|EF(?:\d{2}|67)[A-Z]{2}\d{2}|EM13(?:LGG|CNT|CHS|MAT)\d{3}|EM13LP\d{2})\b/g;

function stableJson(value) {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
    return Object.keys(current).sort().reduce((result, key) => {
      result[key] = current[key];
      return result;
    }, {});
  });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function classify(code) {
  if (code.startsWith('EI')) {
    return {
      stage: 'EDUCACAO_INFANTIL',
      kind: 'LEARNING_DEVELOPMENT_OBJECTIVE',
      gradeOrRange: code.slice(2, 4),
      componentCode: code.slice(4, 6),
    };
  }
  if (code.startsWith('EF')) {
    const yearRange = code.slice(2, 4);
    return {
      stage: 'ENSINO_FUNDAMENTAL',
      kind: 'SKILL',
      gradeOrRange: yearRange,
      componentCode: code.slice(4, 6),
    };
  }
  const componentCode = code.slice(4, code.startsWith('EM13LP') ? 6 : 7);
  return {
    stage: 'ENSINO_MEDIO',
    kind: 'SKILL',
    gradeOrRange: '1-3',
    componentCode,
  };
}

function cleanExcerpt(value) {
  return value
    .replace(/--- PAGE \d+ ---/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

async function extractSource(source) {
  const inputPath = path.join(runtimeDir, source.file);
  if (!fs.existsSync(inputPath)) throw new Error(`Missing official source: ${inputPath}`);
  const buffer = fs.readFileSync(inputPath);
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const text = await (await document.getPage(pageNumber)).getTextContent();
    pages.push(`--- PAGE ${pageNumber} --- ${text.items.map((item) => item.str).join(' ')}`);
  }
  const fullText = pages.join('\n');
  const nodes = new Map();
  for (const match of fullText.matchAll(CODE_PATTERN)) {
    const code = match[0];
    if (nodes.has(code)) continue;
    const index = match.index ?? 0;
    const pageStart = fullText.lastIndexOf('--- PAGE ', index);
    const pageText = pageStart >= 0 ? fullText.slice(pageStart, index) : '';
    const pageMatch = pageText.match(/--- PAGE (\d+) ---/);
    const after = fullText.slice(index + code.length, index + code.length + 1200);
    nodes.set(code, {
      code,
      ...classify(code),
      officialTextExcerpt: cleanExcerpt(after),
      officialSource: {
        id: source.id,
        documentVersion: source.documentVersion,
        url: source.url,
        page: pageMatch ? Number(pageMatch[1]) : null,
      },
    });
  }
  return {
    source: {
      ...source,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      bytes: buffer.length,
      pages: document.numPages,
    },
    nodes: [...nodes.values()].sort((left, right) => left.code.localeCompare(right.code)),
  };
}

const extracted = [];
for (const source of SOURCES) extracted.push(await extractSource(source));
const sourceRank = {
  EDUCACAO_INFANTIL: 'BNCC_EI_EF_2018',
  ENSINO_FUNDAMENTAL: 'BNCC_EI_EF_2018',
  ENSINO_MEDIO: 'BNCC_EM_2018',
};
const nodesByCode = new Map();
for (const node of extracted.flatMap((item) => item.nodes)) {
  const previous = nodesByCode.get(node.code);
  if (!previous || node.officialSource.id === sourceRank[node.stage]) nodesByCode.set(node.code, node);
}
const nodes = [...nodesByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
const duplicateCodes = [...new Set(extracted.flatMap((item) => item.nodes.map((node) => node.code)))].filter(
  (code) => extracted.reduce((count, item) => count + item.nodes.filter((node) => node.code === code).length, 0) > 1,
);
const catalog = {
  schemaVersion: 'tec-escola.bncc.official-catalog.v1',
  catalogVersion: 'BNCC_2018_TEXT_EXTRACTION',
  sourceOfTruth: 'official_mec_bncc_pdf',
  extractionStatus: 'AUTOMATED_TEXT_EXTRACTION_REVIEW_REQUIRED',
  generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-03T00:00:00.000Z',
  sources: extracted.map((item) => item.source),
  nodes,
  coverage: {
    officialCodesDetected: nodes.length,
    duplicateOfficialCodes: [],
    sourceOverlapCodes: duplicateCodes,
    stages: [...new Set(nodes.map((node) => node.stage))].sort(),
    components: [...new Set(nodes.map((node) => node.componentCode))].sort(),
  },
};
const canonical = stableJson({ ...catalog, generatedAt: undefined });
catalog.catalogHash = sha256(canonical);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`BNCC_CATALOG_OUTPUT=${path.relative(root, outputPath)}`);
console.log(`BNCC_OFFICIAL_CODES=${nodes.length}`);
console.log(`BNCC_DUPLICATE_CODES=${duplicateCodes.length}`);
console.log(`BNCC_CATALOG_HASH=${catalog.catalogHash}`);
