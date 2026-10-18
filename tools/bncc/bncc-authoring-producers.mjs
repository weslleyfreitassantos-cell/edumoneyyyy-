import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAuthoredCurriculumPack,
  discoverAuthoredCurriculumSpecs,
  validateAuthoredCurriculumPack,
  validateStoredCurriculumPack,
} from './curriculum-authoring-registry-v1.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT_DIR = 'content/adaptive/tec-escola-core-v5';
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

let sourceByCode;
function getSourceByCode() {
  sourceByCode ??= new Map((readJson(SOURCE_PATH).records ?? []).map((record) => [record.officialCode, record]));
  return sourceByCode;
}

let storedPackagesByCode;
function discoverStoredPackages() {
  if (storedPackagesByCode) return storedPackagesByCode;
  const directory = path.join(ROOT, CONTENT_DIR);
  const packages = new Map();
  for (const name of fs.readdirSync(directory).filter((entry) => entry.endsWith('.json')).sort()) {
    const relativePath = `${CONTENT_DIR}/${name}`;
    let pack;
    try { pack = readJson(relativePath); } catch { continue; }
    const officialCode = pack?.sourceContext?.officialCode;
    if (!officialCode || packages.has(officialCode)) continue;
    packages.set(officialCode, { relativePath, pack });
  }
  storedPackagesByCode = packages;
  return packages;
}

export function getAuthoringProducer(task) {
  const officialCode = task?.officialCode;
  if (!officialCode) return null;
  const source = getSourceByCode().get(officialCode);
  if (source?.technicalVerificationStatus !== 'OFFICIAL_SOURCE_VERIFIED_EXACT') return null;
  const spec = discoverAuthoredCurriculumSpecs().get(officialCode);
  if (spec) {
    return {
      id: `declarative-curriculum-${officialCode.toLowerCase()}-v1`,
      sourceFile: spec.sourceFile,
      path: spec.outputPath,
      build: () => buildAuthoredCurriculumPack(spec),
      validate: (pack) => validateAuthoredCurriculumPack(pack, source),
    };
  }
  const stored = discoverStoredPackages().get(officialCode);
  if (!stored) return null;
  return {
    id: `staged-curriculum-${officialCode.toLowerCase()}`,
    sourceFile: stored.relativePath,
    path: stored.relativePath,
    build: () => readJson(stored.relativePath),
    validate: validateStoredCurriculumPack,
  };
}

export function listAuthoringProducers() {
  const codes = new Set([...discoverAuthoredCurriculumSpecs().keys(), ...discoverStoredPackages().keys()]);
  return [...codes].sort().flatMap((officialCode) => {
    const producer = getAuthoringProducer({ officialCode });
    return producer ? [{ officialCode, id: producer.id, path: producer.path, sourceFile: producer.sourceFile }] : [];
  });
}
