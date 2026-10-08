import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { EnemCanonicalizationResult } from './canonicalize.ts';
import { validateSubjectClassificationRegistry } from './classification.ts';
import { renderQuestionKey, type EnemAssetRenderManifest } from './render-question-assets.ts';
import { buildEnemPromotionParity, buildEnemReadinessReport, buildPromotionSelection } from './readiness.ts';
import type { SubjectClassificationRecord } from './classification.ts';

function argument(name: string, args: string[]) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function runCli() {
  const args = process.argv.slice(2);
  const canonicalPath = resolve(argument('--canonical', args) ?? '.runtime/enem-canonical-primary-language-2020-2025.json');
  const assetsPath = resolve(argument('--assets', args) ?? '.runtime/enem-assets-primary-language.json');
  const classificationPath = resolve(argument('--classification', args) ?? 'tools/enem/data/subject-classifications-v1.json');
  const outDir = resolve(argument('--out-dir', args) ?? '.runtime/enem-promotion-v1');
  const canonical = JSON.parse(readFileSync(canonicalPath, 'utf8')) as EnemCanonicalizationResult;
  const assets = JSON.parse(readFileSync(assetsPath, 'utf8')) as { artifacts: EnemAssetRenderManifest[] };
  const registry = JSON.parse(readFileSync(classificationPath, 'utf8')) as SubjectClassificationRecord[];
  const registryErrors = validateSubjectClassificationRegistry(registry, canonical.canonicalQuestions);
  if (registryErrors.length) throw new Error(`ENEM_CLASSIFICATION_REGISTRY_INVALID:${registryErrors.join(',')}`);
  const report = buildEnemReadinessReport(canonical.canonicalQuestions, registry, assets);
  const selection = buildPromotionSelection(canonical.canonicalQuestions, registry, report, assets, {
    subjectTarget: 15,
    areaTarget: 60,
    commonTarget: 50,
    languageTarget: 10,
  });
  const renderByKey = new Map<string, { manifest: EnemAssetRenderManifest; question: EnemAssetRenderManifest['questions'][number] }>();
  for (const manifest of assets.artifacts) {
    for (const question of manifest.questions) {
      renderByKey.set(renderQuestionKey(manifest, question.questionNumber, question.language), { manifest, question });
    }
  }
  const assetPlan = selection.flatMap((item) => {
    const rendered = renderByKey.get(renderQuestionKey(item.primary_occurrence, item.primary_occurrence.questionNumber, item.language));
    const assets = [
      ...(rendered?.question.statementAssets ?? []),
      ...Object.values(rendered?.question.optionAssets ?? {}).flat(),
    ];
    return assets.map((asset) => {
      const absolutePath = resolve(argument('--asset-dir', args) ?? '.runtime/enem-question-assets-primary-language', asset.storagePath);
      const bytes = statSync(absolutePath).size;
      return {
        canonical_id: item.canonical_id,
        purpose: item.purpose,
        area: item.area,
        subject: item.subject,
        language: item.language,
        storage_path: asset.storagePath,
        media_type: asset.mediaType,
        asset_role: asset.assetRole,
        option_label: 'optionLabel' in asset ? asset.optionLabel : null,
        bytes,
        sha256: asset.sha256,
        source_page: asset.page,
      };
    });
  });
  const parity = buildEnemPromotionParity(report, selection, assetPlan);
  writeJson(resolve(outDir, 'subject-classifications-v1.json'), registry);
  writeJson(resolve(outDir, 'readiness-v1.json'), report);
  writeJson(resolve(outDir, 'asset-plan-v1.json'), assetPlan);
  writeJson(resolve(outDir, 'selection-v1.json'), selection);
  writeJson(resolve(outDir, 'promotion-parity-v1.json'), parity);
  console.log(`ENEM_PROMOTION_REPORT subjects_ready=${report.allSubjectsReady} areas_ready=${report.allAreasReady} selected_subjects=${parity.selected.subjects}/${Object.keys(report.subjectReady).length} selected_areas=${parity.selected.areas}/${Object.keys(report.areaReady).length} common=${parity.selected.languagesCommon}/${parity.assetPlanned.languagesCommon} english=${parity.selected.english}/${parity.assetPlanned.english} spanish=${parity.selected.spanish}/${parity.assetPlanned.spanish} eligible=${report.eligible.length} selected=${selection.length} issues=${report.issues.length + parity.issues.length} output=${outDir}`);
  if (!report.allSubjectsReady || !report.allAreasReady || parity.issues.length) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await runCli();
