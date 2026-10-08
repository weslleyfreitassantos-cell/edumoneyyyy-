import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildProviderTextV5ImportSql,
  buildProviderTextV5Report,
  PROVIDER_TEXT_V5_REVISION,
  type ProviderTextV5Report,
} from './provider-text-v5.ts';
import type { StructuredRecoverySource } from './semantic-completeness-v5.ts';
import type { EnemProviderQuestion } from './structured-text.ts';

export const PROVIDER_TEXT_V6_REVISION = 'structured-text-only-v6' as const;
export const PADARIA_PROVIDER_KEY = '2015:150:matematica:COMMON' as const;

const PADARIA_CONTEXT = `Uma padaria vende, em média, 100 pães especiais por dia e arrecada com essas vendas, em média, R$ 300,00. Constatou-se que a quantidade de pães especiais vendidos diariamente aumenta, caso o preço seja reduzido, de acordo com a equação

q = 400 – 100p,

na qual q representa a quantidade de pães especiais vendidos diariamente e p, o seu preço em reais.

A fim de aumentar o fluxo de clientes, o gerente da padaria decidiu fazer uma promoção. Para tanto, modificará o preço do pão especial de modo que a quantidade a ser vendida diariamente seja a maior possível, sem diminuir a média de arrecadação diária na venda desse produto.`;

const PADARIA_ALTERNATIVES = [
  { letter: 'A' as const, text: 'R$ 0,50 ≤ p < R$ 1,50', file: null },
  { letter: 'B' as const, text: 'R$ 1,50 ≤ p < R$ 2,50', file: null },
  { letter: 'C' as const, text: 'R$ 2,50 ≤ p < R$ 3,50', file: null },
  { letter: 'D' as const, text: 'R$ 3,50 ≤ p < R$ 4,50', file: null },
  { letter: 'E' as const, text: 'R$ 4,50 ≤ p < R$ 5,50', file: null },
];

export const PADARIA_RECOVERY_SOURCE: StructuredRecoverySource = {
  provider: 'tecescola-user-verified-reference',
  sourceUrl: 'urn:tecescola:enem:2015:150:blue-day-2:statement',
  question: {
    title: 'Questão 150 - ENEM 2015',
    index: 150,
    discipline: 'matematica',
    language: null,
    year: 2015,
    context: PADARIA_CONTEXT,
    files: [],
    correctAlternative: 'A',
    alternativesIntroduction: 'O preço p, em reais, do pão especial nessa promoção deverá estar no intervalo',
    alternatives: PADARIA_ALTERNATIVES,
  },
};

export type ProviderTextV6Report = Omit<
  ProviderTextV5Report,
  'schemaVersion' | 'contentRevision' | 'previousContentRevision'
> & {
  schemaVersion: 6;
  contentRevision: typeof PROVIDER_TEXT_V6_REVISION;
  previousContentRevision: typeof PROVIDER_TEXT_V5_REVISION;
};

export function buildProviderTextV6Report(
  providerQuestions: EnemProviderQuestion[],
  options: Parameters<typeof buildProviderTextV5Report>[1] = {},
): ProviderTextV6Report {
  const report = buildProviderTextV5Report(providerQuestions, {
    ...options,
    additionalSources: [PADARIA_RECOVERY_SOURCE, ...(options.additionalSources ?? [])],
  });
  return {
    ...report,
    schemaVersion: 6,
    contentRevision: PROVIDER_TEXT_V6_REVISION,
    previousContentRevision: PROVIDER_TEXT_V5_REVISION,
  };
}

export function buildProviderTextV6ImportSql(report: Pick<ProviderTextV6Report, 'records'>) {
  const v5Hex = Buffer.from(PROVIDER_TEXT_V5_REVISION, 'utf8').toString('hex');
  const v6Hex = Buffer.from(PROVIDER_TEXT_V6_REVISION, 'utf8').toString('hex');
  return buildProviderTextV5ImportSql(report).replaceAll(v5Hex, v6Hex);
}

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function loadCachedQuestions(cacheDir: string) {
  return readdirSync(cacheDir)
    .filter((file) => /^\d{4}\.json$/u.test(file))
    .sort()
    .flatMap((file) => {
      const payload = JSON.parse(readFileSync(resolve(cacheDir, file), 'utf8')) as { questions?: EnemProviderQuestion[] };
      return payload.questions ?? [];
    });
}

async function runCli() {
  const args = process.argv.slice(2);
  const cacheDir = resolve(argument('--cache', args) ?? '.runtime/enem-structured-text-v1/raw');
  const outputPath = resolve(argument('--out', args) ?? '.runtime/enem-structured-text-v6/provider-text-report.json');
  const sqlPath = argument('--sql', args) ? resolve(argument('--sql', args)!) : null;
  const rawQuestions = loadCachedQuestions(cacheDir);
  const report = buildProviderTextV6Report(rawQuestions);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (sqlPath) {
    mkdirSync(dirname(sqlPath), { recursive: true });
    writeFileSync(sqlPath, buildProviderTextV6ImportSql(report), 'utf8');
  }
  console.log(`ENEM_PROVIDER_TEXT_V6_OK raw=${report.providerQuestionsRaw} unique=${report.providerQuestions} accepted=${report.accepted} rejected=${report.rejected} recovered=${report.recovered} output=${outputPath}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
