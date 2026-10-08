import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export const OFFICIAL_ENEM_COVER_MANIFEST = [
  {
    year: 2025,
    day: 'D1',
    booklet: 'CD1',
    pdfUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D1_CD1.pdf',
    outputPath: 'public/assets/enem-covers/2025-d1-cd1.png',
  },
  {
    year: 2025,
    day: 'D2',
    booklet: 'CD5',
    pdfUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D2_CD5.pdf',
    outputPath: 'public/assets/enem-covers/2025-d2-cd5.png',
  },
  {
    year: 2024,
    day: 'D1',
    booklet: 'CD1',
    pdfUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D1_CD1.pdf',
    outputPath: 'public/assets/enem-covers/2024-d1-cd1.png',
  },
  {
    year: 2024,
    day: 'D2',
    booklet: 'CD5',
    pdfUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D2_CD5.pdf',
    outputPath: 'public/assets/enem-covers/2024-d2-cd5.png',
  },
] as const;

const force = process.argv.includes('--force');
const execFileAsync = promisify(execFile);

function assertPdf(data: Buffer, url: string) {
  if (data.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error(`A resposta de ${url} não é um PDF válido`);
  }
  return data;
}

async function downloadPdf(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/pdf',
          'user-agent': 'TecEscola ENEM cover generator',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return assertPdf(Buffer.from(await response.arrayBuffer()), url);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 1000));
      }
    }
  }
  try {
    const { stdout } = await execFileAsync(process.platform === 'win32' ? 'curl.exe' : 'curl', [
      '--fail',
      '--location',
      '--silent',
      '--show-error',
      '--retry',
      '2',
      '--retry-delay',
      '1',
      url,
    ], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
    const data = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    return assertPdf(data, url);
  } catch (fallbackError) {
    throw new Error(`Não foi possível baixar ${url}: ${String(lastError)}; fallback curl: ${String(fallbackError)}`);
  }
}

async function renderCover(pdfData: Buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfData),
    disableWorker: true,
    standardFontDataUrl: `${pathToFileURL(resolve('node_modules/pdfjs-dist/standard_fonts')).href}/`,
    wasmUrl: `${pathToFileURL(resolve('node_modules/pdfjs-dist/wasm')).href}/`,
  });
  const document = await loadingTask.promise;
  try {
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 0.35 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    page.cleanup();
    return canvas.toBuffer('image/png');
  } finally {
    await loadingTask.destroy();
  }
}

async function main() {
  for (const cover of OFFICIAL_ENEM_COVER_MANIFEST) {
    const destination = resolve(cover.outputPath);
    if (!force) {
      try {
        await import('node:fs/promises').then(({ access }) => access(destination));
        console.log(`mantida: ${cover.outputPath}`);
        continue;
      } catch {
        // A missing asset is generated below.
      }
    }
    console.log(`baixando e renderizando: ENEM ${cover.year} ${cover.day} ${cover.booklet}`);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, await renderCover(await downloadPdf(cover.pdfUrl)));
    console.log(`gerada: ${cover.outputPath}`);
  }
}

await main();
